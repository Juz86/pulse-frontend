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
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpCapabilities
import org.webrtc.RtpReceiver
import org.webrtc.RTCStatsReport
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
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
    private val remoteVideoReported = AtomicBoolean(false)
    private val localVideoReported = AtomicBoolean(false)
    private val transportConnectedReported = AtomicBoolean(false)
    private val statsMonitoringStarted = AtomicBoolean(false)
    private val selectedPathSignature = AtomicReference<String?>(null)
    private val publishLocalSignals = AtomicBoolean(false)
    private val localSignalLock = Any()

    private var config: PulseAudioSessionConfig? = null
    private var listener: PulseCallMediaListener? = null
    private var audioDeviceModule: AudioDeviceModule? = null
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var videoCapturer: CameraVideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private var usingFrontCamera = true
    private var statsJob: Job? = null
    private var connectionFailureJob: Job? = null
    private var preparedLocalOffer: PulseSessionDescription? = null
    private var cameraCaptureStarted = false
    private val pendingLocalIceCandidates: ArrayDeque<PulseIceCandidate> = ArrayDeque()
    private val iceCandidateBuffer = PulseIceCandidateBuffer()

    override val state: StateFlow<PulseMediaState> = mutableState.asStateFlow()

    override suspend fun prepare(
        config: PulseAudioSessionConfig,
        listener: PulseCallMediaListener,
    ) = onMediaThread {
        if (mutableState.value == PulseMediaState.PREPARED) {
            check(this.config == config && this.listener === listener) {
                "Media engine was prepared for a different session"
            }
            return@onMediaThread
        }
        check(mutableState.value == PulseMediaState.NEW) { "Media engine was already prepared" }
        this.config = config
        this.listener = listener

        try {
            prepareResources(config)
            prepareLocalOffer(config)
            updateState(PulseMediaState.PREPARED)
        } catch (error: Throwable) {
            fail("media_prepare_failed")
            releaseResources()
            throw error
        }
    }

    override suspend fun start(
        config: PulseAudioSessionConfig,
        listener: PulseCallMediaListener,
    ) = onMediaThread {
        if (mutableState.value == PulseMediaState.NEW) {
            this.config = config
            this.listener = listener
            try {
                prepareResources(config)
                prepareLocalOffer(config)
                updateState(PulseMediaState.PREPARED)
            } catch (error: Throwable) {
                fail("media_prepare_failed")
                releaseResources()
                throw error
            }
        }
        check(mutableState.value == PulseMediaState.PREPARED) { "Media engine was already started" }
        check(this.config == config && this.listener === listener) {
            "Prepared media session does not match the accepted call"
        }
        updateState(PulseMediaState.STARTING)

        try {
            if (config.role == PulseMediaRole.OFFERER) {
                // The offer was created during ringing. Start its authenticated relay as soon as
                // the call is accepted, while local capture is brought online in parallel.
                publishPreparedLocalOffer()
            }
            audioTrack?.setEnabled(true)
            if (config.mediaType == PulseCallMediaType.VIDEO) {
                videoTrack?.setEnabled(true)
                startCameraCaptureIfNeeded(config.sessionId, "ACCEPTED")
                val localVideoTrack = checkNotNull(videoTrack)
                PulseCallVideoState.begin(config.sessionId, localVideoTrack, usingFrontCamera)
            }
            val connection = peerConnectionOrThrow()
            if (config.role == PulseMediaRole.ANSWERER) {
                checkNotNull(connection.addTrack(checkNotNull(audioTrack), listOf(MEDIA_STREAM_ID))) {
                    "WebRTC could not add the local audio track"
                }
            }
            updateState(PulseMediaState.NEGOTIATING)
            if (config.role == PulseMediaRole.ANSWERER) {
                publishLocalSignals.set(true)
            }
        } catch (error: Throwable) {
            fail("media_start_failed")
            releaseResources()
            throw error
        }
    }

    private fun prepareResources(config: PulseAudioSessionConfig) {
        initializeWebRtc(applicationContext)
        val audioModule = JavaAudioDeviceModule.builder(applicationContext)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .createAudioDeviceModule()
        audioDeviceModule = audioModule

        val factoryBuilder = PeerConnectionFactory.builder().setAudioDeviceModule(audioModule)
        if (config.mediaType == PulseCallMediaType.VIDEO) {
            factoryBuilder
                .setVideoEncoderFactory(DefaultVideoEncoderFactory(
                    PulseCallVideoState.eglContext,
                    true,
                    true,
                ))
                .setVideoDecoderFactory(DefaultVideoDecoderFactory(PulseCallVideoState.eglContext))
        }
        val factory = factoryBuilder.createPeerConnectionFactory()
        peerConnectionFactory = factory

        val source = factory.createAudioSource(MediaConstraints())
        audioSource = source
        audioTrack = factory.createAudioTrack(AUDIO_TRACK_ID, source).apply { setEnabled(false) }

        if (config.mediaType == PulseCallMediaType.VIDEO) {
            val enumerator = Camera2Enumerator(applicationContext)
            val cameraName = enumerator.deviceNames.firstOrNull(enumerator::isFrontFacing)
                ?: enumerator.deviceNames.firstOrNull()
                ?: error("No camera is available")
            usingFrontCamera = enumerator.isFrontFacing(cameraName)
            val capturer = checkNotNull(enumerator.createCapturer(cameraName, null)) {
                "WebRTC could not create a camera capturer"
            }
            val helper = SurfaceTextureHelper.create(
                "pulse-webrtc-camera",
                PulseCallVideoState.eglContext,
            )
            val source = factory.createVideoSource(false)
            capturer.initialize(helper, applicationContext, source.capturerObserver)
            videoCapturer = capturer
            surfaceTextureHelper = helper
            videoSource = source
            videoTrack = factory.createVideoTrack(VIDEO_TRACK_ID, source).apply { setEnabled(false) }
        }

        val rtcConfiguration = PeerConnection.RTCConfiguration(
            config.iceServers.map { it.toWebRtc() },
        ).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.ENABLED
        }
        peerConnection = checkNotNull(
            factory.createPeerConnection(rtcConfiguration, createPeerObserver()),
        ) { "WebRTC could not create a PeerConnection" }
    }

    private suspend fun prepareLocalOffer(config: PulseAudioSessionConfig) {
        if (config.role != PulseMediaRole.OFFERER) return
        val connection = peerConnectionOrThrow()
        checkNotNull(connection.addTrack(checkNotNull(audioTrack), listOf(MEDIA_STREAM_ID))) {
            "WebRTC could not add the prepared local audio track"
        }
        videoTrack?.let { localVideoTrack ->
            val transceiver = connection.addTransceiver(
                localVideoTrack,
                org.webrtc.RtpTransceiver.RtpTransceiverInit(
                    org.webrtc.RtpTransceiver.RtpTransceiverDirection.SEND_RECV,
                    listOf(MEDIA_STREAM_ID),
                ),
            )
            val codecs = checkNotNull(peerConnectionFactory)
                .getRtpSenderCapabilities(MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO)
                .codecs
            check(transceiver.setCodecPreferences(prioritizeVideoCodecs(codecs)).isSuccess) {
                "WebRTC could not apply video codec preferences"
            }
            PulseCallDiagnostics.event(
                "VIDEO_CODEC_PREFERENCES_READY",
                config.sessionId,
                status = codecs.joinToString("+") { it.name },
            )
            // The caller has explicitly initiated a video call. Warming the camera while the
            // track remains disabled avoids exposing media before acceptance and removes the
            // camera/encoder startup from the post-answer critical path.
            startCameraCaptureIfNeeded(config.sessionId, "OUTGOING_PREFETCH")
        }
        PulseCallDiagnostics.event("MEDIA_LOCAL_OFFER_PREPARE_STARTED", config.sessionId)
        preparedLocalOffer = createAndApplyLocalDescription(SessionDescription.Type.OFFER)
        PulseCallDiagnostics.event("MEDIA_LOCAL_OFFER_PREPARE_READY", config.sessionId)
    }

    private fun publishPreparedLocalOffer() {
        val offer = checkNotNull(preparedLocalOffer) { "Prepared caller has no local offer" }
        preparedLocalOffer = null
        listener?.onLocalDescription(offer)
        val candidates = synchronized(localSignalLock) {
            publishLocalSignals.set(true)
            pendingLocalIceCandidates.toList().also { pendingLocalIceCandidates.clear() }
        }
        PulseCallDiagnostics.event(
            "MEDIA_PREPARED_ICE_PUBLISHED",
            config?.sessionId,
            status = candidates.size.toString(),
        )
        candidates.forEach { listener?.onLocalIceCandidate(it) }
    }

    private fun startCameraCaptureIfNeeded(sessionId: String, phase: String) {
        if (cameraCaptureStarted) return
        PulseCallDiagnostics.event("CAMERA_CAPTURE_STARTED", sessionId, status = phase)
        videoCapturer?.startCapture(VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS)
        cameraCaptureStarted = true
        PulseCallDiagnostics.event("CAMERA_CAPTURE_READY", sessionId, status = phase)
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
            reportVideoSdpDirection("REMOTE_VIDEO_SDP_DIRECTION", webRtcDescription.description)
            PulseCallDiagnostics.event(
                "REMOTE_DESCRIPTION_APPLY_STARTED",
                config?.sessionId,
                status = description.type.name,
            )
            peerConnectionOrThrow().setRemoteDescriptionAwait(webRtcDescription)
            PulseCallDiagnostics.event(
                "REMOTE_DESCRIPTION_APPLIED",
                config?.sessionId,
                status = description.type.name,
            )
            if (config?.role == PulseMediaRole.ANSWERER) {
                PulseCallDiagnostics.event(
                    "ANSWER_MEDIA_BINDING_STARTED",
                    config?.sessionId,
                    status = config?.mediaType?.name,
                )
                if (config?.mediaType == PulseCallMediaType.VIDEO) {
                    val localVideoTrack = checkNotNull(videoTrack) {
                        "Video answer has no local camera track"
                    }
                    checkNotNull(
                        peerConnectionOrThrow().addTrack(
                            localVideoTrack,
                            listOf(MEDIA_STREAM_ID),
                        ),
                    ) { "WebRTC could not bind the local camera to the remote video offer" }
                    PulseCallDiagnostics.event(
                        "ANSWER_VIDEO_TRACK_BOUND",
                        config?.sessionId,
                        status = "BOUND",
                    )
                }
                createAndPublishLocalDescription(SessionDescription.Type.ANSWER)
            }
            val bufferedCandidates = iceCandidateBuffer.markRemoteDescriptionApplied()
            PulseCallDiagnostics.event(
                "BUFFERED_ICE_APPLY_STARTED",
                config?.sessionId,
                status = bufferedCandidates.size.toString(),
            )
            bufferedCandidates.forEach {
                applyRemoteIceCandidate(it)
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
        remoteVideoReported.set(false)
        localVideoReported.set(false)
        updateState(PulseMediaState.RECONNECTING)
        peerConnectionOrThrow().restartIce()
        if (config?.role == PulseMediaRole.OFFERER) {
            createAndPublishLocalDescription(SessionDescription.Type.OFFER)
        }
    }

    override suspend fun setMuted(muted: Boolean) = onMediaThread {
        check(mutableState.value !in setOf(
            PulseMediaState.NEW,
            PulseMediaState.PREPARED,
            PulseMediaState.CLOSED,
        )) {
            "Media engine is not active"
        }
        audioTrack?.setEnabled(!muted)
        Unit
    }

    override suspend fun setVideoEnabled(enabled: Boolean): Boolean = onMediaThread {
        val sessionId = config?.sessionId ?: return@onMediaThread false
        val track = videoTrack ?: return@onMediaThread false
        track.setEnabled(enabled)
        PulseCallVideoState.setCameraEnabled(sessionId, enabled)
        true
    }

    override suspend fun switchCamera(): Boolean = onMediaThread {
        val sessionId = config?.sessionId ?: return@onMediaThread false
        val capturer = videoCapturer ?: return@onMediaThread false
        capturer.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
            override fun onCameraSwitchDone(isFrontCamera: Boolean) {
                usingFrontCamera = isFrontCamera
                PulseCallVideoState.setUsingFrontCamera(sessionId, isFrontCamera)
            }

            override fun onCameraSwitchError(errorDescription: String?) {
                PulseCallDiagnostics.event(
                    "CAMERA_SWITCH_FAILED",
                    sessionId,
                    status = errorDescription ?: "UNKNOWN",
                )
            }
        })
        true
    }

    override suspend fun close() {
        if (!closed.compareAndSet(false, true)) return
        statsJob?.cancel()
        connectionFailureJob?.cancel()
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
        listener?.onLocalDescription(createAndApplyLocalDescription(type))
    }

    private suspend fun createAndApplyLocalDescription(
        type: SessionDescription.Type,
    ): PulseSessionDescription {
        val connection = peerConnectionOrThrow()
        val constraints = MediaConstraints()
        if (type == SessionDescription.Type.OFFER) {
            constraints.mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            constraints.mandatory.add(MediaConstraints.KeyValuePair(
                "OfferToReceiveVideo",
                (config?.mediaType == PulseCallMediaType.VIDEO).toString(),
            ))
        }
        PulseCallDiagnostics.event(
            "LOCAL_DESCRIPTION_CREATE_STARTED",
            config?.sessionId,
            status = type.name,
        )
        val description = if (type == SessionDescription.Type.OFFER) {
            connection.createOfferAwait(constraints)
        } else {
            connection.createAnswerAwait(constraints)
        }
        PulseCallDiagnostics.event(
            "LOCAL_DESCRIPTION_CREATE_READY",
            config?.sessionId,
            status = type.name,
        )
        if (
            type == SessionDescription.Type.ANSWER &&
            config?.mediaType == PulseCallMediaType.VIDEO
        ) {
            val direction = videoMediaDirection(description.description)
            PulseCallDiagnostics.event(
                "ANSWER_VIDEO_SDP_DIRECTION",
                config?.sessionId,
                status = videoSdpSummary(description.description),
            )
            check(direction == "SENDRECV") {
                "Video answer did not negotiate bidirectional media"
            }
        }
        val pulseDescription = description.toPulse()
        listener?.onLocalDescriptionPrepared(pulseDescription)
        PulseCallDiagnostics.event(
            "LOCAL_DESCRIPTION_APPLY_STARTED",
            config?.sessionId,
            status = type.name,
        )
        connection.setLocalDescriptionAwait(description)
        PulseCallDiagnostics.event(
            "LOCAL_DESCRIPTION_APPLY_READY",
            config?.sessionId,
            status = type.name,
        )
        reportVideoSdpDirection("LOCAL_VIDEO_SDP_DIRECTION", description.description)
        return pulseDescription
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
                    cancelConnectionFailure()
                    reportTransportConnected()
                    updateState(PulseMediaState.CONNECTED)
                    startStatsMonitoring()
                }
                PeerConnection.IceConnectionState.DISCONNECTED ->
                    updateState(PulseMediaState.RECONNECTING)
                PeerConnection.IceConnectionState.FAILED ->
                    scheduleConnectionFailure("ice_connection_failed")
                PeerConnection.IceConnectionState.CLOSED -> updateState(PulseMediaState.CLOSED)
                else -> Unit
            }
        }

        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
            when (newState) {
                PeerConnection.PeerConnectionState.CONNECTED -> {
                    cancelConnectionFailure()
                    reportTransportConnected()
                    updateState(PulseMediaState.CONNECTED)
                    startStatsMonitoring()
                }
                PeerConnection.PeerConnectionState.DISCONNECTED ->
                    updateState(PulseMediaState.RECONNECTING)
                PeerConnection.PeerConnectionState.FAILED ->
                    scheduleConnectionFailure("peer_connection_failed")
                PeerConnection.PeerConnectionState.CLOSED -> updateState(PulseMediaState.CLOSED)
                else -> Unit
            }
        }

        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
        override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState) = Unit

        override fun onIceCandidate(candidate: IceCandidate) {
            val pulseCandidate = PulseIceCandidate(
                candidate.sdpMid,
                candidate.sdpMLineIndex,
                candidate.sdp,
            )
            val publishNow = synchronized(localSignalLock) {
                if (publishLocalSignals.get()) {
                    true
                } else {
                    pendingLocalIceCandidates.addLast(pulseCandidate)
                    false
                }
            }
            if (publishNow) listener?.onLocalIceCandidate(pulseCandidate)
        }

        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit
        override fun onAddStream(stream: MediaStream) = Unit
        override fun onRemoveStream(stream: MediaStream) = Unit
        override fun onDataChannel(channel: DataChannel) = Unit
        override fun onRenegotiationNeeded() = Unit
        override fun onAddTrack(receiver: RtpReceiver, mediaStreams: Array<out MediaStream>) = Unit
        override fun onTrack(transceiver: org.webrtc.RtpTransceiver) {
            val remoteTrack = transceiver.receiver.track()
            if (remoteTrack?.kind() == MediaStreamTrack.AUDIO_TRACK_KIND) {
                remoteTrack.setEnabled(true)
                if (remoteTrackReported.compareAndSet(false, true)) {
                    PulseCallDiagnostics.event(
                        "REMOTE_AUDIO_TRACK_ENABLED",
                        config?.sessionId,
                        status = "ENABLED",
                    )
                }
            } else if (remoteTrack is VideoTrack) {
                remoteTrack.setEnabled(true)
                config?.sessionId?.let { PulseCallVideoState.setRemoteTrack(it, remoteTrack) }
                PulseCallDiagnostics.event(
                    "REMOTE_VIDEO_TRACK_ENABLED",
                    config?.sessionId,
                    status = "ENABLED",
                )
            }
        }
    }

    private fun startStatsMonitoring() {
        if (closed.get() || !statsMonitoringStarted.compareAndSet(false, true)) return
        statsJob = mediaScope.launch {
            while (isActive && !closed.get()) {
                runCatching { collectAndReportStats() }
                delay(currentStatsIntervalMillis())
            }
        }
    }

    private fun currentStatsIntervalMillis(): Long {
        val videoReady = config?.mediaType != PulseCallMediaType.VIDEO ||
            (remoteVideoReported.get() && localVideoReported.get())
        return if (remoteAudioReported.get() && videoReady) {
            STATS_INTERVAL_MS
        } else {
            INITIAL_STATS_INTERVAL_MS
        }
    }

    private fun reportTransportConnected() {
        if (!transportConnectedReported.compareAndSet(false, true)) return
        PulseCallDiagnostics.event(
            "MEDIA_TRANSPORT_CONNECTED",
            config?.sessionId,
            status = "CONFIRMED",
        )
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
        snapshot.inboundVideo
            ?.takeIf(PulseVideoRtpStats::confirmsVideoFlow)
            ?.let(::reportRemoteVideo)
        snapshot.outboundVideo
            ?.takeIf(PulseVideoRtpStats::confirmsVideoFlow)
            ?.let(::reportLocalVideo)
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

    private fun reportRemoteVideo(stats: PulseVideoRtpStats) {
        if (!remoteVideoReported.compareAndSet(false, true)) return
        PulseCallDiagnostics.event(
            "REMOTE_VIDEO_RTP_RECEIVED",
            config?.sessionId,
            status = "CONFIRMED",
            packetsReceived = stats.packets,
            bytesReceived = stats.bytes,
            frames = stats.frames,
        )
    }

    private fun reportLocalVideo(stats: PulseVideoRtpStats) {
        if (!localVideoReported.compareAndSet(false, true)) return
        PulseCallDiagnostics.event(
            "LOCAL_VIDEO_RTP_SENT",
            config?.sessionId,
            status = "CONFIRMED",
            packetsSent = stats.packets,
            bytesSent = stats.bytes,
            frames = stats.frames,
        )
    }

    private fun reportVideoSdpDirection(event: String, sdp: String) {
        if (config?.mediaType != PulseCallMediaType.VIDEO) return
        PulseCallDiagnostics.event(
            event,
            config?.sessionId,
            status = videoSdpSummary(sdp),
        )
    }

    private fun videoSdpSummary(sdp: String): String {
        val videoSection = sdp.lineSequence()
            .dropWhile { !it.startsWith("m=video ") }
            .takeWhile { !it.startsWith("m=") || it.startsWith("m=video ") }
            .toList()
        if (videoSection.isEmpty()) return "direction=ABSENT"
        val port = videoSection.first().split(' ').getOrNull(1) ?: "UNKNOWN"
        val codecsInOrder = videoSection
            .asSequence()
            .filter { it.startsWith("a=rtpmap:") }
            .mapNotNull { it.substringAfter(' ', "").substringBefore('/').takeIf(String::isNotBlank) }
            .distinct()
            .toList()
        val codecs = codecsInOrder.joinToString("+").ifEmpty { "NONE" }
        val preferred = codecsInOrder.firstOrNull {
            it.lowercase() !in PULSE_AUXILIARY_VIDEO_CODECS
        } ?: "NONE"
        return "direction=${videoMediaDirection(sdp)},port=$port,preferred=$preferred,codecs=$codecs"
    }

    private fun videoMediaDirection(sdp: String): String {
        val videoSection = sdp.lineSequence()
            .dropWhile { !it.startsWith("m=video ") }
            .takeWhile { !it.startsWith("m=") || it.startsWith("m=video ") }
            .toList()
        if (videoSection.isEmpty()) return "ABSENT"
        return videoSection.firstNotNullOfOrNull { line ->
            when (line.trim()) {
                "a=sendrecv" -> "SENDRECV"
                "a=sendonly" -> "SENDONLY"
                "a=recvonly" -> "RECVONLY"
                "a=inactive" -> "INACTIVE"
                else -> null
            }
        } ?: "UNSPECIFIED"
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

    private fun scheduleConnectionFailure(reason: String) {
        updateState(PulseMediaState.RECONNECTING)
        if (connectionFailureJob?.isActive == true) return
        connectionFailureJob = mediaScope.launch {
            delay(CONNECTION_FAILURE_GRACE_MILLIS)
            if (!closed.get() && mutableState.value == PulseMediaState.RECONNECTING) {
                fail(reason)
            }
        }
    }

    private fun cancelConnectionFailure() {
        connectionFailureJob?.cancel()
        connectionFailureJob = null
    }

    private fun releaseResources() {
        val sessionId = config?.sessionId
        audioTrack?.setEnabled(false)
        videoTrack?.setEnabled(false)
        runCatching { videoCapturer?.stopCapture() }
        peerConnection?.close()
        peerConnection?.dispose()
        videoCapturer?.dispose()
        surfaceTextureHelper?.dispose()
        videoTrack?.dispose()
        videoSource?.dispose()
        audioTrack?.dispose()
        audioSource?.dispose()
        peerConnectionFactory?.dispose()
        audioDeviceModule?.release()
        iceCandidateBuffer.clear()
        synchronized(localSignalLock) {
            pendingLocalIceCandidates.clear()
            publishLocalSignals.set(false)
        }
        preparedLocalOffer = null
        cameraCaptureStarted = false
        cancelConnectionFailure()
        peerConnection = null
        audioTrack = null
        audioSource = null
        videoTrack = null
        videoSource = null
        videoCapturer = null
        surfaceTextureHelper = null
        peerConnectionFactory = null
        audioDeviceModule = null
        PulseCallVideoState.clear(sessionId)
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
        private const val VIDEO_TRACK_ID = "pulse-video"
        private const val MEDIA_STREAM_ID = "pulse"
        private const val VIDEO_WIDTH = 720
        private const val VIDEO_HEIGHT = 1280
        private const val VIDEO_FPS = 30
        private const val INITIAL_STATS_INTERVAL_MS = 250L
        private const val STATS_INTERVAL_MS = 2_000L
        private const val STATS_TIMEOUT_MS = 2_000L
        private const val CONNECTION_FAILURE_GRACE_MILLIS = 20_000L
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

private val PULSE_VIDEO_CODEC_PRIORITY = listOf("vp8", "h264", "vp9", "av1", "h265")
private val PULSE_AUXILIARY_VIDEO_CODECS = setOf("rtx", "red", "ulpfec", "flexfec-03")

internal fun prioritizeVideoCodecs(
    codecs: List<RtpCapabilities.CodecCapability>,
): List<RtpCapabilities.CodecCapability> = codecs.withIndex()
    .sortedWith(compareBy<IndexedValue<RtpCapabilities.CodecCapability>>(
        { codec ->
            PULSE_VIDEO_CODEC_PRIORITY.indexOf(codec.value.name.lowercase())
                .takeIf { it >= 0 }
                ?: PULSE_VIDEO_CODEC_PRIORITY.size
        },
        IndexedValue<RtpCapabilities.CodecCapability>::index,
    ))
    .map(IndexedValue<RtpCapabilities.CodecCapability>::value)

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
