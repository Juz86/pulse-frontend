package com.pulsemessenger.chat.call.v2

import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

interface PulseCallMediaSessionCallbacks {
    fun onMediaConnected(sessionId: String)
    fun onMediaReconnecting(sessionId: String)
    fun onMediaFailure(sessionId: String, reason: String)
}

class PulseCallMediaSessionController(
    private val scope: CoroutineScope,
    private val signaling: PulseCallSignalingGateway,
    private val engineFactory: PulseCallMediaEngineFactory,
    private val callbacks: PulseCallMediaSessionCallbacks,
    private val createMessageId: () -> String = { UUID.randomUUID().toString() },
) : PulseCallMediaListener {
    private data class ActiveMediaSession(
        val sessionId: String,
        val localUid: String,
        val engine: PulseCallMediaEngine,
        val ready: AtomicBoolean = AtomicBoolean(false),
        val pendingMutex: Mutex = Mutex(),
        val pendingSignals: ArrayDeque<PulseRemoteMediaSignal> = ArrayDeque(),
    )

    private val lifecycleMutex = Mutex()
    private val active = AtomicReference<ActiveMediaSession?>(null)
    private val connectedReported = AtomicBoolean(false)
    private val reconnectingReported = AtomicBoolean(false)
    private val failureReported = AtomicBoolean(false)

    suspend fun start(session: PulseServerCallSession, localUid: String): Boolean =
        lifecycleMutex.withLock {
            val current = active.get()
            if (current?.sessionId == session.sessionId) return@withLock true
            if (current != null || session.state !in MEDIA_STATES || !session.isParticipant(localUid)) {
                return@withLock false
            }

            val engine = engineFactory.create()
            val mediaSession = ActiveMediaSession(session.sessionId, localUid, engine)
            active.set(mediaSession)
            connectedReported.set(false)
            reconnectingReported.set(false)
            failureReported.set(false)

            val iceConfiguration = signaling.fetchIceConfiguration(session.sessionId)
            if (!iceConfiguration.ok ||
                iceConfiguration.status != PulseSignalingStatus.FOUND ||
                iceConfiguration.iceServers.isEmpty()
            ) {
                active.compareAndSet(mediaSession, null)
                runCatching { engine.close() }
                callbacks.onMediaFailure(session.sessionId, SIGNALING_ERROR)
                return@withLock false
            }

            try {
                engine.start(
                    PulseAudioSessionConfig(
                        sessionId = session.sessionId,
                        role = if (session.callerUid == localUid) {
                            PulseMediaRole.OFFERER
                        } else {
                            PulseMediaRole.ANSWERER
                        },
                        iceServers = iceConfiguration.iceServers,
                    ),
                    this,
                )
                val pending = mediaSession.pendingMutex.withLock {
                    mediaSession.ready.set(true)
                    mediaSession.pendingSignals.toList().also {
                        mediaSession.pendingSignals.clear()
                    }
                }
                pending.forEach { signal -> applyRemote(mediaSession, signal) }
                true
            } catch (_: Throwable) {
                active.compareAndSet(mediaSession, null)
                runCatching { engine.close() }
                callbacks.onMediaFailure(session.sessionId, MEDIA_ERROR)
                false
            }
        }

    suspend fun handleRemote(signal: PulseRemoteMediaSignal): Boolean {
        val mediaSession = active.get() ?: return false
        if (signal.sessionId != mediaSession.sessionId || signal.senderUid == mediaSession.localUid) {
            return false
        }
        if (!mediaSession.ready.get()) {
            return mediaSession.pendingMutex.withLock {
                if (mediaSession.ready.get()) {
                    applyRemote(mediaSession, signal)
                } else if (mediaSession.pendingSignals.size >= MAX_PENDING_SIGNALS) {
                    reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
                    false
                } else {
                    mediaSession.pendingSignals.addLast(signal)
                    true
                }
            }
        }
        return applyRemote(mediaSession, signal)
    }

    private suspend fun applyRemote(
        mediaSession: ActiveMediaSession,
        signal: PulseRemoteMediaSignal,
    ): Boolean {
        return try {
            when (signal) {
                is PulseRemoteDescriptionSignal ->
                    mediaSession.engine.applyRemoteDescription(signal.description)
                is PulseRemoteIceCandidateSignal ->
                    mediaSession.engine.addRemoteIceCandidate(signal.candidate)
            }
            true
        } catch (_: Throwable) {
            reportFailure(mediaSession.sessionId, MEDIA_ERROR)
            false
        }
    }

    suspend fun restartIce(sessionId: String): Boolean {
        val mediaSession = active.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return runCatching { mediaSession.engine.restartIce() }
            .onFailure { reportFailure(sessionId, MEDIA_ERROR) }
            .isSuccess
    }

    suspend fun close(sessionId: String? = null) {
        val mediaSession = lifecycleMutex.withLock {
            val current = active.get() ?: return@withLock null
            if (sessionId != null && current.sessionId != sessionId) return@withLock null
            active.set(null)
            connectedReported.set(false)
            reconnectingReported.set(false)
            failureReported.set(false)
            current
        }
        mediaSession?.pendingMutex?.withLock { mediaSession.pendingSignals.clear() }
        mediaSession?.engine?.close()
    }

    override fun onLocalDescription(description: PulseSessionDescription) {
        val mediaSession = active.get() ?: return
        scope.launch {
            val response = signaling.sendDescription(
                sessionId = mediaSession.sessionId,
                messageId = createMessageId(),
                description = description,
            )
            if (!response.ok || response.status != PulseSignalingStatus.RELAYED) {
                reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
            }
        }
    }

    override fun onLocalIceCandidate(candidate: PulseIceCandidate) {
        val mediaSession = active.get() ?: return
        scope.launch {
            val response = signaling.sendIceCandidate(
                sessionId = mediaSession.sessionId,
                messageId = createMessageId(),
                candidate = candidate,
            )
            if (!response.ok || response.status != PulseSignalingStatus.RELAYED) {
                reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
            }
        }
    }

    override fun onMediaStateChanged(state: PulseMediaState) {
        val sessionId = active.get()?.sessionId ?: return
        when (state) {
            PulseMediaState.CONNECTED -> {
                reconnectingReported.set(false)
                if (connectedReported.compareAndSet(false, true)) {
                    callbacks.onMediaConnected(sessionId)
                }
            }
            PulseMediaState.RECONNECTING -> {
                connectedReported.set(false)
                if (reconnectingReported.compareAndSet(false, true)) {
                    callbacks.onMediaReconnecting(sessionId)
                }
            }
            else -> Unit
        }
    }

    override fun onMediaFailure(reason: String) {
        active.get()?.sessionId?.let { reportFailure(it, MEDIA_ERROR) }
    }

    private fun reportFailure(sessionId: String, reason: String) {
        if (active.get()?.sessionId != sessionId || !failureReported.compareAndSet(false, true)) return
        callbacks.onMediaFailure(sessionId, reason)
    }

    private fun PulseServerCallSession.isParticipant(uid: String): Boolean =
        callerUid == uid || calleeUid == uid

    private companion object {
        val MEDIA_STATES = setOf(PulseServerCallState.CONNECTING, PulseServerCallState.ACTIVE)
        const val SIGNALING_ERROR = "signaling_error"
        const val MEDIA_ERROR = "media_error"
        const val MAX_PENDING_SIGNALS = 128
    }
}
