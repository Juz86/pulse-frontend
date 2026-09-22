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
        private val updateLatch = CountDownLatch(expectedUpdates)

        override fun onSessionUpdated(session: PulseServerCallSession) {
            sessions += session
            updateLatch.countDown()
        }

        override fun onConnectionChanged(connected: Boolean) {
            connections += connected
        }

        fun awaitUpdates(): Boolean = updateLatch.await(1, TimeUnit.SECONDS)
    }
}
