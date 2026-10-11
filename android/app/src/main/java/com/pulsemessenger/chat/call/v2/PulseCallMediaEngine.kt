package com.pulsemessenger.chat.call.v2

import kotlinx.coroutines.flow.StateFlow

enum class PulseMediaRole {
    OFFERER,
    ANSWERER,
}

enum class PulseMediaState {
    NEW,
    STARTING,
    NEGOTIATING,
    CONNECTED,
    RECONNECTING,
    FAILED,
    CLOSED,
}

enum class PulseSessionDescriptionType {
    OFFER,
    ANSWER,
}

data class PulseIceServer(
    val urls: List<String>,
    val username: String? = null,
    val credential: String? = null,
) {
    init {
        require(urls.isNotEmpty() && urls.all { url ->
            url.startsWith("stun:") || url.startsWith("turn:") || url.startsWith("turns:")
        }) {
            "ICE server URLs must use stun, turn or turns"
        }
        require((username == null) == (credential == null)) {
            "ICE username and credential must be supplied together"
        }
        require(username == null || (username.isNotBlank() && credential?.isNotBlank() == true)) {
            "ICE username and credential must not be blank"
        }
    }

    override fun toString(): String = "PulseIceServer(urls=$urls, credentials=<redacted>)"
}

data class PulseSessionDescription(
    val type: PulseSessionDescriptionType,
    val value: String,
) {
    init {
        require(value.isNotBlank()) { "Session description must not be blank" }
    }

    override fun toString(): String = "PulseSessionDescription(type=$type, value=<redacted>)"
}

data class PulseIceCandidate(
    val mediaStreamId: String?,
    val mediaLineIndex: Int,
    val value: String,
) {
    init {
        require(mediaLineIndex >= 0) { "ICE media line index must not be negative" }
        require(value.isNotBlank()) { "ICE candidate must not be blank" }
    }

    override fun toString(): String = "PulseIceCandidate(value=<redacted>)"
}

data class PulseAudioSessionConfig(
    val sessionId: String,
    val role: PulseMediaRole,
    val iceServers: List<PulseIceServer>,
    val mediaType: PulseCallMediaType = PulseCallMediaType.AUDIO,
) {
    init {
        require(sessionId.isNotBlank()) { "Media sessionId must not be blank" }
        require(iceServers.isNotEmpty()) { "At least one ICE server is required" }
    }
}

interface PulseCallMediaListener {
    fun onLocalDescription(description: PulseSessionDescription)
    fun onLocalIceCandidate(candidate: PulseIceCandidate)
    fun onMediaStateChanged(state: PulseMediaState)
    fun onMediaFailure(reason: String)
}

interface PulseCallMediaEngine {
    val state: StateFlow<PulseMediaState>

    suspend fun start(config: PulseAudioSessionConfig, listener: PulseCallMediaListener)
    suspend fun applyRemoteDescription(description: PulseSessionDescription)
    suspend fun addRemoteIceCandidate(candidate: PulseIceCandidate)
    suspend fun restartIce()
    suspend fun setMuted(muted: Boolean)
    suspend fun setVideoEnabled(enabled: Boolean): Boolean = false
    suspend fun switchCamera(): Boolean = false
    suspend fun close()
}

fun interface PulseCallMediaEngineFactory {
    fun create(): PulseCallMediaEngine
}
