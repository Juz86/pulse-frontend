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
    private val identityBinder: PulseCallE2eeIdentityBinder? = null,
    private val createMessageId: () -> String = { UUID.randomUUID().toString() },
) : PulseCallMediaListener {
    private data class ActiveMediaSession(
        val sessionId: String,
        val localUid: String,
        val engine: PulseCallMediaEngine,
        val serverSession: AtomicReference<PulseServerCallSession>,
        val localIdentity: AtomicReference<PulseCallE2eeIdentityEnvelope?> = AtomicReference(null),
        val remoteIdentity: AtomicReference<PulseCallE2eeIdentityEnvelope?> = AtomicReference(null),
        val ready: AtomicBoolean = AtomicBoolean(false),
        val pendingMutex: Mutex = Mutex(),
        val pendingSignals: ArrayDeque<PulseRemoteMediaSignal> = ArrayDeque(),
        val identityMutex: Mutex = Mutex(),
        val pendingIdentityCandidates: ArrayDeque<PulseRemoteIceCandidateSignal> = ArrayDeque(),
        val verifiedRemoteBindings: MutableSet<String> = mutableSetOf(),
    )

    private val lifecycleMutex = Mutex()
    private val active = AtomicReference<ActiveMediaSession?>(null)
    private val connectedReported = AtomicBoolean(false)
    private val reconnectingReported = AtomicBoolean(false)
    private val failureReported = AtomicBoolean(false)

    suspend fun start(session: PulseServerCallSession, localUid: String): Boolean =
        lifecycleMutex.withLock {
            val current = active.get()
            if (current?.sessionId == session.sessionId) {
                current.serverSession.set(session)
                return@withLock true
            }
            if (current != null || session.state !in MEDIA_STATES || !session.isParticipant(localUid)) {
                return@withLock false
            }

            val engine = engineFactory.create()
            val mediaSession = ActiveMediaSession(
                session.sessionId,
                localUid,
                engine,
                AtomicReference(session),
            )
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
                        mediaType = session.mediaType,
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
            val binder = identityBinder
            if (binder == null) {
                applyUnboundRemote(mediaSession, signal)
            } else {
                mediaSession.identityMutex.withLock {
                    when (signal) {
                        is PulseRemoteDescriptionSignal -> {
                        val identity = signal.identity
                            ?: throw IllegalArgumentException("e2ee_call_identity_required")
                        val bindingHash = binder.verify(
                            session = mediaSession.serverSession.get(),
                            remoteUid = signal.senderUid,
                            description = signal.description,
                            identity = identity,
                            localOffer = mediaSession.localIdentity.get(),
                        )
                        if (!mediaSession.verifiedRemoteBindings.add(bindingHash)) {
                            throw IllegalArgumentException("e2ee_call_identity_replay")
                        }
                        mediaSession.remoteIdentity.set(identity)
                            mediaSession.engine.applyRemoteDescription(signal.description)
                            while (mediaSession.pendingIdentityCandidates.isNotEmpty()) {
                                mediaSession.engine.addRemoteIceCandidate(
                                    mediaSession.pendingIdentityCandidates.removeFirst().candidate,
                                )
                            }
                        }
                        is PulseRemoteIceCandidateSignal -> {
                            if (mediaSession.remoteIdentity.get() == null) {
                                if (mediaSession.pendingIdentityCandidates.size >= MAX_PENDING_SIGNALS) {
                                    throw IllegalStateException("e2ee_call_identity_candidate_limit")
                                }
                                mediaSession.pendingIdentityCandidates.addLast(signal)
                            } else {
                                mediaSession.engine.addRemoteIceCandidate(signal.candidate)
                            }
                        }
                    }
                }
            }
            true
        } catch (_: Throwable) {
            reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
            false
        }
    }

    private suspend fun applyUnboundRemote(
        mediaSession: ActiveMediaSession,
        signal: PulseRemoteMediaSignal,
    ) {
        when (signal) {
            is PulseRemoteDescriptionSignal ->
                mediaSession.engine.applyRemoteDescription(signal.description)
            is PulseRemoteIceCandidateSignal ->
                mediaSession.engine.addRemoteIceCandidate(signal.candidate)
        }
    }

    suspend fun restartIce(sessionId: String): Boolean {
        val mediaSession = active.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return runCatching { mediaSession.engine.restartIce() }
            .onFailure { reportFailure(sessionId, MEDIA_ERROR) }
            .isSuccess
    }

    suspend fun setMuted(sessionId: String, muted: Boolean): Boolean {
        val mediaSession = active.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return runCatching { mediaSession.engine.setMuted(muted) }.isSuccess
    }

    suspend fun setVideoEnabled(sessionId: String, enabled: Boolean): Boolean {
        val mediaSession = active.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return runCatching { mediaSession.engine.setVideoEnabled(enabled) }.getOrDefault(false)
    }

    suspend fun switchCamera(sessionId: String): Boolean {
        val mediaSession = active.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return runCatching { mediaSession.engine.switchCamera() }.getOrDefault(false)
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
        mediaSession?.identityMutex?.withLock { mediaSession.pendingIdentityCandidates.clear() }
        mediaSession?.engine?.close()
    }

    override fun onLocalDescription(description: PulseSessionDescription) {
        val mediaSession = active.get() ?: return
        scope.launch {
            val identity = identityBinder?.sign(
                session = mediaSession.serverSession.get(),
                localUid = mediaSession.localUid,
                description = description,
                verifiedPeer = mediaSession.remoteIdentity.get(),
            )
            if (identity != null) mediaSession.localIdentity.set(identity)
            val response = signaling.sendDescription(
                sessionId = mediaSession.sessionId,
                messageId = createMessageId(),
                description = description,
                identity = identity,
            )
            if (!response.ok || response.status != PulseSignalingStatus.RELAYED) {
                reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
            }
        }.invokeOnCompletion { error ->
            if (error != null) reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
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
