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
    val displayName: String,
    val direction: PulseCallDirection,
    val mediaType: PulseCallMediaType = PulseCallMediaType.AUDIO,
)

data class PulseCallSnapshot(
    val sessionId: String? = null,
    val displayName: String? = null,
    val direction: PulseCallDirection? = null,
    val mediaType: PulseCallMediaType? = null,
    val state: PulseCallState = PulseCallState.IDLE,
    val sequence: Long = 0,
    val signalingRevision: Long = 0,
    val localMediaReady: Boolean = false,
    val telecomRegistered: Boolean = false,
    val telecomActive: Boolean = false,
)

enum class PulseCoordinatorResult {
    APPLIED,
    IDEMPOTENT,
    REJECTED_BUSY,
    REJECTED_PROTOCOL,
    REJECTED_REVISION,
    REJECTED_SESSION,
    REJECTED_TRANSITION,
}
