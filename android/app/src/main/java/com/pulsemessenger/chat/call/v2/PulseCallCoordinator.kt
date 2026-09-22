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

        val result = if (
            request?.direction == PulseCallDirection.OUTGOING &&
            stateMachine.state == PulseCallState.PREPARING
        ) {
            applyLocked(sessionId, PulseCallEvent.SIGNALING_READY)
        } else {
            publishLocked()
            PulseCoordinatorResult.APPLIED
        }
        result
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

        val result = if (stateMachine.state == PulseCallState.RINGING) {
            val event = if (request?.direction == PulseCallDirection.INCOMING) {
                PulseCallEvent.LOCAL_ACCEPTED
            } else {
                PulseCallEvent.REMOTE_ACCEPTED
            }
            applyLocked(sessionId, event)
        } else {
            publishLocked()
            PulseCoordinatorResult.APPLIED
        }
        result
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
        applyLocked(sessionId, PulseCallEvent.MEDIA_CONNECTED)
    }

    fun beginEnding(sessionId: String, remote: Boolean): PulseCoordinatorResult = synchronized(lock) {
        if (!ownsLocked(sessionId)) return@synchronized PulseCoordinatorResult.REJECTED_SESSION
        if (stateMachine.state in setOf(PulseCallState.ENDING, PulseCallState.ENDED)) {
            return@synchronized PulseCoordinatorResult.IDEMPOTENT
        }
        telecomActive = false
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

    private fun publishLocked() {
        val currentRequest = request
        mutableState.value = PulseCallSnapshot(
            sessionId = stateMachine.sessionId,
            displayName = currentRequest?.displayName,
            direction = currentRequest?.direction,
            mediaType = currentRequest?.mediaType,
            state = stateMachine.state,
            sequence = stateMachine.lastSequence,
            telecomRegistered = telecomRegistered,
            telecomActive = telecomActive,
        )
    }

    private fun resetLocked() {
        val sessionId = stateMachine.sessionId ?: return
        applyLocked(sessionId, PulseCallEvent.RESET, publish = false)
        request = null
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
