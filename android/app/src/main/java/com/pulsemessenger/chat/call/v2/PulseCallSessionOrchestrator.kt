package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause
import androidx.core.telecom.CallAttributesCompat
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CancellationException
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

enum class PulseTerminalReconcileResult {
    RECONCILED,
    VERIFIED_ENDED,
    BUSY,
    AUTH_REQUIRED,
    SIGNALING_UNAVAILABLE,
    REJECTED,
}

enum class PulseTakenElsewhereReconcileResult {
    RECONCILED,
    VERIFIED_NO_LOCAL_CALL,
    WINNING_DEVICE,
    NOT_ACTIVE,
    REJECTED,
}

enum class PulseCallRecoveryResult {
    RECOVERED,
    BUSY,
    AUTH_REQUIRED,
    SIGNALING_UNAVAILABLE,
    STALE,
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
    private val onRecoveryRecordChanged: (PulseCallRecoveryRecord?) -> Unit = {},
    private val onCallFailure: (sessionId: String, reason: String) -> Unit = { _, _ -> },
) : PulseCallSignalingListener, PulseTelecomCallbacks, PulseCallMediaSessionCallbacks {
    private val launchMutex = Mutex()
    private val identity = AtomicReference<PulseCallIdentity?>(null)
    private val serverSession = AtomicReference<PulseServerCallSession?>(null)
    private val terminating = AtomicBoolean(false)
    private val handledIceRestartSequence = AtomicLong(0)
    private val networkRecoveryPending = AtomicBoolean(false)
    private val networkRecoveryAcknowledged = AtomicBoolean(false)
    private val networkRecoveryInFlight = AtomicBoolean(false)
    private val recovering = AtomicBoolean(false)
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
        publishRecoveryRecord(request, localIdentity.uid)
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
        publishRecoveryRecord(request, localIdentity.uid)
        startTelecom(request)
        PulseCallLaunchResult.STARTED
    }

    suspend fun recover(record: PulseCallRecoveryRecord): PulseCallRecoveryResult =
        launchMutex.withLock {
            if (isBusy()) return@withLock PulseCallRecoveryResult.BUSY
            val localIdentity = identityProvider.getIdentity()
                ?: return@withLock PulseCallRecoveryResult.AUTH_REQUIRED
            if (record.ownerUid != localIdentity.uid) return@withLock PulseCallRecoveryResult.STALE
            if (!connectSignaling(localIdentity)) {
                return@withLock PulseCallRecoveryResult.SIGNALING_UNAVAILABLE
            }
            val response = signaling.fetchSnapshot(record.sessionId)
            val session = response.session
            if (!response.ok || session == null) {
                signaling.disconnect()
                return@withLock if (response.status == PulseSignalingStatus.SERVICE_UNAVAILABLE) {
                    PulseCallRecoveryResult.SIGNALING_UNAVAILABLE
                } else if (response.status in setOf(
                        PulseSignalingStatus.NOT_FOUND,
                        PulseSignalingStatus.ALREADY_ENDED,
                    )
                ) {
                    PulseCallRecoveryResult.STALE
                } else {
                    PulseCallRecoveryResult.REJECTED
                }
            }
            val expectedUid = if (record.direction == PulseCallDirection.OUTGOING) {
                session.callerUid
            } else {
                session.calleeUid
            }
            val recoverableState = session.state in setOf(
                PulseServerCallState.PREPARING,
                PulseServerCallState.RINGING,
                PulseServerCallState.CONNECTING,
                PulseServerCallState.ACTIVE,
            )
            val acceptedElsewhere = record.direction == PulseCallDirection.INCOMING &&
                session.acceptedInstallationId != null &&
                session.acceptedInstallationId != localIdentity.installationId
            if (session.sessionId != record.sessionId ||
                expectedUid != localIdentity.uid ||
                session.mediaType != record.mediaType ||
                !recoverableState ||
                acceptedElsewhere
            ) {
                signaling.disconnect()
                return@withLock PulseCallRecoveryResult.STALE
            }

            val request = PulseCallRequest(
                sessionId = session.sessionId,
                displayName = record.displayName,
                direction = record.direction,
                mediaType = record.mediaType,
            )
            if (coordinator.begin(request) != PulseCoordinatorResult.APPLIED) {
                signaling.disconnect()
                return@withLock PulseCallRecoveryResult.BUSY
            }
            identity.set(localIdentity)
            serverSession.set(session)
            terminating.set(false)
            recovering.set(true)
            resetNetworkRecovery(session.iceRestartSequence)
            val reconciled = coordinator.onSignalingSnapshot(session, localIdentity.uid)
            if (reconciled !in setOf(PulseCoordinatorResult.APPLIED, PulseCoordinatorResult.IDEMPOTENT)) {
                recovering.set(false)
                coordinator.beginEnding(session.sessionId, remote = true)
                coordinator.completeCleanup(session.sessionId)
                signaling.disconnect()
                identity.set(null)
                serverSession.set(null)
                return@withLock PulseCallRecoveryResult.REJECTED
            }
            publishRecoveryRecord(request, localIdentity.uid)
            PulseCallDiagnostics.event(
                "CALL_RECOVERY_CONFIRMED",
                session.sessionId,
                state = session.state.name,
                direction = request.direction,
            )
            startTelecom(request)
            PulseCallRecoveryResult.RECOVERED
        }

    suspend fun reconcileTerminal(sessionId: String): PulseTerminalReconcileResult =
        launchMutex.withLock {
            if (sessionId.isBlank()) return@withLock PulseTerminalReconcileResult.REJECTED
            val current = serverSession.get()
            if (current != null && current.sessionId != sessionId) {
                return@withLock PulseTerminalReconcileResult.BUSY
            }
            if (current == null && isBusy()) return@withLock PulseTerminalReconcileResult.BUSY

            val localIdentity = identity.get() ?: identityProvider.getIdentity()
                ?: return@withLock PulseTerminalReconcileResult.AUTH_REQUIRED
            val ownsSession = current?.sessionId == sessionId
            if (!ownsSession && !connectSignaling(localIdentity)) {
                return@withLock PulseTerminalReconcileResult.SIGNALING_UNAVAILABLE
            }

            var response = signaling.fetchSnapshot(sessionId)
            if (response.status == PulseSignalingStatus.SERVICE_UNAVAILABLE) {
                if (!connectSignaling(localIdentity)) {
                    if (!ownsSession) signaling.disconnect()
                    return@withLock PulseTerminalReconcileResult.SIGNALING_UNAVAILABLE
                }
                response = signaling.fetchSnapshot(sessionId)
            }
            val session = response.session
            val verified = response.ok &&
                session?.sessionId == sessionId &&
                session.state == PulseServerCallState.ENDED &&
                localIdentity.uid in setOf(session.callerUid, session.calleeUid)
            if (!verified) {
                if (!ownsSession) signaling.disconnect()
                return@withLock PulseTerminalReconcileResult.REJECTED
            }

            if (!ownsSession) {
                signaling.disconnect()
                return@withLock PulseTerminalReconcileResult.VERIFIED_ENDED
            }
            identity.set(localIdentity)
            onSessionUpdated(requireNotNull(session))
            PulseTerminalReconcileResult.RECONCILED
        }

    suspend fun reconcileTakenElsewhere(
        sessionId: String,
        acceptedInstallationId: String,
    ): PulseTakenElsewhereReconcileResult = launchMutex.withLock {
        val current = serverSession.get()
        if (current != null && current.sessionId != sessionId) {
            return@withLock PulseTakenElsewhereReconcileResult.NOT_ACTIVE
        }
        val localIdentity = identity.get() ?: identityProvider.getIdentity()
            ?: return@withLock PulseTakenElsewhereReconcileResult.REJECTED
        if (localIdentity.installationId == acceptedInstallationId) {
            return@withLock PulseTakenElsewhereReconcileResult.WINNING_DEVICE
        }
        val ownsSession = current?.sessionId == sessionId
        if (!ownsSession && !connectSignaling(localIdentity)) {
            return@withLock PulseTakenElsewhereReconcileResult.REJECTED
        }
        val response = signaling.fetchSnapshot(sessionId)
        val authoritative = response.session
        if (!response.ok ||
            authoritative?.sessionId != sessionId ||
            authoritative.calleeUid != localIdentity.uid ||
            authoritative.acceptedInstallationId != acceptedInstallationId ||
            authoritative.state !in setOf(PulseServerCallState.CONNECTING, PulseServerCallState.ACTIVE)
        ) {
            if (!ownsSession) signaling.disconnect()
            return@withLock PulseTakenElsewhereReconcileResult.REJECTED
        }
        if (!ownsSession) {
            signaling.disconnect()
            return@withLock PulseTakenElsewhereReconcileResult.VERIFIED_NO_LOCAL_CALL
        }
        serverSession.set(authoritative)
        endTakenElsewhere(authoritative)
        PulseTakenElsewhereReconcileResult.RECONCILED
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
        recovering.set(false)
        terminating.set(false)
    }

    fun onNetworkChanged(sessionId: String) {
        requestNetworkRecovery(sessionId, attemptImmediately = true)
    }

    override fun onSessionUpdated(session: PulseServerCallSession) {
        val current = serverSession.get() ?: return
        val localIdentity = identity.get() ?: return
        if (session.sessionId != current.sessionId || session.revision < current.revision) return
        if (session.isTakenElsewhere(localIdentity)) {
            serverSession.set(session)
            scope.launch(start = CoroutineStart.UNDISPATCHED) { endTakenElsewhere(session) }
            return
        }
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
        val session = serverSession.get() ?: return
        if (recovering.getAndSet(false) && session.state in RECOVERABLE_SERVER_STATES) {
            scope.launch {
                val response = sendCommand(PulseSignalingCommand.NETWORK_LOST)
                if (response?.status !in setOf(
                        PulseSignalingStatus.APPLIED,
                        PulseSignalingStatus.DUPLICATE,
                    )
                ) {
                    failMedia(sessionId, SIGNALING_ERROR)
                }
            }
        } else if (coordinator.state.value.direction == PulseCallDirection.OUTGOING &&
            session.state == PulseServerCallState.PREPARING
        ) {
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
        val localIdentity = identity.get()
        val acceptedSession = response?.session
        if (localIdentity != null && acceptedSession?.isTakenElsewhere(localIdentity) == true) {
            endTakenElsewhere(acceptedSession)
            return
        }
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
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                onCallFailure(request.sessionId, TELECOM_ERROR)
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
        onCallFailure(sessionId, reason)
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
        onRecoveryRecordChanged(null)
        resetNetworkRecovery()
        recovering.set(false)
        terminating.set(false)
    }

    private suspend fun endTakenElsewhere(session: PulseServerCallSession) {
        if (serverSession.get()?.sessionId != session.sessionId ||
            !terminating.compareAndSet(false, true)
        ) return
        PulseCallDiagnostics.event(
            "CALL_TAKEN_ELSEWHERE",
            session.sessionId,
            status = "LOCAL_DEVICE_LOST",
            state = session.state.name,
        )
        coordinator.beginEnding(session.sessionId, remote = true)
        if (!telecom.disconnect(session.sessionId, DisconnectCause(DisconnectCause.REMOTE))) {
            completeCleanup(session.sessionId)
        }
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
                installationId = identity.get()?.installationId,
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

    private fun publishRecoveryRecord(request: PulseCallRequest, ownerUid: String) {
        onRecoveryRecordChanged(
            PulseCallRecoveryRecord(
                sessionId = request.sessionId,
                ownerUid = ownerUid,
                displayName = request.displayName,
                direction = request.direction,
                mediaType = request.mediaType,
            ),
        )
    }

    private fun isBusy(): Boolean =
        telecomJob?.isActive == true ||
            coordinator.state.value.state !in setOf(PulseCallState.IDLE, PulseCallState.ENDED)

    private fun PulseServerCallSession.isTakenElsewhere(localIdentity: PulseCallIdentity): Boolean =
        localIdentity.uid == calleeUid &&
            acceptedInstallationId != null &&
            acceptedInstallationId != localIdentity.installationId

    private fun PulseSignalingResponse.toLaunchResult(): PulseCallLaunchResult = when (status) {
        PulseSignalingStatus.BUSY -> PulseCallLaunchResult.BUSY
        PulseSignalingStatus.SERVICE_UNAVAILABLE -> PulseCallLaunchResult.SIGNALING_UNAVAILABLE
        else -> PulseCallLaunchResult.REJECTED
    }

    private companion object {
        const val MEDIA_ERROR = "media_error"
        const val SIGNALING_ERROR = "signaling_error"
        const val TELECOM_ERROR = "telecom_error"
        val RECOVERABLE_SERVER_STATES = setOf(
            PulseServerCallState.CONNECTING,
            PulseServerCallState.ACTIVE,
        )
    }
}
