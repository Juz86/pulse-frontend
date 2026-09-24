package com.pulsemessenger.chat.call.v2

import io.socket.client.Socket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RailwayCallSignalingClientTest {
    @Test
    fun `connect authenticates socket and reports connection`() = runBlocking {
        val socket = FakeRailwayCallSocket()
        val factory = RecordingSocketFactory(socket)
        val listener = RecordingListener()
        val client = client(factory)

        client.connect("firebase-token", listener)

        assertEquals("firebase-token", factory.authToken)
        assertEquals(listOf(true), listener.connections)
        assertTrue(socket.connected())
    }

    @Test
    fun `start call uses exact Railway event and decodes acknowledgement`() = runBlocking {
        val socket = FakeRailwayCallSocket().apply {
            onEmission = { event, _, acknowledgement ->
                assertEquals(RailwayCallingV2Codec.EVENT_START, event)
                acknowledgement(arrayOf(response(session(revision = 1))))
            }
        }
        val client = client(RecordingSocketFactory(socket))
        client.connect("firebase-token", RecordingListener())

        val response = client.startCall("request-123", "callee", PulseCallMediaType.AUDIO)

        assertTrue(response.ok)
        assertEquals(PulseSignalingStatus.CREATED, response.status)
        assertEquals("session-123", response.session?.sessionId)
    }

    @Test
    fun `acknowledgement timeout retries identical event id`() = runBlocking {
        var attempt = 0
        val eventIds = mutableListOf<String>()
        val socket = FakeRailwayCallSocket().apply {
            onEmission = { _, payload, acknowledgement ->
                attempt += 1
                eventIds += payload.getString("eventId")
                if (attempt == 2) acknowledgement(arrayOf(response(session(revision = 2))))
            }
        }
        val client = RailwayCallSignalingClient(
            socketFactory = RecordingSocketFactory(socket),
            acknowledgementTimeoutMs = 100,
            acknowledgementAttempts = 2,
        )
        client.connect("firebase-token", RecordingListener())

        val response = client.sendCommand(
            sessionId = "session-123",
            eventId = "event-unchanged",
            expectedRevision = 1,
            command = PulseSignalingCommand.INVITE_READY,
        )

        assertTrue(response.ok)
        assertEquals(listOf("event-unchanged", "event-unchanged"), eventIds)
    }

    @Test
    fun `reconnect fetches authoritative snapshot for active session`() = runBlocking {
        val listener = RecordingListener(expectedUpdates = 1)
        val socket = FakeRailwayCallSocket().apply {
            onEmission = { event, _, acknowledgement ->
                val revision = if (event == RailwayCallingV2Codec.EVENT_START) 1L else 2L
                acknowledgement(arrayOf(response(session(revision))))
            }
        }
        val client = client(RecordingSocketFactory(socket))
        client.connect("firebase-token", listener)
        client.startCall("request-123", "callee", PulseCallMediaType.AUDIO)

        socket.trigger(Socket.EVENT_DISCONNECT)
        socket.trigger(Socket.EVENT_CONNECT)

        assertTrue(listener.awaitUpdates())
        assertEquals(listOf(true, false, true), listener.connections)
        assertEquals(2L, listener.sessions.single().revision)
        assertEquals(
            RailwayCallingV2Codec.EVENT_SNAPSHOT,
            socket.emissions.last().first,
        )
    }

    @Test
    fun `commands fail closed while disconnected`() = runBlocking {
        val socket = FakeRailwayCallSocket()
        val client = client(RecordingSocketFactory(socket))
        client.connect("firebase-token", RecordingListener())
        client.disconnect()

        val response = client.fetchSnapshot("session-123")

        assertFalse(response.ok)
        assertEquals(PulseSignalingStatus.SERVICE_UNAVAILABLE, response.status)
    }

    @Test
    fun `ICE configuration uses the session-bound Railway event`() = runBlocking {
        val socket = FakeRailwayCallSocket().apply {
            onEmission = { event, payload, acknowledgement ->
                assertEquals(RailwayCallingV2Codec.EVENT_ICE_CONFIG, event)
                assertEquals("session-123", payload.getString("sessionId"))
                acknowledgement(
                    arrayOf(
                        JSONObject()
                            .put("ok", true)
                            .put("status", "FOUND")
                            .put("expiresInSeconds", 7200)
                            .put(
                                "iceServers",
                                JSONArray().put(
                                    JSONObject()
                                        .put("urls", JSONArray().put("turns:turn.cloudflare.com:443?transport=tcp"))
                                        .put("username", "temporary-user")
                                        .put("credential", "temporary-secret"),
                                ),
                            ),
                    ),
                )
            }
        }
        val client = client(RecordingSocketFactory(socket))
        client.connect("firebase-token", RecordingListener())

        val response = client.fetchIceConfiguration("session-123")

        assertTrue(response.ok)
        assertEquals(7200, response.expiresInSeconds)
        assertEquals("temporary-user", response.iceServers.single().username)
    }

    @Test
    fun `local description and ICE candidate use acknowledged media messages`() = runBlocking {
        val socket = FakeRailwayCallSocket().apply {
            onEmission = { event, _, acknowledgement ->
                assertEquals(RailwayCallingV2Codec.EVENT_MEDIA, event)
                acknowledgement(arrayOf(JSONObject().put("ok", true).put("status", "RELAYED")))
            }
        }
        val client = client(RecordingSocketFactory(socket))
        client.connect("firebase-token", RecordingListener())

        val offer = client.sendDescription(
            "session-123",
            "message-123",
            PulseSessionDescription(PulseSessionDescriptionType.OFFER, "v=0"),
        )
        val candidate = client.sendIceCandidate(
            "session-123",
            "message-456",
            PulseIceCandidate("audio", 0, "candidate:value"),
        )

        assertEquals(PulseSignalingStatus.RELAYED, offer.status)
        assertEquals(PulseSignalingStatus.RELAYED, candidate.status)
        assertEquals("offer", socket.emissions[0].second.getString("type"))
        assertEquals("candidate", socket.emissions[1].second.getString("type"))
    }

    @Test
    fun `incoming media is session-bound and duplicate message ids are ignored`() = runBlocking {
        val listener = RecordingListener()
        val socket = FakeRailwayCallSocket().apply {
            onEmission = { event, _, acknowledgement ->
                if (event == RailwayCallingV2Codec.EVENT_START) {
                    acknowledgement(arrayOf(response(session(revision = 1))))
                }
            }
        }
        val client = client(RecordingSocketFactory(socket))
        client.connect("firebase-token", listener)
        client.startCall("request-123", "callee", PulseCallMediaType.AUDIO)
        val signal = JSONObject()
            .put("protocolVersion", 2)
            .put("sessionId", "session-123")
            .put("messageId", "message-123")
            .put("senderUid", "callee")
            .put("type", "answer")
            .put("description", "v=0")

        socket.trigger(RailwayCallingV2Codec.EVENT_MEDIA, signal)
        socket.trigger(RailwayCallingV2Codec.EVENT_MEDIA, signal)
        socket.trigger(
            RailwayCallingV2Codec.EVENT_MEDIA,
            JSONObject(signal.toString())
                .put("sessionId", "different-session")
                .put("messageId", "message-456"),
        )

        assertEquals(1, listener.mediaSignals.size)
        assertEquals(
            PulseSessionDescriptionType.ANSWER,
            (listener.mediaSignals.single() as PulseRemoteDescriptionSignal).description.type,
        )
    }

    private fun client(factory: RailwayCallSocketFactory) = RailwayCallSignalingClient(
        socketFactory = factory,
        acknowledgementTimeoutMs = 25,
        acknowledgementAttempts = 2,
    )

    private fun response(session: JSONObject) = JSONObject()
        .put("ok", true)
        .put("status", if (session.getLong("revision") == 1L) "CREATED" else "FOUND")
        .put("session", session)

    private fun session(revision: Long) = JSONObject()
        .put("protocolVersion", PULSE_CALL_PROTOCOL_VERSION)
        .put("sessionId", "session-123")
        .put("requestId", "request-123")
        .put("callerUid", "caller")
        .put("calleeUid", "callee")
        .put("mediaType", "audio")
        .put("state", "PREPARING")
        .put("revision", revision)
        .put("mediaReadyUids", JSONArray())
        .put("terminalReason", JSONObject.NULL)
        .put("terminalByUid", JSONObject.NULL)

    private class RecordingSocketFactory(
        private val socket: FakeRailwayCallSocket,
    ) : RailwayCallSocketFactory {
        var authToken: String? = null

        override fun create(authToken: String): RailwayCallSocket {
            this.authToken = authToken
            return socket
        }
    }

    private class FakeRailwayCallSocket : RailwayCallSocket {
        private val listeners = mutableMapOf<String, (Array<out Any?>) -> Unit>()
        val emissions = mutableListOf<Pair<String, JSONObject>>()
        var onEmission: ((String, JSONObject, (Array<out Any?>) -> Unit) -> Unit)? = null
        private var isConnected = false

        override fun on(event: String, listener: (Array<out Any?>) -> Unit) {
            listeners[event] = listener
        }

        override fun emit(
            event: String,
            payload: JSONObject,
            acknowledgement: (Array<out Any?>) -> Unit,
        ) {
            emissions += event to JSONObject(payload.toString())
            onEmission?.invoke(event, payload, acknowledgement)
        }

        override fun connect() {
            isConnected = true
            trigger(Socket.EVENT_CONNECT)
        }

        override fun disconnect() {
            isConnected = false
        }

        override fun connected(): Boolean = isConnected

        override fun off() {
            listeners.clear()
        }

        fun trigger(event: String, vararg args: Any?) {
            isConnected = event != Socket.EVENT_DISCONNECT
            listeners[event]?.invoke(args)
        }
    }

    private class RecordingListener(expectedUpdates: Int = 0) : PulseCallSignalingListener {
        val connections = mutableListOf<Boolean>()
        val sessions = mutableListOf<PulseServerCallSession>()
        val mediaSignals = mutableListOf<PulseRemoteMediaSignal>()
        private val updateLatch = CountDownLatch(expectedUpdates)

        override fun onSessionUpdated(session: PulseServerCallSession) {
            sessions += session
            updateLatch.countDown()
        }

        override fun onConnectionChanged(connected: Boolean) {
            connections += connected
        }

        override fun onMediaSignal(signal: PulseRemoteMediaSignal) {
            mediaSignals += signal
        }

        fun awaitUpdates(): Boolean = updateLatch.await(1, TimeUnit.SECONDS)
    }
}
