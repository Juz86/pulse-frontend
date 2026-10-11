package com.pulsemessenger.chat.call.v2

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.webrtc.EglBase
import org.webrtc.VideoTrack

data class PulseVideoTrackSnapshot(
    val sessionId: String? = null,
    val localTrack: VideoTrack? = null,
    val remoteTrack: VideoTrack? = null,
    val cameraEnabled: Boolean = false,
    val usingFrontCamera: Boolean = true,
)

object PulseCallVideoState {
    private val eglBase = EglBase.create()
    private val mutableState = MutableStateFlow(PulseVideoTrackSnapshot())

    val state: StateFlow<PulseVideoTrackSnapshot> = mutableState.asStateFlow()
    val eglContext: EglBase.Context get() = eglBase.eglBaseContext

    fun begin(sessionId: String, localTrack: VideoTrack, usingFrontCamera: Boolean) {
        mutableState.value = PulseVideoTrackSnapshot(
            sessionId = sessionId,
            localTrack = localTrack,
            cameraEnabled = localTrack.enabled(),
            usingFrontCamera = usingFrontCamera,
        )
    }

    fun setRemoteTrack(sessionId: String, remoteTrack: VideoTrack) {
        val current = mutableState.value
        if (current.sessionId != sessionId) return
        mutableState.value = current.copy(remoteTrack = remoteTrack)
    }

    fun setCameraEnabled(sessionId: String, enabled: Boolean) {
        val current = mutableState.value
        if (current.sessionId != sessionId) return
        mutableState.value = current.copy(cameraEnabled = enabled)
    }

    fun setUsingFrontCamera(sessionId: String, usingFrontCamera: Boolean) {
        val current = mutableState.value
        if (current.sessionId != sessionId) return
        mutableState.value = current.copy(usingFrontCamera = usingFrontCamera)
    }

    fun clear(sessionId: String? = null) {
        if (sessionId != null && mutableState.value.sessionId != sessionId) return
        mutableState.value = PulseVideoTrackSnapshot()
    }
}
