package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause
import androidx.core.telecom.CallAttributesCompat
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

enum class PulseCallLaunchResult {
    STARTED,
    BUSY,
    AUTH_REQUIRED,
    SIGNALING_UNAVAILABLE,
    REJECTED,
}

class PulseCallSessionOrchestrator(
    private val scope: CoroutineScope,
    private val identityProvider: PulseCallIdentityProvider,
    private val signaling: PulseCallSignalingGateway,
    private val telecom: PulseTelecomController,
    private val coordinator: PulseCallCoordinator = PulseCallCoordinator.instance,
    mediaEngineFactory: PulseCallMediaEngineFactory? = null,
    private val beforeMediaStart: () -> Boolean = { true },
) : PulseCallSignalingListener, PulseTelecomCallbacks, PulseCallMediaSessionCallbacks {
    private val launchMutex = Mutex()
    private val identity = AtomicReference<PulseCallIdentity?>(null)
    private val serverSession = AtomicReference<PulseServerCallSession?>(null)
    private val terminating = AtomicBoolean(false)
    private val handledIceRestartSequence = AtomicLong(0)
    private val networkRecoveryPending = AtomicBoolean(false)
    private val networkRecoveryAcknowledged = AtomicBoolean(false)
    private val networkRecoveryInFlight = AtomicBoolean(false)
    private val mediaSessions = mediaEngineFactory?.let { factory ->
        PulseCallMediaSessionController(scope, signaling, factory, this)
    }
    private var telecomJob: Job? = null

    suspend fun startOutgoing(
        requestId: String,
        calleeUid: String,
        displayName: String,
        mediaType: PulseCallMediaType,
    ): PulseCallLaunchResult = launchMutex.withLock {
        if (isBusy()) return@withLock PulseCallLaunchResult.BUSY
        if (requestId.isBlank() || calleeUid.isBlank() || displayName.isBlank()) {
            return@withLock PulseCallLaunchResult.REJECTED
        }
        val localIdentity = identityProvider.getIdentity()
            ?: return@withLock PulseCallLaunchResult.AUTH_REQUIRED
        if (!connectSignaling(localIdentity)) {
            return@withLock PulseCallLaunchResult.SIGNALING_UNAVAILABLE
        }
        val response = signaling.startCall(requestId, calleeUid, mediaType)
        val session = response.session
        if (!response.ok || session == null) {
            signaling.disconnect()
            return@withLock response.toLaunchResult()
        }
        if (session.callerUid != localIdentity.uid ||
            session.calleeUid != calleeUid ||
            session.requestId != requestId ||
            session.mediaType != mediaType
        ) {
            PulseCallDiagnostics.event(
                "START_RESPONSE_REJECTED",
                session.sessionId,
                status = "SESSION_MISMATCH",
                state = session.state.name,
            )
            signaling.disconnect()
            return@withLock PulseCallLaunchResult.REJECTED
        }

        val request = PulseCallRequest(
            sessionId = session.sessionId,
            displayName = displayName,
            direction = PulseCallDirection.OUTGOING,
            mediaType = mediaType,
        )
        if (coordinator.begin(request) != PulseCoordinatorResult.APPLIED) {
            PulseCallDiagnostics.event("COORDINATOR_REJECTED", session.sessionId, status = "BUSY")
            signaling.disconnect()
            return@withLock PulseCallLaunchResult.BUSY
        }
        identity.set(localIdentity)
        serverSession.set(session)
        terminating.set(false)
        resetNetworkRecovery(session.iceRestartSequence)
        coordinator.onSignalingSnapshot(session, localIdentity.uid)
        startTelecom(request)
        PulseCallLaunchResult.STARTED
    }

    suspend fun registerIncoming(
        sessionId: String,
        displayName: String,
    ): PulseCallLaunchResult = launchMutex.withLock {
        PulseCallDiagnostics.event("REGISTER_INCOMING_STARTED", sessionId)
        if (isBusy()) {
            PulseCallDiagnostics.event("REGISTER_INCOMING_REJECTED", sessionId, status = "BUSY")
            return@withLock PulseCallLaunchResult.BUSY
        }
        if (sessionId.isBlank() || displayName.isBlank()) {
            PulseCallDiagnostics.event("REGISTER_INCOMING_REJECTED", sessionId, status = "INVALID_REQUEST")
            return@withLock PulseCallLaunchResult.REJECTED
        }
        PulseCallDiagnostics.event("AUTHENTICATION_REQUESTED", sessionId)
        val localIdentity = identityProvider.getIdentity()
        if (localIdentity == null) {
            PulseCallDiagnostics.event("AUTHENTICATION_FAILED", sessionId, status = "AUTH_REQUIRED")
            return@withLock PulseCallLaunchResult.AUTH_REQUIRED
        }
        PulseCallDiagnostics.event("AUTHENTICATION_SUCCEEDED", sessionId)
        if (!connectSignaling(localIdentity)) {
            PulseCallDiagnostics.event("SIGNALING_CONNECTION_FAILED", sessionId)
            return@withLock PulseCallLaunchResult.SIGNALING_UNAVAILABLE
        }
        PulseCallDiagnostics.event("SIGNALING_CONNECTED", sessionId)
        PulseCallDiagnostics.event("SNAPSHOT_REQUESTED", sessionId)
        val response = signaling.fetchSnapshot(sessionId)
        val session = response.session
        PulseCallDiagnostics.event(
            "SNAPSHOT_RECEIVED",
            sessionId,
            status = response.status.name,
            state = session?.state?.name,
        )
        if (!response.ok || session == null) {
            signaling.disconnect()
            return@withLock response.toLaunchResult()
        }
        if (session.calleeUid != localIdentity.uid ||
            session.sessionId != sessionId ||
            session.state != PulseServerCallState.RINGING
        ) {
            PulseCallDiagnostics.event(
                "SNAPSHOT_REJECTED",
                sessionId,
                status = "SESSION_MISMATCH",
                state = session.state.name,
            )
            signaling.disconnect()
            return@withLock PulseCallLaunchResult.REJECTED
        }

        val request = PulseCallRequest(
            sessionId = session.sessionId,
            displayName = displayName,
            direction = PulseCallDirection.INCOMING,
            mediaType = session.mediaType,
        )
        if (coordinator.begin(request) != PulseCoordinatorResult.APPLIED) {
            PulseCallDiagnostics.event("COORDINATOR_REJECTED", sessionId, status = "BUSY")
            signaling.disconnect()
            return@withLock PulseCallLaunchResult.BUSY
        }
        identity.set(localIdentity)
        serverSession.set(session)
        terminating.set(false)
        resetNetworkRecovery(session.iceRestartSequence)
        coordinator.onSignalingSnapshot(session, localIdentity.uid)
        startTelecom(request)
        PulseCallLaunchResult.STARTED
    }

    fun requestAnswer(sessionId: String) {
        scope.launch {
            val snapshot = coordinator.state.value
            if (snapshot.sessionId != sessionId ||
                snapshot.direction != PulseCallDirection.INCOMING ||
                snapshot.state != PulseCallState.RINGING ||
                !snapshot.telecomRegistered
            ) {
                PulseCallDiagnostics.event("NOTIFICATION_ANSWER_REJECTED", sessionId, status = "INVALID_STATE")
                return@launch
            }
            val callType = if (snapshot.mediaType == PulseCallMediaType.VIDEO) {
                CallAttributesCompat.CALL_TYPE_VIDEO_CALL
            } else {
                CallAttributesCompat.CALL_TYPE_AUDIO_CALL
            }
            PulseCallDiagnostics.event("NOTIFICATION_ANSWER_REQUESTED", sessionId)
            if (!telecom.answer(sessionId, callType)) {
                PulseCallDiagnostics.event("NOTIFICATION_ANSWER_FAILED", sessionId, status = "TELECOM_REJECTED")
                return@launch
            }
            acceptLocally(sessionId)
        }
    }

    fun requestDisconnect(sessionId: String) {
        scope.launch {
            if (!telecom.disconnect(sessionId, DisconnectCause(DisconnectCause.LOCAL))) {
                endLocally(sessionId)
            }
        }
    }

    suspend fun shutdown() {
        terminating.set(true)
        telecomJob?.cancel()
        telecomJob = null
        val snapshot = coordinator.state.value
        snapshot.sessionId?.let { sessionId ->
            mediaSessions?.close(sessionId)
            if (snapshot.state !in setOf(PulseCallState.ENDING, PulseCallState.ENDED)) {
                coordinator.beginEnding(sessionId, remote = false)
            }
            if (coordinator.state.value.state == PulseCallState.ENDING) {
                coordinator.completeCleanup(sessionId)
            }
        }
        signaling.disconnect()
        identity.set(null)
        serverSession.set(null)
        resetNetworkRecovery()
        terminating.set(false)
    }

    fun onNetworkChanged(sessionId: String) {
        requestNetworkRecovery(sessionId, attemptImmediately = true)
    }

    override fun onSessionUpdated(session: PulseServerCallSession) {
        val current = serverSession.get() ?: return
        val localIdentity = identity.get() ?: return
        if (session.sessionId != current.sessionId || session.revision < current.revision) return
        serverSession.set(session)
        val result = coordinator.onSignalingSnapshot(session, localIdentity.uid)
        if (result !in setOf(PulseCoordinatorResult.APPLIED, PulseCoordinatorResult.IDEMPOTENT)) return

        val shouldRestartIce = localIdentity.uid == session.callerUid &&
            claimIceRestartSequence(session.iceRestartSequence)
        if (shouldRestartIce) {
            networkRecoveryPending.set(true)
            networkRecoveryAcknowledged.set(true)
        }

        when (coordinator.state.value.state) {
            PulseCallState.CONNECTING, PulseCallState.ACTIVE -> scope.launch(
                start = CoroutineStart.UNDISPATCHED,
            ) {
                if (!telecom.setActive(session.sessionId)) {
                    onMediaFailure(session.sessionId, MEDIA_ERROR)
                    return@launch
                }
                startMedia(session, localIdentity.uid)
                if (shouldRestartIce && mediaSessions?.restartIce(session.sessionId) != true) {
                    onMediaFailure(session.sessionId, MEDIA_ERROR)
                }
            }
            PulseCallState.ENDING -> scope.launch {
                if (!terminating.get() &&
                    serverSession.get()?.sessionId == session.sessionId &&
                    coordinator.state.value.state == PulseCallState.ENDING &&
                    !telecom.disconnect(session.sessionId, DisconnectCause(DisconnectCause.REMOTE))
                ) {
                    completeCleanup(session.sessionId)
                }
            }
            else -> Unit
        }
    }

    override fun onConnectionChanged(connected: Boolean) {
        val session = serverSession.get() ?: return
        if (session.state !in RECOVERABLE_SERVER_STATES || terminating.get()) return
        if (!connected) {
            requestNetworkRecovery(session.sessionId, attemptImmediately = false)
        } else if (networkRecoveryPending.get() && !networkRecoveryAcknowledged.get()) {
            scope.launch { flushNetworkRecovery(session.sessionId) }
        }
    }

    override fun onMediaSignal(signal: PulseRemoteMediaSignal) {
        val session = serverSession.get() ?: return
        val localIdentity = identity.get() ?: return
        if (signal.sessionId != session.sessionId || signal.senderUid == localIdentity.uid) return
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            mediaSessions?.handleRemote(signal)
        }
    }

    override fun onRegistered(sessionId: String) {
        PulseCallDiagnostics.event(
            "TELECOM_REGISTERED",
            sessionId,
            direction = coordinator.state.value.direction,
        )
        if (coordinator.onTelecomRegistered(sessionId) != PulseCoordinatorResult.APPLIED) return
        if (coordinator.state.value.direction == PulseCallDirection.OUTGOING) {
            scope.launch { sendCommand(PulseSignalingCommand.INVITE_READY) }
        }
    }

    override suspend fun onAnswer(sessionId: String, callType: Int) {
        acceptLocally(sessionId)
    }

    private fun acceptLocally(sessionId: String) {
        PulseCallDiagnostics.event("ANSWER", sessionId)
        if (coordinator.onLocalAnswer(sessionId) == PulseCoordinatorResult.APPLIED) {
            scope.launch { confirmAccept(sessionId) }
        }
    }

    private suspend fun confirmAccept(sessionId: String) {
        val response = sendCommand(PulseSignalingCommand.ACCEPT)
        val confirmed = response?.status in setOf(
            PulseSignalingStatus.APPLIED,
            PulseSignalingStatus.DUPLICATE,
        ) && response?.session?.state in setOf(
            PulseServerCallState.CONNECTING,
            PulseServerCallState.ACTIVE,
        )
        if (confirmed) return

        val snapshot = coordinator.state.value
        if (snapshot.sessionId != sessionId ||
            snapshot.state in setOf(PulseCallState.ENDING, PulseCallState.ENDED)
        ) return
        PulseCallDiagnostics.event(
            "ACCEPT_CONFIRMATION_FAILED",
            sessionId,
            status = response?.status?.name ?: "NO_RESPONSE",
            state = response?.session?.state?.name,
        )
        failMedia(sessionId, SIGNALING_ERROR)
    }

    override suspend fun onDisconnect(sessionId: String, cause: DisconnectCause) {
        if (coordinator.state.value.state == PulseCallState.ENDING) {
            completeCleanup(sessionId)
            return
        }
        endLocally(sessionId)
    }

    override suspend fun onSetActive(sessionId: String) {
        PulseCallDiagnostics.event("TELECOM_ACTIVE", sessionId)
        coordinator.onTelecomSetActive(sessionId)
    }

    override suspend fun onSetInactive(sessionId: String) {
        coordinator.onTelecomSetInactive(sessionId)
    }

    override fun onMediaConnected(sessionId: String) {
        if (coordinator.onMediaConnected(sessionId) !in setOf(
                PulseCoordinatorResult.APPLIED,
                PulseCoordinatorResult.IDEMPOTENT,
            )
        ) return
        networkRecoveryPending.set(false)
        networkRecoveryAcknowledged.set(false)
        scope.launch { sendCommand(PulseSignalingCommand.MEDIA_CONNECTED) }
    }

    override fun onMediaReconnecting(sessionId: String) {
        requestNetworkRecovery(sessionId, attemptImmediately = true)
    }

    override fun onMediaFailure(sessionId: String, reason: String) {
        scope.launch { failMedia(sessionId, reason) }
    }

    private suspend fun connectSignaling(localIdentity: PulseCallIdentity): Boolean =
        runCatching { signaling.connect(localIdentity.authToken, this) }.isSuccess

    private fun startTelecom(request: PulseCallRequest) {
        PulseCallDiagnostics.event(
            if (request.direction == PulseCallDirection.INCOMING) {
                "TELECOM_INCOMING_REGISTRATION_REQUESTED"
            } else {
                "TELECOM_OUTGOING_REGISTRATION_REQUESTED"
            },
            request.sessionId,
            direction = request.direction,
        )
        telecomJob = scope.launch {
            try {
                telecom.addCall(request, this@PulseCallSessionOrchestrator)
            } catch (error: Throwable) {
                PulseCallDiagnostics.event(
                    "TELECOM_REGISTRATION_FAILED",
                    request.sessionId,
                    status = error.javaClass.simpleName,
                    direction = request.direction,
                )
                throw error
            } finally {
                if (!terminating.get() &&
                    coordinator.state.value.sessionId == request.sessionId &&
                    coordinator.state.value.state !in setOf(PulseCallState.ENDING, PulseCallState.ENDED)
                ) {
                    endLocally(request.sessionId)
                }
            }
        }
    }

    private suspend fun startMedia(session: PulseServerCallSession, localUid: String) {
        val controller = mediaSessions ?: return
        if (session.mediaType != PulseCallMediaType.AUDIO || !beforeMediaStart()) {
            onMediaFailure(session.sessionId, MEDIA_ERROR)
            return
        }
        if (!controller.start(session, localUid) && !terminating.get()) {
            onMediaFailure(session.sessionId, MEDIA_ERROR)
        }
    }

    private suspend fun failMedia(sessionId: String, reason: String) {
        if (serverSession.get()?.sessionId != sessionId || !terminating.compareAndSet(false, true)) return
        coordinator.beginEnding(sessionId, remote = false)
        sendCommand(PulseSignalingCommand.FAIL, reason)
        if (!telecom.disconnect(sessionId, DisconnectCause(DisconnectCause.ERROR))) {
            completeCleanup(sessionId)
        }
    }

    private suspend fun endLocally(sessionId: String) {
        if (!terminating.compareAndSet(false, true)) return
        val snapshot = coordinator.state.value
        val command = if (
            snapshot.direction == PulseCallDirection.INCOMING &&
            snapshot.state == PulseCallState.RINGING
        ) {
            PulseSignalingCommand.DECLINE
        } else {
            PulseSignalingCommand.END
        }
        coordinator.beginEnding(sessionId, remote = false)
        sendCommand(command)
        completeCleanup(sessionId)
    }

    private suspend fun completeCleanup(sessionId: String) {
        mediaSessions?.close(sessionId)
        coordinator.completeCleanup(sessionId)
        signaling.disconnect()
        identity.set(null)
        serverSession.set(null)
        resetNetworkRecovery()
        terminating.set(false)
    }

    private suspend fun sendCommand(
        command: PulseSignalingCommand,
        reason: String? = null,
    ): PulseSignalingResponse? {
        val session = serverSession.get() ?: return null
        PulseCallDiagnostics.event("${command.name}_REQUESTED", session.sessionId)
        val eventId = UUID.randomUUID().toString()
        var expectedRevision = session.revision
        repeat(2) {
            val response = signaling.sendCommand(
                sessionId = session.sessionId,
                eventId = eventId,
                expectedRevision = expectedRevision,
                command = command,
                reason = reason,
            )
            response.session?.let(::onSessionUpdated)
            if (response.status != PulseSignalingStatus.CONFLICT) {
                PulseCallDiagnostics.event(
                    command.name,
                    session.sessionId,
                    status = response.status.name,
                    state = response.session?.state?.name,
                )
                return response
            }
            expectedRevision = response.session?.revision ?: return response
        }
        return null
    }

    private fun requestNetworkRecovery(sessionId: String, attemptImmediately: Boolean) {
        val session = serverSession.get() ?: return
        if (session.sessionId != sessionId ||
            session.state !in RECOVERABLE_SERVER_STATES ||
            terminating.get()
        ) return
        if (networkRecoveryPending.compareAndSet(false, true)) {
            networkRecoveryAcknowledged.set(false)
        }
        if (attemptImmediately && !networkRecoveryAcknowledged.get()) {
            scope.launch { flushNetworkRecovery(sessionId) }
        }
    }

    private suspend fun flushNetworkRecovery(sessionId: String) {
        if (!networkRecoveryPending.get() ||
            networkRecoveryAcknowledged.get() ||
            !networkRecoveryInFlight.compareAndSet(false, true)
        ) return
        try {
            val current = serverSession.get()
            if (current?.sessionId != sessionId || current.state !in RECOVERABLE_SERVER_STATES) return
            val response = sendCommand(PulseSignalingCommand.NETWORK_LOST)
            if (response?.status in setOf(PulseSignalingStatus.APPLIED, PulseSignalingStatus.DUPLICATE)) {
                networkRecoveryAcknowledged.set(true)
            }
        } finally {
            networkRecoveryInFlight.set(false)
        }
    }

    private fun claimIceRestartSequence(sequence: Long): Boolean {
        while (true) {
            val handled = handledIceRestartSequence.get()
            if (sequence <= handled) return false
            if (handledIceRestartSequence.compareAndSet(handled, sequence)) return true
        }
    }

    private fun resetNetworkRecovery(iceRestartSequence: Long = 0) {
        handledIceRestartSequence.set(iceRestartSequence)
        networkRecoveryPending.set(false)
        networkRecoveryAcknowledged.set(false)
        networkRecoveryInFlight.set(false)
    }

    private fun isBusy(): Boolean =
        telecomJob?.isActive == true ||
            coordinator.state.value.state !in setOf(PulseCallState.IDLE, PulseCallState.ENDED)

    private fun PulseSignalingResponse.toLaunchResult(): PulseCallLaunchResult = when (status) {
        PulseSignalingStatus.BUSY -> PulseCallLaunchResult.BUSY
        PulseSignalingStatus.SERVICE_UNAVAILABLE -> PulseCallLaunchResult.SIGNALING_UNAVAILABLE
        else -> PulseCallLaunchResult.REJECTED
    }

    private companion object {
        const val MEDIA_ERROR = "media_error"
        const val SIGNALING_ERROR = "signaling_error"
        val RECOVERABLE_SERVER_STATES = setOf(
            PulseServerCallState.CONNECTING,
            PulseServerCallState.ACTIVE,
        )
    }
}
