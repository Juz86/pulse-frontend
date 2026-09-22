package com.pulsemessenger.chat.call.v2

const val PULSE_CALL_PROTOCOL_VERSION = 2

enum class PulseSignalingCommand {
    INVITE_READY,
    ACCEPT,
    MEDIA_CONNECTED,
    NETWORK_LOST,
    DECLINE,
    END,
    FAIL,
}

enum class PulseServerCallState {
    PREPARING,
    RINGING,
    CONNECTING,
    ACTIVE,
    ENDED,
}

enum class PulseSignalingStatus {
    CREATED,
    IDEMPOTENT,
    APPLIED,
    DUPLICATE,
    FOUND,
    CONFLICT,
    BUSY,
    NOT_AVAILABLE,
    NOT_FOUND,
    FORBIDDEN,
    INVALID_REQUEST,
    INVALID_TRANSITION,
    INVALID_REASON,
    ALREADY_ENDED,
    SERVICE_UNAVAILABLE,
    UNKNOWN,
}

data class PulseServerCallSession(
    val protocolVersion: Int,
    val sessionId: String,
    val requestId: String,
    val callerUid: String,
    val calleeUid: String,
    val mediaType: PulseCallMediaType,
    val state: PulseServerCallState,
    val revision: Long,
    val mediaReadyUids: Set<String>,
    val terminalReason: String?,
    val terminalByUid: String?,
)

data class PulseSignalingResponse(
    val ok: Boolean,
    val status: PulseSignalingStatus,
    val session: PulseServerCallSession? = null,
)

interface PulseCallSignalingListener {
    fun onSessionUpdated(session: PulseServerCallSession)
    fun onConnectionChanged(connected: Boolean)
}

/**
 * Native port for Railway Calling v2. Implementations own transport and authentication only;
 * the coordinator remains the sole owner of local call state.
 */
interface PulseCallSignalingGateway {
    suspend fun connect(authToken: String, listener: PulseCallSignalingListener)

    suspend fun startCall(
        requestId: String,
        calleeUid: String,
        mediaType: PulseCallMediaType,
    ): PulseSignalingResponse

    suspend fun sendCommand(
        sessionId: String,
        eventId: String,
        expectedRevision: Long,
        command: PulseSignalingCommand,
        reason: String? = null,
    ): PulseSignalingResponse

    suspend fun fetchSnapshot(sessionId: String): PulseSignalingResponse
    fun disconnect()
}
