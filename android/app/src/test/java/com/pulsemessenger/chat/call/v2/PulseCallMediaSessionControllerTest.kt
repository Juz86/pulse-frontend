package com.pulsemessenger.chat.call.v2

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseCallMediaSessionControllerTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

    @Test
    fun `media cannot start before the server accepts the call`() = runBlocking {
        val signaling = FakeSignaling()
        val engine = FakeMediaEngine()
        val callbacks = RecordingCallbacks()
        val subject = subject(signaling, engine, callbacks)

        assertFalse(subject.start(session(PulseServerCallState.RINGING), "caller"))
        assertTrue(signaling.operations.isEmpty())
        assertNull(engine.config)
    }

    @Test
    fun `caller obtains TURN before starting WebRTC as offerer`() = runBlocking {
        val order = mutableListOf<String>()
        val signaling = FakeSignaling(order)
        val engine = FakeMediaEngine(order)
        val subject = subject(signaling, engine, RecordingCallbacks())

        assertTrue(subject.start(session(PulseServerCallState.CONNECTING), "caller"))

        assertEquals(listOf("ice", "engine:start"), order)
        assertEquals(PulseMediaRole.OFFERER, engine.config?.role)
        assertEquals("turns:turn.cloudflare.com:443?transport=tcp", engine.config?.iceServers?.single()?.urls?.single())
    }

    @Test
    fun `callee starts WebRTC as answerer and a repeated start is idempotent`() = runBlocking {
        val signaling = FakeSignaling()
        val engine = FakeMediaEngine()
        val subject = subject(signaling, engine, RecordingCallbacks())

        assertTrue(subject.start(session(PulseServerCallState.CONNECTING), "callee"))
        assertTrue(subject.start(session(PulseServerCallState.ACTIVE), "callee"))

        assertEquals(PulseMediaRole.ANSWERER, engine.config?.role)
        assertEquals(1, engine.startCount)
        assertEquals(1, signaling.operations.count { it == "ice" })
    }

    @Test
    fun `local SDP and ICE use unique acknowledged Railway messages`() = runBlocking {
        val signaling = FakeSignaling()
        val engine = FakeMediaEngine()
        val subject = subject(
            signaling,
            engine,
            RecordingCallbacks(),
            messageIds = ArrayDeque(listOf("message-123", "message-456")),
        )
        subject.start(session(PulseServerCallState.CONNECTING), "caller")

        engine.listener?.onLocalDescription(
            PulseSessionDescription(PulseSessionDescriptionType.OFFER, "v=0"),
        )
        engine.listener?.onLocalIceCandidate(PulseIceCandidate("audio", 0, "candidate:value"))

        assertEquals(listOf("message-123"), signaling.descriptions.map { it.first })
        assertEquals(listOf("message-456"), signaling.candidates.map { it.first })
    }

    @Test
    fun `remote media is session-bound and cannot come from the local user`() = runBlocking {
        val signaling = FakeSignaling()
        val engine = FakeMediaEngine()
        val subject = subject(signaling, engine, RecordingCallbacks())
        subject.start(session(PulseServerCallState.CONNECTING), "caller")
        val answer = PulseRemoteDescriptionSignal(
            sessionId = "session-123",
            messageId = "message-123",
            senderUid = "callee",
            description = PulseSessionDescription(PulseSessionDescriptionType.ANSWER, "v=0"),
        )

        assertTrue(subject.handleRemote(answer))
        assertFalse(subject.handleRemote(answer.copy(sessionId = "other-session")))
        assertFalse(subject.handleRemote(answer.copy(senderUid = "caller")))

        assertEquals(1, engine.remoteDescriptions.size)
    }

    @Test
    fun `remote media received during startup is applied in order after engine is ready`() = runBlocking {
        val engine = FakeMediaEngine().apply {
            startGate = CompletableDeferred()
        }
        val subject = subject(FakeSignaling(), engine, RecordingCallbacks())
        val starting = async {
            subject.start(session(PulseServerCallState.CONNECTING), "caller")
        }
        yield()

        val answer = PulseRemoteDescriptionSignal(
            sessionId = "session-123",
            messageId = "message-123",
            senderUid = "callee",
            description = PulseSessionDescription(PulseSessionDescriptionType.ANSWER, "v=0"),
        )
        val candidate = PulseRemoteIceCandidateSignal(
            sessionId = "session-123",
            messageId = "message-456",
            senderUid = "callee",
            candidate = PulseIceCandidate("audio", 0, "candidate:value"),
        )

        assertTrue(subject.handleRemote(answer))
        assertTrue(subject.handleRemote(candidate))
        assertTrue(engine.remoteDescriptions.isEmpty())
        assertTrue(engine.remoteCandidates.isEmpty())

        engine.startGate?.complete(Unit)
        assertTrue(starting.await())

        assertEquals(listOf(answer.description), engine.remoteDescriptions)
        assertEquals(listOf(candidate.candidate), engine.remoteCandidates)
    }

    @Test
    fun `connected and reconnecting lifecycle callbacks are idempotent`() = runBlocking {
        val signaling = FakeSignaling()
        val engine = FakeMediaEngine()
        val callbacks = RecordingCallbacks()
        val subject = subject(signaling, engine, callbacks)
        subject.start(session(PulseServerCallState.CONNECTING), "caller")

        engine.listener?.onMediaStateChanged(PulseMediaState.CONNECTED)
        engine.listener?.onMediaStateChanged(PulseMediaState.CONNECTED)
        engine.listener?.onMediaStateChanged(PulseMediaState.RECONNECTING)
        engine.listener?.onMediaStateChanged(PulseMediaState.RECONNECTING)
        engine.listener?.onMediaStateChanged(PulseMediaState.CONNECTED)

        assertEquals(listOf("session-123", "session-123"), callbacks.connected)
        assertEquals(listOf("session-123"), callbacks.reconnecting)
    }

    @Test
    fun `signaling failure is reported once without leaking media content`() = runBlocking {
        val signaling = FakeSignaling().apply {
            mediaResponse = PulseSignalingResponse(false, PulseSignalingStatus.SERVICE_UNAVAILABLE)
        }
        val engine = FakeMediaEngine()
        val callbacks = RecordingCallbacks()
        val subject = subject(signaling, engine, callbacks)
        subject.start(session(PulseServerCallState.CONNECTING), "caller")

        engine.listener?.onLocalDescription(
            PulseSessionDescription(PulseSessionDescriptionType.OFFER, "private-sdp"),
        )
        engine.listener?.onLocalIceCandidate(
            PulseIceCandidate("audio", 0, "private-candidate"),
        )

        assertEquals(listOf("session-123" to "signaling_error"), callbacks.failures)
        assertFalse(callbacks.toString().contains("private-sdp"))
        assertFalse(callbacks.toString().contains("private-candidate"))
    }

    @Test
    fun `close releases the engine exactly once`() = runBlocking {
        val engine = FakeMediaEngine()
        val subject = subject(FakeSignaling(), engine, RecordingCallbacks())
        subject.start(session(PulseServerCallState.CONNECTING), "caller")

        subject.close("session-123")
        subject.close("session-123")

        assertEquals(1, engine.closeCount)
    }

    @Test
    fun `mute controls the active WebRTC audio track and remains session bound`() = runBlocking {
        val engine = FakeMediaEngine()
        val subject = subject(FakeSignaling(), engine, RecordingCallbacks())
        subject.start(session(PulseServerCallState.CONNECTING), "caller")

        assertTrue(subject.setMuted("session-123", true))
        assertFalse(subject.setMuted("other-session", false))
        assertTrue(subject.setMuted("session-123", false))

        assertEquals(listOf(true, false), engine.muteChanges)
    }

    private fun subject(
        signaling: FakeSignaling,
        engine: FakeMediaEngine,
        callbacks: RecordingCallbacks,
        messageIds: ArrayDeque<String> = ArrayDeque(listOf("message-123", "message-456")),
    ) = PulseCallMediaSessionController(
        scope = scope,
        signaling = signaling,
        engineFactory = PulseCallMediaEngineFactory { engine },
        callbacks = callbacks,
        createMessageId = { messageIds.removeFirst() },
    )

    private fun session(state: PulseServerCallState) = PulseServerCallSession(
        protocolVersion = PULSE_CALL_PROTOCOL_VERSION,
        sessionId = "session-123",
        requestId = "request-123",
        callerUid = "caller",
        calleeUid = "callee",
        mediaType = PulseCallMediaType.AUDIO,
        state = state,
        revision = 3,
        mediaReadyUids = emptySet(),
        terminalReason = null,
        terminalByUid = null,
    )

    private class FakeSignaling(
        private val sharedOperations: MutableList<String> = mutableListOf(),
    ) : PulseCallSignalingGateway {
        val operations: List<String> get() = sharedOperations
        val descriptions = mutableListOf<Pair<String, PulseSessionDescription>>()
        val candidates = mutableListOf<Pair<String, PulseIceCandidate>>()
        var mediaResponse = PulseSignalingResponse(true, PulseSignalingStatus.RELAYED)
        var iceResponse = PulseIceConfigurationResponse(
            ok = true,
            status = PulseSignalingStatus.FOUND,
            iceServers = listOf(
                PulseIceServer(
                    urls = listOf("turns:turn.cloudflare.com:443?transport=tcp"),
                    username = "temporary-user",
                    credential = "temporary-secret",
                ),
            ),
            expiresInSeconds = 7200,
        )

        override suspend fun connect(authToken: String, listener: PulseCallSignalingListener) = Unit

        override suspend fun startCall(
            requestId: String,
            calleeUid: String,
            mediaType: PulseCallMediaType,
        ) = PulseSignalingResponse(false, PulseSignalingStatus.SERVICE_UNAVAILABLE)

        override suspend fun sendCommand(
            sessionId: String,
            eventId: String,
            expectedRevision: Long,
            command: PulseSignalingCommand,
            reason: String?,
            installationId: String?,
        ) = PulseSignalingResponse(false, PulseSignalingStatus.SERVICE_UNAVAILABLE)

        override suspend fun fetchSnapshot(sessionId: String) =
            PulseSignalingResponse(false, PulseSignalingStatus.SERVICE_UNAVAILABLE)

        override suspend fun fetchIceConfiguration(sessionId: String): PulseIceConfigurationResponse {
            sharedOperations += "ice"
            return iceResponse
        }

        override suspend fun sendDescription(
            sessionId: String,
            messageId: String,
            description: PulseSessionDescription,
        ): PulseSignalingResponse {
            descriptions += messageId to description
            return mediaResponse
        }

        override suspend fun sendIceCandidate(
            sessionId: String,
            messageId: String,
            candidate: PulseIceCandidate,
        ): PulseSignalingResponse {
            candidates += messageId to candidate
            return mediaResponse
        }

        override fun disconnect() = Unit
    }

    private class FakeMediaEngine(
        private val sharedOperations: MutableList<String> = mutableListOf(),
    ) : PulseCallMediaEngine {
        private val mutableState = MutableStateFlow(PulseMediaState.NEW)
        override val state: StateFlow<PulseMediaState> = mutableState
        var config: PulseAudioSessionConfig? = null
        var listener: PulseCallMediaListener? = null
        var startCount = 0
        var closeCount = 0
        val muteChanges = mutableListOf<Boolean>()
        var startGate: CompletableDeferred<Unit>? = null
        val remoteDescriptions = mutableListOf<PulseSessionDescription>()
        val remoteCandidates = mutableListOf<PulseIceCandidate>()

        override suspend fun start(config: PulseAudioSessionConfig, listener: PulseCallMediaListener) {
            sharedOperations += "engine:start"
            this.config = config
            this.listener = listener
            startCount += 1
            startGate?.await()
            mutableState.value = PulseMediaState.NEGOTIATING
        }

        override suspend fun applyRemoteDescription(description: PulseSessionDescription) {
            remoteDescriptions += description
        }

        override suspend fun addRemoteIceCandidate(candidate: PulseIceCandidate) {
            remoteCandidates += candidate
        }

        override suspend fun restartIce() {
            mutableState.value = PulseMediaState.RECONNECTING
        }

        override suspend fun setMuted(muted: Boolean) {
            muteChanges += muted
        }

        override suspend fun close() {
            closeCount += 1
            mutableState.value = PulseMediaState.CLOSED
        }
    }

    private class RecordingCallbacks : PulseCallMediaSessionCallbacks {
        val connected = mutableListOf<String>()
        val reconnecting = mutableListOf<String>()
        val failures = mutableListOf<Pair<String, String>>()

        override fun onMediaConnected(sessionId: String) {
            connected += sessionId
        }

        override fun onMediaReconnecting(sessionId: String) {
            reconnecting += sessionId
        }

        override fun onMediaFailure(sessionId: String, reason: String) {
            failures += sessionId to reason
        }
    }
}
