package com.pulsemessenger.chat.call.v2

import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
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
    private val nowMillis: () -> Long = System::currentTimeMillis,
    private val localSignalRetryDelayMillis: Long = LOCAL_SIGNAL_RETRY_DELAY_MILLIS,
) : PulseCallMediaListener {
    private sealed interface PendingLocalSignal {
        val messageId: String
    }

    private data class PendingLocalDescription(
        override val messageId: String,
        val description: PulseSessionDescription,
        val identity: PulseCallE2eeIdentityEnvelope?,
    ) : PendingLocalSignal

    private data class PendingLocalCandidate(
        override val messageId: String,
        val candidate: PulseIceCandidate,
    ) : PendingLocalSignal

    private enum class LocalSignalPublishResult {
        RELAYED,
        RETRY,
        REJECTED,
    }

    private data class PrefetchedIceConfiguration(
        val sessionId: String,
        val response: PulseIceConfigurationResponse,
        val expiresAtMillis: Long,
    )

    private data class PreparedMediaSession(
        val sessionId: String,
        val config: PulseAudioSessionConfig,
        val engine: PulseCallMediaEngine,
        val expiresAtMillis: Long,
    )

    private data class ResolvedMediaConfiguration(
        val response: PulseIceConfigurationResponse,
        val preparedEngine: PulseCallMediaEngine?,
    )

    private data class PreparedLocalIdentity(
        val description: PulseSessionDescription,
        val identity: Deferred<PulseCallE2eeIdentityEnvelope?>,
    )

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
        val localSignalMutex: Mutex = Mutex(),
        val pendingLocalSignals: ArrayDeque<PendingLocalSignal> = ArrayDeque(),
        val localSignalRetryJob: AtomicReference<Job?> = AtomicReference(null),
        val preparedLocalIdentity: AtomicReference<PreparedLocalIdentity?> = AtomicReference(null),
    )

    private val lifecycleMutex = Mutex()
    private val iceConfigurationMutex = Mutex()
    private val active = AtomicReference<ActiveMediaSession?>(null)
    private val prefetchedIceConfiguration = AtomicReference<PrefetchedIceConfiguration?>(null)
    private val preparedMediaSession = AtomicReference<PreparedMediaSession?>(null)
    private val connectedReported = AtomicBoolean(false)
    private val reconnectingReported = AtomicBoolean(false)
    private val failureReported = AtomicBoolean(false)

    suspend fun prefetchIceConfiguration(
        session: PulseServerCallSession,
        localUid: String,
    ): Boolean {
        if (session.state != PulseServerCallState.RINGING || !session.isParticipant(localUid)) {
            return false
        }
        return iceConfigurationMutex.withLock {
            val cached = prefetchedIceConfiguration.get()
            val prepared = preparedMediaSession.get()
            if (
                cached?.sessionId == session.sessionId &&
                cached.expiresAtMillis > nowMillis() &&
                prepared?.sessionId == session.sessionId &&
                prepared.expiresAtMillis > nowMillis()
            ) {
                return@withLock true
            }
            PulseCallDiagnostics.event("MEDIA_ICE_PREFETCH_STARTED", session.sessionId)
            val (response, identityAuthorized) = coroutineScope {
                val ice = async { signaling.fetchIceConfiguration(session.sessionId) }
                val identity = async {
                    val binding = identityBinder?.localDeviceBinding(localUid)
                        ?: return@async identityBinder == null
                    PulseCallDiagnostics.event(
                        "MEDIA_IDENTITY_PREFLIGHT_STARTED",
                        session.sessionId,
                    )
                    signaling.preauthorizeIdentity(session.sessionId, binding).also {
                        PulseCallDiagnostics.event(
                            "MEDIA_IDENTITY_PREFLIGHT_READY",
                            session.sessionId,
                            status = it.status.name,
                        )
                    }.let {
                        // Older production signaling nodes do not implement this
                        // optional early acknowledgement. The signed SDP envelope
                        // and remote identity verification remain mandatory below.
                        if (it.status == PulseSignalingStatus.SERVICE_UNAVAILABLE) {
                            PulseCallDiagnostics.event(
                                "MEDIA_IDENTITY_PREFLIGHT_DEFERRED",
                                session.sessionId,
                                status = it.status.name,
                            )
                            true
                        } else {
                            it.ok && it.status == PulseSignalingStatus.AUTHORIZED
                        }
                    }
                }
                ice.await() to identity.await()
            }
            if (!identityAuthorized) {
                PulseCallDiagnostics.event(
                    "MEDIA_IDENTITY_PREFLIGHT_REJECTED",
                    session.sessionId,
                )
                return@withLock false
            }
            if (!response.isUsable()) {
                PulseCallDiagnostics.event(
                    "MEDIA_ICE_PREFETCH_REJECTED",
                    session.sessionId,
                    status = response.status.name,
                )
                return@withLock false
            }
            val expiresAtMillis = nowMillis() + response.cacheLifetimeMillis()
            prefetchedIceConfiguration.set(PrefetchedIceConfiguration(
                sessionId = session.sessionId,
                response = response,
                expiresAtMillis = expiresAtMillis,
            ))
            preparedMediaSession.getAndSet(null)?.engine?.close()
            val config = session.mediaConfig(localUid, response)
            val engine = engineFactory.create()
            PulseCallDiagnostics.event("MEDIA_ENGINE_PREPARE_STARTED", session.sessionId)
            try {
                engine.prepare(config, this)
                preparedMediaSession.set(PreparedMediaSession(
                    sessionId = session.sessionId,
                    config = config,
                    engine = engine,
                    expiresAtMillis = expiresAtMillis,
                ))
                PulseCallDiagnostics.event("MEDIA_ENGINE_PREPARE_READY", session.sessionId)
            } catch (error: Throwable) {
                PulseCallDiagnostics.event(
                    "MEDIA_ENGINE_PREPARE_FAILED",
                    session.sessionId,
                    status = diagnosticStatus(error),
                )
                runCatching { engine.close() }
            }
            PulseCallDiagnostics.event("MEDIA_ICE_PREFETCH_READY", session.sessionId)
            true
        }
    }

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

            val resolved = resolveMediaConfiguration(session.sessionId)
            val iceConfiguration = resolved.response
            val config = session.mediaConfig(localUid, iceConfiguration)
            val engine = resolved.preparedEngine?.takeIf {
                it.state.value == PulseMediaState.PREPARED
            } ?: engineFactory.create()
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

            if (!iceConfiguration.isUsable()) {
                PulseCallDiagnostics.event(
                    "MEDIA_ICE_CONFIGURATION_REJECTED",
                    session.sessionId,
                    status = iceConfiguration.status.name,
                )
                active.compareAndSet(mediaSession, null)
                runCatching { engine.close() }
                callbacks.onMediaFailure(session.sessionId, SIGNALING_ERROR)
                return@withLock false
            }

            try {
                if (resolved.preparedEngine === engine) {
                    PulseCallDiagnostics.event("MEDIA_ENGINE_PREPARE_USED", session.sessionId)
                }
                PulseCallDiagnostics.event("MEDIA_ENGINE_START_STARTED", session.sessionId)
                engine.start(config, this)
                PulseCallDiagnostics.event("MEDIA_ENGINE_START_READY", session.sessionId)
                val pending = mediaSession.pendingMutex.withLock {
                    mediaSession.ready.set(true)
                    mediaSession.pendingSignals.toList().also {
                        mediaSession.pendingSignals.clear()
                    }
                }
                pending.forEach { signal -> applyRemote(mediaSession, signal) }
                true
            } catch (error: Throwable) {
                PulseCallDiagnostics.event(
                    "MEDIA_ENGINE_START_FAILED",
                    session.sessionId,
                    status = diagnosticStatus(error),
                )
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
                            PulseCallDiagnostics.event(
                                "MEDIA_REMOTE_IDENTITY_VERIFY_STARTED",
                                mediaSession.sessionId,
                            )
                            val bindingHash = binder.verify(
                                session = mediaSession.serverSession.get(),
                                remoteUid = signal.senderUid,
                                description = signal.description,
                                identity = identity,
                                localOffer = mediaSession.localIdentity.get(),
                            )
                            PulseCallDiagnostics.event(
                                "MEDIA_REMOTE_IDENTITY_VERIFY_READY",
                                mediaSession.sessionId,
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
        } catch (error: Throwable) {
            PulseCallDiagnostics.event(
                "MEDIA_REMOTE_SIGNAL_REJECTED",
                mediaSession.sessionId,
                status = diagnosticStatus(error),
            )
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
        mediaSession?.localSignalRetryJob?.getAndSet(null)?.cancel()
        mediaSession?.preparedLocalIdentity?.getAndSet(null)?.identity?.cancel()
        mediaSession?.localSignalMutex?.withLock { mediaSession.pendingLocalSignals.clear() }
        mediaSession?.engine?.close()
        val preparedEngine = iceConfigurationMutex.withLock {
            val cached = prefetchedIceConfiguration.get()
            if (sessionId == null || cached?.sessionId == sessionId) {
                prefetchedIceConfiguration.set(null)
            }
            val prepared = preparedMediaSession.get()
            if (sessionId == null || prepared?.sessionId == sessionId) {
                preparedMediaSession.getAndSet(null)?.engine
            } else {
                null
            }
        }
        preparedEngine?.takeIf { it !== mediaSession?.engine }?.close()
    }

    private suspend fun resolveMediaConfiguration(sessionId: String): ResolvedMediaConfiguration =
        iceConfigurationMutex.withLock {
            val cached = prefetchedIceConfiguration.getAndSet(null)
            if (cached?.sessionId == sessionId && cached.expiresAtMillis > nowMillis()) {
                PulseCallDiagnostics.event("MEDIA_ICE_PREFETCH_USED", sessionId)
                val candidate = preparedMediaSession.getAndSet(null)
                val prepared = candidate?.takeIf {
                    it.sessionId == sessionId && it.expiresAtMillis > nowMillis()
                }
                if (candidate != null && prepared == null) candidate.engine.close()
                return@withLock ResolvedMediaConfiguration(cached.response, prepared?.engine)
            }
            preparedMediaSession.getAndSet(null)?.engine?.close()
            PulseCallDiagnostics.event("MEDIA_ICE_FETCH_STARTED", sessionId)
            val response = signaling.fetchIceConfiguration(sessionId).also { response ->
                PulseCallDiagnostics.event(
                    "MEDIA_ICE_FETCH_COMPLETED",
                    sessionId,
                    status = response.status.name,
                )
            }
            ResolvedMediaConfiguration(response, null)
        }

    private fun PulseServerCallSession.mediaConfig(
        localUid: String,
        iceConfiguration: PulseIceConfigurationResponse,
    ) = PulseAudioSessionConfig(
        sessionId = sessionId,
        role = if (callerUid == localUid) PulseMediaRole.OFFERER else PulseMediaRole.ANSWERER,
        iceServers = iceConfiguration.iceServers,
        mediaType = mediaType,
    )

    private fun PulseIceConfigurationResponse.isUsable(): Boolean =
        ok && status == PulseSignalingStatus.FOUND && iceServers.isNotEmpty()

    private fun PulseIceConfigurationResponse.cacheLifetimeMillis(): Long {
        val reportedMillis = expiresInSeconds.coerceAtLeast(1).toLong() * 1_000L
        return (reportedMillis - ICE_EXPIRY_MARGIN_MILLIS)
            .coerceAtLeast(MINIMUM_ICE_CACHE_MILLIS)
            .coerceAtMost(MAXIMUM_ICE_CACHE_MILLIS)
    }

    override fun onLocalDescriptionPrepared(description: PulseSessionDescription) {
        val mediaSession = active.get() ?: return
        if (identityBinder == null) return
        val prepared = PreparedLocalIdentity(
            description = description,
            identity = scope.async(start = CoroutineStart.DEFAULT) {
                signLocalIdentity(mediaSession, description)
            },
        )
        mediaSession.preparedLocalIdentity.getAndSet(prepared)?.identity?.cancel()
    }

    override fun onLocalDescription(description: PulseSessionDescription) {
        val mediaSession = active.get() ?: return
        scope.launch {
            try {
                val prepared = mediaSession.preparedLocalIdentity.getAndSet(null)
                val identity = if (prepared?.description == description) {
                    PulseCallDiagnostics.event(
                        "MEDIA_LOCAL_IDENTITY_SIGN_PREPARED_USED",
                        mediaSession.sessionId,
                    )
                    prepared.identity.await()
                } else {
                    prepared?.identity?.cancel()
                    signLocalIdentity(mediaSession, description)
                }
                if (identity != null) mediaSession.localIdentity.set(identity)
                PulseCallDiagnostics.event(
                    "MEDIA_DESCRIPTION_RELAY_STARTED",
                    mediaSession.sessionId,
                )
                handleLocalSignalResult(
                    mediaSession,
                    PendingLocalDescription(
                        messageId = createMessageId(),
                        description = description,
                        identity = identity,
                    ),
                )
            } catch (error: Throwable) {
                PulseCallDiagnostics.event(
                    "MEDIA_DESCRIPTION_PUBLISH_FAILED",
                    mediaSession.sessionId,
                    status = diagnosticStatus(error),
                )
                reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
            }
        }
    }

    private suspend fun signLocalIdentity(
        mediaSession: ActiveMediaSession,
        description: PulseSessionDescription,
    ): PulseCallE2eeIdentityEnvelope? {
        PulseCallDiagnostics.event(
            "MEDIA_LOCAL_IDENTITY_SIGN_STARTED",
            mediaSession.sessionId,
        )
        return identityBinder?.sign(
            session = mediaSession.serverSession.get(),
            localUid = mediaSession.localUid,
            description = description,
            verifiedPeer = mediaSession.remoteIdentity.get(),
        ).also {
            PulseCallDiagnostics.event(
                "MEDIA_LOCAL_IDENTITY_SIGN_READY",
                mediaSession.sessionId,
            )
        }
    }

    override fun onLocalIceCandidate(candidate: PulseIceCandidate) {
        val mediaSession = active.get() ?: return
        scope.launch {
            handleLocalSignalResult(
                mediaSession,
                PendingLocalCandidate(createMessageId(), candidate),
            )
        }
    }

    private suspend fun handleLocalSignalResult(
        mediaSession: ActiveMediaSession,
        signal: PendingLocalSignal,
    ) {
        when (publishLocalSignal(mediaSession, signal)) {
            LocalSignalPublishResult.RELAYED -> Unit
            LocalSignalPublishResult.RETRY -> enqueueLocalSignal(mediaSession, signal)
            LocalSignalPublishResult.REJECTED -> reportFailure(
                mediaSession.sessionId,
                SIGNALING_ERROR,
            )
        }
    }

    private suspend fun publishLocalSignal(
        mediaSession: ActiveMediaSession,
        signal: PendingLocalSignal,
    ): LocalSignalPublishResult = try {
        val response = when (signal) {
            is PendingLocalDescription -> signaling.sendDescription(
                sessionId = mediaSession.sessionId,
                messageId = signal.messageId,
                description = signal.description,
                identity = signal.identity,
            ).also {
                PulseCallDiagnostics.event(
                    "MEDIA_DESCRIPTION_RELAY_READY",
                    mediaSession.sessionId,
                    status = it.status.name,
                )
            }
            is PendingLocalCandidate -> signaling.sendIceCandidate(
                sessionId = mediaSession.sessionId,
                messageId = signal.messageId,
                candidate = signal.candidate,
            )
        }
        when {
            response.ok && response.status == PulseSignalingStatus.RELAYED ->
                LocalSignalPublishResult.RELAYED
            response.status == PulseSignalingStatus.SERVICE_UNAVAILABLE -> {
                PulseCallDiagnostics.event(
                    "MEDIA_LOCAL_SIGNAL_RETRY_QUEUED",
                    mediaSession.sessionId,
                    status = signal.javaClass.simpleName,
                )
                LocalSignalPublishResult.RETRY
            }
            else -> {
                PulseCallDiagnostics.event(
                    if (signal is PendingLocalDescription) {
                        "MEDIA_DESCRIPTION_RELAY_REJECTED"
                    } else {
                        "MEDIA_CANDIDATE_RELAY_REJECTED"
                    },
                    mediaSession.sessionId,
                    status = response.status.name,
                )
                LocalSignalPublishResult.REJECTED
            }
        }
    } catch (error: Throwable) {
        PulseCallDiagnostics.event(
            if (signal is PendingLocalDescription) {
                "MEDIA_DESCRIPTION_PUBLISH_DEFERRED"
            } else {
                "MEDIA_CANDIDATE_PUBLISH_DEFERRED"
            },
            mediaSession.sessionId,
            status = diagnosticStatus(error),
        )
        LocalSignalPublishResult.RETRY
    }

    private suspend fun enqueueLocalSignal(
        mediaSession: ActiveMediaSession,
        signal: PendingLocalSignal,
    ) {
        val queued = mediaSession.localSignalMutex.withLock {
            if (active.get() !== mediaSession || mediaSession.pendingLocalSignals.size >= MAX_PENDING_SIGNALS) {
                false
            } else {
                mediaSession.pendingLocalSignals.addLast(signal)
                true
            }
        }
        if (!queued) {
            reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
            return
        }
        scheduleLocalSignalRetry(mediaSession)
    }

    private fun scheduleLocalSignalRetry(mediaSession: ActiveMediaSession) {
        if (mediaSession.localSignalRetryJob.get()?.isActive == true) return
        lateinit var retryJob: Job
        retryJob = scope.launch(start = CoroutineStart.LAZY) {
            try {
                while (active.get() === mediaSession && !failureReported.get()) {
                    delay(localSignalRetryDelayMillis)
                    val pending = mediaSession.localSignalMutex.withLock {
                        mediaSession.pendingLocalSignals.toList().also {
                            mediaSession.pendingLocalSignals.clear()
                        }
                    }
                    if (pending.isEmpty()) return@launch
                    val results = coroutineScope {
                        pending.map { signal ->
                            async { signal to publishLocalSignal(mediaSession, signal) }
                        }.awaitAll()
                    }
                    val rejected = results.any { it.second == LocalSignalPublishResult.REJECTED }
                    if (rejected) {
                        reportFailure(mediaSession.sessionId, SIGNALING_ERROR)
                        return@launch
                    }
                    val retry = results.filter { it.second == LocalSignalPublishResult.RETRY }
                        .map { it.first }
                    if (retry.isNotEmpty()) {
                        mediaSession.localSignalMutex.withLock {
                            retry.forEach(mediaSession.pendingLocalSignals::addLast)
                        }
                    }
                }
            } finally {
                mediaSession.localSignalRetryJob.compareAndSet(retryJob, null)
            }
        }
        if (mediaSession.localSignalRetryJob.compareAndSet(null, retryJob)) {
            retryJob.start()
        } else {
            retryJob.cancel()
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

    private fun diagnosticStatus(error: Throwable): String {
        val message = error.message.orEmpty()
        return if (message.startsWith("e2ee_")) message else error.javaClass.simpleName
    }

    private companion object {
        val MEDIA_STATES = setOf(PulseServerCallState.CONNECTING, PulseServerCallState.ACTIVE)
        const val SIGNALING_ERROR = "signaling_error"
        const val MEDIA_ERROR = "media_error"
        const val MAX_PENDING_SIGNALS = 128
        const val ICE_EXPIRY_MARGIN_MILLIS = 5_000L
        const val MINIMUM_ICE_CACHE_MILLIS = 1_000L
        const val MAXIMUM_ICE_CACHE_MILLIS = 60_000L
        const val LOCAL_SIGNAL_RETRY_DELAY_MILLIS = 750L
    }
}
