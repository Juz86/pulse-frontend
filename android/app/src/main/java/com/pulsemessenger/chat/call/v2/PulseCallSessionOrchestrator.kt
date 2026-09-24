package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
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
            signaling.disconnect()
            return@withLock PulseCallLaunchResult.BUSY
        }
        identity.set(localIdentity)
        serverSession.set(session)
        terminating.set(false)
        coordinator.onSignalingSnapshot(session, localIdentity.uid)
        startTelecom(request)
        PulseCallLaunchResult.STARTED
    }

    suspend fun registerIncoming(
        sessionId: String,
        displayName: String,
    ): PulseCallLaunchResult = launchMutex.withLock {
        if (isBusy()) return@withLock PulseCallLaunchResult.BUSY
        if (sessionId.isBlank() || displayName.isBlank()) {
            return@withLock PulseCallLaunchResult.REJECTED
        }
        val localIdentity = identityProvider.getIdentity()
            ?: return@withLock PulseCallLaunchResult.AUTH_REQUIRED
        if (!connectSignaling(localIdentity)) {
            return@withLock PulseCallLaunchResult.SIGNALING_UNAVAILABLE
        }
        val response = signaling.fetchSnapshot(sessionId)
        val session = response.session
        if (!response.ok || session == null) {
            signaling.disconnect()
            return@withLock response.toLaunchResult()
        }
        if (session.calleeUid != localIdentity.uid ||
            session.sessionId != sessionId ||
            session.state != PulseServerCallState.RINGING
        ) {
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
            signaling.disconnect()
            return@withLock PulseCallLaunchResult.BUSY
        }
        identity.set(localIdentity)
        serverSession.set(session)
        terminating.set(false)
        coordinator.onSignalingSnapshot(session, localIdentity.uid)
        startTelecom(request)
        PulseCallLaunchResult.STARTED
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
        terminating.set(false)
    }

    override fun onSessionUpdated(session: PulseServerCallSession) {
        val current = serverSession.get() ?: return
        val localIdentity = identity.get() ?: return
        if (session.sessionId != current.sessionId || session.revision < current.revision) return
        serverSession.set(session)
        val result = coordinator.onSignalingSnapshot(session, localIdentity.uid)
        if (result !in setOf(PulseCoordinatorResult.APPLIED, PulseCoordinatorResult.IDEMPOTENT)) return

        when (coordinator.state.value.state) {
            PulseCallState.CONNECTING, PulseCallState.ACTIVE -> scope.launch(
                start = CoroutineStart.UNDISPATCHED,
            ) {
                if (!telecom.setActive(session.sessionId)) {
                    onMediaFailure(session.sessionId, MEDIA_ERROR)
                    return@launch
                }
                startMedia(session, localIdentity.uid)
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

    override fun onConnectionChanged(connected: Boolean) = Unit

    override fun onMediaSignal(signal: PulseRemoteMediaSignal) {
        val session = serverSession.get() ?: return
        val localIdentity = identity.get() ?: return
        if (signal.sessionId != session.sessionId || signal.senderUid == localIdentity.uid) return
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            mediaSessions?.handleRemote(signal)
        }
    }

    override fun onRegistered(sessionId: String) {
        if (coordinator.onTelecomRegistered(sessionId) != PulseCoordinatorResult.APPLIED) return
        if (coordinator.state.value.direction == PulseCallDirection.OUTGOING) {
            scope.launch { sendCommand(PulseSignalingCommand.INVITE_READY) }
        }
    }

    override suspend fun onAnswer(sessionId: String, callType: Int) {
        if (coordinator.onLocalAnswer(sessionId) == PulseCoordinatorResult.APPLIED) {
            scope.launch { sendCommand(PulseSignalingCommand.ACCEPT) }
        }
    }

    override suspend fun onDisconnect(sessionId: String, cause: DisconnectCause) {
        if (coordinator.state.value.state == PulseCallState.ENDING) {
            completeCleanup(sessionId)
            return
        }
        endLocally(sessionId)
    }

    override suspend fun onSetActive(sessionId: String) {
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
        scope.launch { sendCommand(PulseSignalingCommand.MEDIA_CONNECTED) }
    }

    override fun onMediaReconnecting(sessionId: String) {
        if (serverSession.get()?.sessionId != sessionId || terminating.get()) return
        scope.launch { sendCommand(PulseSignalingCommand.NETWORK_LOST) }
    }

    override fun onMediaFailure(sessionId: String, reason: String) {
        scope.launch { failMedia(sessionId, reason) }
    }

    private suspend fun connectSignaling(localIdentity: PulseCallIdentity): Boolean =
        runCatching { signaling.connect(localIdentity.authToken, this) }.isSuccess

    private fun startTelecom(request: PulseCallRequest) {
        telecomJob = scope.launch {
            try {
                telecom.addCall(request, this@PulseCallSessionOrchestrator)
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
        terminating.set(false)
    }

    private suspend fun sendCommand(command: PulseSignalingCommand, reason: String? = null) {
        val session = serverSession.get() ?: return
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
            if (response.status != PulseSignalingStatus.CONFLICT) return
            expectedRevision = response.session?.revision ?: return
        }
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
    }
}
