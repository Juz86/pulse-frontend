package com.pulsemessenger.chat.call.v2

import android.content.Context
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RTCStatsReport
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.audio.JavaAudioDeviceModule
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class WebRtcAudioEngine(
    context: Context,
) : PulseCallMediaEngine {
    private val applicationContext = context.applicationContext
    private val mediaExecutor = Executors.newSingleThreadExecutor { task ->
        Thread(task, "pulse-webrtc-audio")
    }
    private val mediaDispatcher = mediaExecutor.asCoroutineDispatcher()
    private val mediaScope = CoroutineScope(SupervisorJob() + mediaDispatcher)
    private val mutableState = MutableStateFlow(PulseMediaState.NEW)
    private val closed = AtomicBoolean(false)
    private val remoteTrackReported = AtomicBoolean(false)
    private val remoteAudioReported = AtomicBoolean(false)
    private val statsMonitoringStarted = AtomicBoolean(false)
    private val selectedPathSignature = AtomicReference<String?>(null)

    private var config: PulseAudioSessionConfig? = null
    private var listener: PulseCallMediaListener? = null
    private var audioDeviceModule: AudioDeviceModule? = null
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var statsJob: Job? = null
    private val iceCandidateBuffer = PulseIceCandidateBuffer()

    override val state: StateFlow<PulseMediaState> = mutableState.asStateFlow()

    override suspend fun start(
        config: PulseAudioSessionConfig,
        listener: PulseCallMediaListener,
    ) = onMediaThread {
        check(mutableState.value == PulseMediaState.NEW) { "Media engine was already started" }
        updateState(PulseMediaState.STARTING)
        this.config = config
        this.listener = listener

        try {
            initializeWebRtc(applicationContext)
            val audioModule = JavaAudioDeviceModule.builder(applicationContext)
                .setUseHardwareAcousticEchoCanceler(true)
                .setUseHardwareNoiseSuppressor(true)
                .createAudioDeviceModule()
            audioDeviceModule = audioModule

            val factory = PeerConnectionFactory.builder()
                .setAudioDeviceModule(audioModule)
                .createPeerConnectionFactory()
            peerConnectionFactory = factory

            val source = factory.createAudioSource(MediaConstraints())
            audioSource = source
            val track = factory.createAudioTrack(AUDIO_TRACK_ID, source).apply {
                setEnabled(true)
            }
            audioTrack = track

            val rtcConfiguration = PeerConnection.RTCConfiguration(
                config.iceServers.map { it.toWebRtc() },
            ).apply {
                sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
                bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
                rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
                continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
                tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.ENABLED
            }
            val connection = checkNotNull(
                factory.createPeerConnection(rtcConfiguration, createPeerObserver()),
            ) { "WebRTC could not create a PeerConnection" }
            peerConnection = connection
            checkNotNull(connection.addTrack(track, listOf(MEDIA_STREAM_ID))) {
                "WebRTC could not add the local audio track"
            }

            updateState(PulseMediaState.NEGOTIATING)
            if (config.role == PulseMediaRole.OFFERER) {
                createAndPublishLocalDescription(SessionDescription.Type.OFFER)
            }
        } catch (error: Throwable) {
            fail("media_start_failed")
            releaseResources()
            throw error
        }
    }

    override suspend fun applyRemoteDescription(description: PulseSessionDescription) =
        onMediaThread {
            ensureNegotiating()
            val expectedType = when (config?.role) {
                PulseMediaRole.OFFERER -> PulseSessionDescriptionType.ANSWER
                PulseMediaRole.ANSWERER -> PulseSessionDescriptionType.OFFER
                null -> error("Media engine has no active configuration")
            }
            require(description.type == expectedType) {
                "Unexpected remote session description type"
            }
            val webRtcDescription = SessionDescription(
                description.type.toWebRtc(),
                description.value,
            )
            peerConnectionOrThrow().setRemoteDescriptionAwait(webRtcDescription)
            iceCandidateBuffer.markRemoteDescriptionApplied().forEach {
                applyRemoteIceCandidate(it)
            }
            if (config?.role == PulseMediaRole.ANSWERER) {
                createAndPublishLocalDescription(SessionDescription.Type.ANSWER)
            }
        }

    override suspend fun addRemoteIceCandidate(candidate: PulseIceCandidate) = onMediaThread {
        ensureNegotiating()
        iceCandidateBuffer.offer(candidate)?.let(::applyRemoteIceCandidate)
        Unit
    }

    override suspend fun restartIce() = onMediaThread {
        ensureNegotiating()
        iceCandidateBuffer.clear()
        remoteAudioReported.set(false)
        updateState(PulseMediaState.RECONNECTING)
        peerConnectionOrThrow().restartIce()
        if (config?.role == PulseMediaRole.OFFERER) {
            createAndPublishLocalDescription(SessionDescription.Type.OFFER)
        }
    }

    override suspend fun setMuted(muted: Boolean) = onMediaThread {
        check(mutableState.value !in setOf(PulseMediaState.NEW, PulseMediaState.CLOSED)) {
            "Media engine is not active"
        }
        audioTrack?.setEnabled(!muted)
        Unit
    }

    override suspend fun close() {
        if (!closed.compareAndSet(false, true)) return
        statsJob?.cancel()
        withContext(mediaDispatcher) {
            releaseResources()
            updateState(PulseMediaState.CLOSED)
            listener = null
            config = null
        }
        mediaScope.cancel()
        mediaDispatcher.close()
        mediaExecutor.shutdown()
    }

    private suspend fun createAndPublishLocalDescription(type: SessionDescription.Type) {
        val connection = peerConnectionOrThrow()
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
        }
        val description = if (type == SessionDescription.Type.OFFER) {
            connection.createOfferAwait(constraints)
        } else {
            connection.createAnswerAwait(constraints)
        }
        connection.setLocalDescriptionAwait(description)
        listener?.onLocalDescription(description.toPulse())
    }

    private fun applyRemoteIceCandidate(candidate: PulseIceCandidate) {
        check(
            peerConnectionOrThrow().addIceCandidate(
                IceCandidate(candidate.mediaStreamId, candidate.mediaLineIndex, candidate.value),
            ),
        ) { "WebRTC rejected a remote ICE candidate" }
    }

    private fun createPeerObserver() = object : PeerConnection.Observer {
        override fun onSignalingChange(newState: PeerConnection.SignalingState) = Unit

        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState) {
            when (newState) {
                PeerConnection.IceConnectionState.CONNECTED,
                PeerConnection.IceConnectionState.COMPLETED -> {
                    updateState(PulseMediaState.CONNECTED)
                    startStatsMonitoring()
                }
                PeerConnection.IceConnectionState.DISCONNECTED ->
                    updateState(PulseMediaState.RECONNECTING)
                PeerConnection.IceConnectionState.FAILED -> fail("ice_connection_failed")
                PeerConnection.IceConnectionState.CLOSED -> updateState(PulseMediaState.CLOSED)
                else -> Unit
            }
        }

        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
            when (newState) {
                PeerConnection.PeerConnectionState.CONNECTED -> {
                    updateState(PulseMediaState.CONNECTED)
                    startStatsMonitoring()
                }
                PeerConnection.PeerConnectionState.DISCONNECTED ->
                    updateState(PulseMediaState.RECONNECTING)
                PeerConnection.PeerConnectionState.FAILED -> fail("peer_connection_failed")
                PeerConnection.PeerConnectionState.CLOSED -> updateState(PulseMediaState.CLOSED)
                else -> Unit
            }
        }

        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
        override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState) = Unit

        override fun onIceCandidate(candidate: IceCandidate) {
            listener?.onLocalIceCandidate(
                PulseIceCandidate(candidate.sdpMid, candidate.sdpMLineIndex, candidate.sdp),
            )
        }

        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit
        override fun onAddStream(stream: MediaStream) = Unit
        override fun onRemoveStream(stream: MediaStream) = Unit
        override fun onDataChannel(channel: DataChannel) = Unit
        override fun onRenegotiationNeeded() = Unit
        override fun onAddTrack(receiver: RtpReceiver, mediaStreams: Array<out MediaStream>) = Unit
        override fun onTrack(transceiver: org.webrtc.RtpTransceiver) {
            if (transceiver.receiver.track()?.kind() == MediaStreamTrack.AUDIO_TRACK_KIND) {
                transceiver.receiver.track()?.setEnabled(true)
                if (remoteTrackReported.compareAndSet(false, true)) {
                    PulseCallDiagnostics.event(
                        "REMOTE_AUDIO_TRACK_ENABLED",
                        config?.sessionId,
                        status = "ENABLED",
                    )
                }
            }
        }
    }

    private fun startStatsMonitoring() {
        if (closed.get() || !statsMonitoringStarted.compareAndSet(false, true)) return
        statsJob = mediaScope.launch {
            while (isActive && !closed.get()) {
                runCatching { collectAndReportStats() }
                delay(STATS_INTERVAL_MS)
            }
        }
    }

    private suspend fun collectAndReportStats() {
        val connection = peerConnection ?: return
        val report = withTimeoutOrNull(STATS_TIMEOUT_MS) { connection.getStatsAwait() } ?: return
        val snapshot = PulseWebRtcStatsAnalyzer.analyze(
            report.statsMap.values.map { stat ->
                PulseRtcStat(stat.id, stat.type, stat.members)
            },
        )
        snapshot.selectedIcePath?.let(::reportSelectedPath)
        snapshot.inboundAudio
            ?.takeIf(PulseInboundAudioStats::confirmsAudioFlow)
            ?.let(::reportRemoteAudio)
    }

    private fun reportSelectedPath(path: PulseSelectedIcePath) {
        val signature = listOf(
            path.transport.name,
            path.localCandidateType,
            path.remoteCandidateType,
        ).joinToString(":")
        if (selectedPathSignature.getAndSet(signature) == signature) return
        PulseCallDiagnostics.event(
            "ICE_SELECTED_PATH",
            config?.sessionId,
            status = "SELECTED",
            transport = path.transport.name,
            localCandidateType = path.localCandidateType,
            remoteCandidateType = path.remoteCandidateType,
        )
    }

    private fun reportRemoteAudio(stats: PulseInboundAudioStats) {
        if (!remoteAudioReported.compareAndSet(false, true)) return
        PulseCallDiagnostics.event(
            "REMOTE_AUDIO_RTP_RECEIVED",
            config?.sessionId,
            status = "CONFIRMED",
            packetsReceived = stats.packetsReceived,
            bytesReceived = stats.bytesReceived,
        )
    }

    private fun ensureNegotiating() {
        check(mutableState.value in setOf(
            PulseMediaState.NEGOTIATING,
            PulseMediaState.CONNECTED,
            PulseMediaState.RECONNECTING,
        )) { "Media engine is not negotiating" }
    }

    private fun peerConnectionOrThrow(): PeerConnection =
        checkNotNull(peerConnection) { "Media engine has no PeerConnection" }

    private fun updateState(state: PulseMediaState) {
        if (mutableState.value == state) return
        mutableState.value = state
        listener?.onMediaStateChanged(state)
    }

    private fun fail(reason: String) {
        updateState(PulseMediaState.FAILED)
        listener?.onMediaFailure(reason)
    }

    private fun releaseResources() {
        audioTrack?.setEnabled(false)
        peerConnection?.close()
        peerConnection?.dispose()
        audioTrack?.dispose()
        audioSource?.dispose()
        peerConnectionFactory?.dispose()
        audioDeviceModule?.release()
        iceCandidateBuffer.clear()
        peerConnection = null
        audioTrack = null
        audioSource = null
        peerConnectionFactory = null
        audioDeviceModule = null
    }

    private suspend fun <T> onMediaThread(block: suspend () -> T): T {
        check(!closed.get()) { "Media engine is closed" }
        return withContext(mediaDispatcher) { block() }
    }

    private fun PulseIceServer.toWebRtc(): PeerConnection.IceServer =
        PeerConnection.IceServer.builder(urls)
            .apply {
                username?.let(::setUsername)
                credential?.let(::setPassword)
            }
            .createIceServer()

    private fun PulseSessionDescriptionType.toWebRtc(): SessionDescription.Type = when (this) {
        PulseSessionDescriptionType.OFFER -> SessionDescription.Type.OFFER
        PulseSessionDescriptionType.ANSWER -> SessionDescription.Type.ANSWER
    }

    private fun SessionDescription.toPulse() = PulseSessionDescription(
        type = when (type) {
            SessionDescription.Type.OFFER -> PulseSessionDescriptionType.OFFER
            SessionDescription.Type.ANSWER -> PulseSessionDescriptionType.ANSWER
            else -> error("Unsupported local session description type")
        },
        value = description,
    )

    companion object {
        private const val AUDIO_TRACK_ID = "pulse-audio"
        private const val MEDIA_STREAM_ID = "pulse"
        private const val STATS_INTERVAL_MS = 2_000L
        private const val STATS_TIMEOUT_MS = 2_000L
        private val initialized = AtomicBoolean(false)

        private fun initializeWebRtc(context: Context) {
            if (initialized.compareAndSet(false, true)) {
                try {
                    PeerConnectionFactory.initialize(
                        PeerConnectionFactory.InitializationOptions.builder(context)
                            .setEnableInternalTracer(false)
                            .createInitializationOptions(),
                    )
                } catch (error: Throwable) {
                    initialized.set(false)
                    throw error
                }
            }
        }
    }
}

private suspend fun PeerConnection.createOfferAwait(
    constraints: MediaConstraints,
): SessionDescription = suspendCancellableCoroutine { continuation ->
    createOffer(continuation.sdpObserver(), constraints)
}

private suspend fun PeerConnection.createAnswerAwait(
    constraints: MediaConstraints,
): SessionDescription = suspendCancellableCoroutine { continuation ->
    createAnswer(continuation.sdpObserver(), constraints)
}

private suspend fun PeerConnection.setLocalDescriptionAwait(description: SessionDescription) =
    suspendCancellableCoroutine { continuation ->
        setLocalDescription(continuation.setDescriptionObserver(), description)
    }

private suspend fun PeerConnection.setRemoteDescriptionAwait(description: SessionDescription) =
    suspendCancellableCoroutine { continuation ->
        setRemoteDescription(continuation.setDescriptionObserver(), description)
    }

private suspend fun PeerConnection.getStatsAwait(): RTCStatsReport =
    suspendCancellableCoroutine { continuation ->
        getStats { report ->
            if (continuation.isActive) continuation.resume(report)
        }
    }

private fun kotlinx.coroutines.CancellableContinuation<SessionDescription>.sdpObserver() =
    object : SdpObserver {
        override fun onCreateSuccess(description: SessionDescription) {
            if (isActive) resume(description)
        }

        override fun onSetSuccess() = Unit

        override fun onCreateFailure(error: String) {
            if (isActive) resumeWithException(IllegalStateException("WebRTC SDP creation failed: $error"))
        }

        override fun onSetFailure(error: String) = Unit
    }

private fun kotlinx.coroutines.CancellableContinuation<Unit>.setDescriptionObserver() =
    object : SdpObserver {
        override fun onCreateSuccess(description: SessionDescription) = Unit

        override fun onSetSuccess() {
            if (isActive) resume(Unit)
        }

        override fun onCreateFailure(error: String) = Unit

        override fun onSetFailure(error: String) {
            if (isActive) resumeWithException(IllegalStateException("WebRTC SDP application failed: $error"))
        }
    }
