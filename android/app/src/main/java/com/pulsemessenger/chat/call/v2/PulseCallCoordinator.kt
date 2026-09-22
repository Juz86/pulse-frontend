package com.pulsemessenger.chat.call.v2

import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class PulseCallCoordinator private constructor(
    private val stateMachine: PulseCallStateMachine,
) {
    private val lock = Any()
    private val mutableState = MutableStateFlow(PulseCallSnapshot())
    private var request: PulseCallRequest? = null
    private var signalingRevision = 0L
    private var localMediaReady = false
    private var telecomRegistered = false
    private var telecomActive = false

    val state: StateFlow<PulseCallSnapshot> = mutableState.asStateFlow()

    fun begin(request: PulseCallRequest): PulseCoordinatorResult = synchronized(lock) {
        if (request.sessionId.isBlank() || request.displayName.isBlank()) {
            return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        }
        val current = mutableState.value
        if (current.sessionId == request.sessionId && current.state != PulseCallState.IDLE) {
            return@synchronized PulseCoordinatorResult.IDEMPOTENT
        }
        if (current.state == PulseCallState.ENDED) resetLocked()
        if (stateMachine.state != PulseCallState.IDLE) {
            return@synchronized PulseCoordinatorResult.REJECTED_BUSY
        }

        val event = if (request.direction == PulseCallDirection.OUTGOING) {
            PulseCallEvent.START_OUTGOING
        } else {
            PulseCallEvent.RECEIVE_INCOMING
        }
        this.request = request
        signalingRevision = 0L
        localMediaReady = false
        telecomRegistered = false
        telecomActive = false
        val result = applyLocked(request.sessionId, event)
        if (result != PulseCoordinatorResult.APPLIED) {
            this.request = null
            return@synchronized result
        }
        PulseCoordinatorResult.APPLIED
    }

    fun onTelecomRegistered(sessionId: String): PulseCoordinatorResult = synchronized(lock) {
        if (!ownsLocked(sessionId)) return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        if (telecomRegistered) return@synchronized PulseCoordinatorResult.IDEMPOTENT
        telecomRegistered = true
        publishLocked()
        PulseCoordinatorResult.APPLIED
    }

    fun onTelecomSetActive(sessionId: String): PulseCoordinatorResult = synchronized(lock) {
        if (!ownsLocked(sessionId)) return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        if (telecomActive && stateMachine.state in setOf(PulseCallState.CONNECTING, PulseCallState.ACTIVE)) {
            return@synchronized PulseCoordinatorResult.IDEMPOTENT
        }
        if (stateMachine.state !in setOf(PulseCallState.RINGING, PulseCallState.CONNECTING, PulseCallState.ACTIVE)) {
            return@synchronized PulseCoordinatorResult.REJECTED_TRANSITION
        }
        telecomActive = true
        publishLocked()
        PulseCoordinatorResult.APPLIED
    }

    fun onLocalAnswer(sessionId: String): PulseCoordinatorResult = synchronized(lock) {
        if (!ownsLocked(sessionId)) return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        if (request?.direction != PulseCallDirection.INCOMING) {
            return@synchronized PulseCoordinatorResult.REJECTED_TRANSITION
        }
        if (stateMachine.state == PulseCallState.CONNECTING) {
            return@synchronized PulseCoordinatorResult.IDEMPOTENT
        }
        applyLocked(sessionId, PulseCallEvent.LOCAL_ACCEPTED)
    }

    fun onTelecomSetInactive(sessionId: String): PulseCoordinatorResult = synchronized(lock) {
        if (!ownsLocked(sessionId)) return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        if (!telecomActive) return@synchronized PulseCoordinatorResult.IDEMPOTENT
        telecomActive = false
        publishLocked()
        PulseCoordinatorResult.APPLIED
    }

    fun onMediaConnected(sessionId: String): PulseCoordinatorResult = synchronized(lock) {
        if (!ownsLocked(sessionId)) return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        if (localMediaReady) return@synchronized PulseCoordinatorResult.IDEMPOTENT
        if (stateMachine.state !in setOf(PulseCallState.CONNECTING, PulseCallState.ACTIVE)) {
            return@synchronized PulseCoordinatorResult.REJECTED_TRANSITION
        }
        localMediaReady = true
        publishLocked()
        PulseCoordinatorResult.APPLIED
    }

    fun onSignalingSnapshot(
        snapshot: PulseServerCallSession,
        localUid: String,
    ): PulseCoordinatorResult = synchronized(lock) {
        if (snapshot.protocolVersion != PULSE_CALL_PROTOCOL_VERSION) {
            return@synchronized PulseCoordinatorResult.REJECTED_PROTOCOL
        }
        val currentRequest = request
        val expectedUid = if (currentRequest?.direction == PulseCallDirection.OUTGOING) {
            snapshot.callerUid
        } else {
            snapshot.calleeUid
        }
        if (!ownsLocked(snapshot.sessionId) ||
            localUid != expectedUid ||
            currentRequest?.mediaType != snapshot.mediaType
        ) {
            return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        }
        if (snapshot.revision <= 0 || snapshot.revision < signalingRevision) {
            return@synchronized PulseCoordinatorResult.REJECTED_REVISION
        }
        if (snapshot.revision == signalingRevision) {
            return@synchronized PulseCoordinatorResult.IDEMPOTENT
        }

        val transitionResult = reconcileServerStateLocked(snapshot, localUid)
        if (transitionResult != PulseCoordinatorResult.APPLIED &&
            transitionResult != PulseCoordinatorResult.IDEMPOTENT
        ) {
            return@synchronized transitionResult
        }
        signalingRevision = snapshot.revision
        publishLocked()
        PulseCoordinatorResult.APPLIED
    }

    fun beginEnding(sessionId: String, remote: Boolean): PulseCoordinatorResult = synchronized(lock) {
        if (!ownsLocked(sessionId)) return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        if (stateMachine.state in setOf(PulseCallState.ENDING, PulseCallState.ENDED)) {
            return@synchronized PulseCoordinatorResult.IDEMPOTENT
        }
        telecomActive = false
        localMediaReady = false
        applyLocked(
            sessionId,
            if (remote) PulseCallEvent.REMOTE_ENDED else PulseCallEvent.END_REQUESTED,
        )
    }

    fun completeCleanup(sessionId: String): PulseCoordinatorResult = synchronized(lock) {
        if (!ownsLocked(sessionId)) return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        if (stateMachine.state == PulseCallState.ENDED) return@synchronized PulseCoordinatorResult.IDEMPOTENT
        if (stateMachine.state != PulseCallState.ENDING) {
            return@synchronized PulseCoordinatorResult.REJECTED_TRANSITION
        }
        telecomRegistered = false
        telecomActive = false
        applyLocked(sessionId, PulseCallEvent.CLEANUP_COMPLETED)
    }

    private fun applyLocked(
        sessionId: String,
        event: PulseCallEvent,
        publish: Boolean = true,
    ): PulseCoordinatorResult {
        val transition = stateMachine.apply(
            PulseCallCommand(
                sessionId,
                UUID.randomUUID().toString(),
                stateMachine.lastSequence + 1,
                event,
            ),
        )
        val result = when (transition.outcome) {
            PulseCallTransition.Outcome.APPLIED -> PulseCoordinatorResult.APPLIED
            PulseCallTransition.Outcome.DUPLICATE -> PulseCoordinatorResult.IDEMPOTENT
            PulseCallTransition.Outcome.REJECTED_STALE_SESSION -> PulseCoordinatorResult.REJECTED_SESSION
            else -> PulseCoordinatorResult.REJECTED_TRANSITION
        }
        if (result == PulseCoordinatorResult.APPLIED && publish) publishLocked()
        return result
    }

    private fun ownsLocked(sessionId: String): Boolean =
        sessionId.isNotBlank() && stateMachine.sessionId == sessionId

    private fun reconcileServerStateLocked(
        snapshot: PulseServerCallSession,
        localUid: String,
    ): PulseCoordinatorResult {
        if (snapshot.state == PulseServerCallState.ENDED) {
            if (stateMachine.state in setOf(PulseCallState.ENDING, PulseCallState.ENDED)) {
                return PulseCoordinatorResult.IDEMPOTENT
            }
            telecomActive = false
            return applyLocked(
                snapshot.sessionId,
                if (snapshot.terminalByUid == localUid) {
                    PulseCallEvent.END_REQUESTED
                } else {
                    PulseCallEvent.REMOTE_ENDED
                },
                publish = false,
            )
        }

        if (snapshot.state in setOf(
                PulseServerCallState.RINGING,
                PulseServerCallState.CONNECTING,
                PulseServerCallState.ACTIVE,
            ) && stateMachine.state == PulseCallState.PREPARING
        ) {
            val ready = applyLocked(snapshot.sessionId, PulseCallEvent.SIGNALING_READY, publish = false)
            if (ready != PulseCoordinatorResult.APPLIED) return ready
        }

        if (snapshot.state in setOf(PulseServerCallState.CONNECTING, PulseServerCallState.ACTIVE) &&
            stateMachine.state == PulseCallState.RINGING
        ) {
            val accepted = applyLocked(
                snapshot.sessionId,
                if (request?.direction == PulseCallDirection.INCOMING) {
                    PulseCallEvent.LOCAL_ACCEPTED
                } else {
                    PulseCallEvent.REMOTE_ACCEPTED
                },
                publish = false,
            )
            if (accepted != PulseCoordinatorResult.APPLIED) return accepted
        }

        if (snapshot.state == PulseServerCallState.ACTIVE && stateMachine.state == PulseCallState.CONNECTING) {
            val connected = applyLocked(snapshot.sessionId, PulseCallEvent.MEDIA_CONNECTED, publish = false)
            if (connected != PulseCoordinatorResult.APPLIED) return connected
        }

        return PulseCoordinatorResult.APPLIED
    }

    private fun publishLocked() {
        val currentRequest = request
        mutableState.value = PulseCallSnapshot(
            sessionId = stateMachine.sessionId,
            displayName = currentRequest?.displayName,
            direction = currentRequest?.direction,
            mediaType = currentRequest?.mediaType,
            state = stateMachine.state,
            sequence = stateMachine.lastSequence,
            signalingRevision = signalingRevision,
            localMediaReady = localMediaReady,
            telecomRegistered = telecomRegistered,
            telecomActive = telecomActive,
        )
    }

    private fun resetLocked() {
        val sessionId = stateMachine.sessionId ?: return
        applyLocked(sessionId, PulseCallEvent.RESET, publish = false)
        request = null
        signalingRevision = 0L
        localMediaReady = false
        telecomRegistered = false
        telecomActive = false
        publishLocked()
    }

    companion object {
        val instance: PulseCallCoordinator by lazy {
            PulseCallCoordinator(PulseCallStateMachine())
        }

        internal fun createForTests(): PulseCallCoordinator =
            PulseCallCoordinator(PulseCallStateMachine())
    }
}
