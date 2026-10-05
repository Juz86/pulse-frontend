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
    RELAYED,
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
    val acceptedInstallationId: String? = null,
    val iceRestartSequence: Long = 0,
)

data class PulseSignalingResponse(
    val ok: Boolean,
    val status: PulseSignalingStatus,
    val session: PulseServerCallSession? = null,
)

data class PulseIceConfigurationResponse(
    val ok: Boolean,
    val status: PulseSignalingStatus,
    val iceServers: List<PulseIceServer> = emptyList(),
    val expiresInSeconds: Int = 0,
)

sealed interface PulseRemoteMediaSignal {
    val sessionId: String
    val messageId: String
    val senderUid: String
}

data class PulseRemoteDescriptionSignal(
    override val sessionId: String,
    override val messageId: String,
    override val senderUid: String,
    val description: PulseSessionDescription,
) : PulseRemoteMediaSignal

data class PulseRemoteIceCandidateSignal(
    override val sessionId: String,
    override val messageId: String,
    override val senderUid: String,
    val candidate: PulseIceCandidate,
) : PulseRemoteMediaSignal

interface PulseCallSignalingListener {
    fun onSessionUpdated(session: PulseServerCallSession)
    fun onConnectionChanged(connected: Boolean)
    fun onMediaSignal(signal: PulseRemoteMediaSignal) = Unit
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
        installationId: String? = null,
    ): PulseSignalingResponse

    suspend fun fetchSnapshot(sessionId: String): PulseSignalingResponse

    suspend fun fetchIceConfiguration(sessionId: String): PulseIceConfigurationResponse

    suspend fun sendDescription(
        sessionId: String,
        messageId: String,
        description: PulseSessionDescription,
    ): PulseSignalingResponse

    suspend fun sendIceCandidate(
        sessionId: String,
        messageId: String,
        candidate: PulseIceCandidate,
    ): PulseSignalingResponse

    fun disconnect()
}
