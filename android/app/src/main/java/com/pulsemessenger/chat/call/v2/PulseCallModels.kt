package com.pulsemessenger.chat.call.v2

enum class PulseCallDirection {
    INCOMING,
    OUTGOING,
}

enum class PulseCallMediaType {
    AUDIO,
    VIDEO,
}

data class PulseCallRequest(
    val sessionId: String,
    val peerUid: String,
    val displayName: String,
    val direction: PulseCallDirection,
    val mediaType: PulseCallMediaType = PulseCallMediaType.AUDIO,
)

data class PulseCallSnapshot(
    val sessionId: String? = null,
    val peerUid: String? = null,
    val displayName: String? = null,
    val direction: PulseCallDirection? = null,
    val mediaType: PulseCallMediaType? = null,
    val state: PulseCallState = PulseCallState.IDLE,
    val sequence: Long = 0,
    val signalingRevision: Long = 0,
    val localMediaReady: Boolean = false,
    val telecomRegistered: Boolean = false,
    val telecomActive: Boolean = false,
    val isMuted: Boolean = false,
    val activeSinceElapsedRealtimeMs: Long? = null,
    val wasActive: Boolean = false,
    val terminalReason: String? = null,
    val finalActiveDurationMs: Long? = null,
)

enum class PulseCallTerminalPresentation {
    REJECTED,
    COMPLETED,
}

fun PulseCallSnapshot.terminalPresentation(): PulseCallTerminalPresentation? {
    if (state !in setOf(PulseCallState.ENDING, PulseCallState.ENDED)) return null
    return when {
        direction == PulseCallDirection.OUTGOING && terminalReason == "declined" ->
            PulseCallTerminalPresentation.REJECTED
        wasActive && terminalReason == "hangup" -> PulseCallTerminalPresentation.COMPLETED
        else -> null
    }
}

enum class PulseCoordinatorResult {
    APPLIED,
    IDEMPOTENT,
    REJECTED_BUSY,
    REJECTED_PROTOCOL,
    REJECTED_REVISION,
    REJECTED_SESSION,
    REJECTED_TRANSITION,
}
