package com.pulsemessenger.chat.call.v2

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class RailwayCallingV2CodecTest {
    @Test
    fun `start payload matches Railway contract`() {
        val payload = RailwayCallingV2Codec.encodeStart(
            requestId = "request-123",
            calleeUid = "callee",
            mediaType = PulseCallMediaType.VIDEO,
        )

        assertEquals("request-123", payload.getString("requestId"))
        assertEquals("callee", payload.getString("calleeUid"))
        assertEquals("video", payload.getString("mediaType"))
        assertEquals(3, payload.length())
    }

    @Test
    fun `command omits optional reason when absent`() {
        val payload = RailwayCallingV2Codec.encodeCommand(
            sessionId = "session-123",
            eventId = "event-123",
            expectedRevision = 2,
            command = PulseSignalingCommand.ACCEPT,
        )

        assertEquals("ACCEPT", payload.getString("command"))
        assertFalse(payload.has("reason"))
    }

    @Test
    fun `response decodes authoritative session`() {
        val response = RailwayCallingV2Codec.decodeResponse(
            JSONObject(
                """{
                    "ok": true,
                    "status": "APPLIED",
                    "session": {
                        "protocolVersion": 2,
                        "sessionId": "session-123",
                        "requestId": "request-123",
                        "callerUid": "caller",
                        "calleeUid": "callee",
                        "mediaType": "audio",
                        "state": "CONNECTING",
                        "revision": 3,
                        "mediaReadyUids": ["caller"],
                        "terminalReason": null,
                        "terminalByUid": null
                    }
                }""".trimIndent(),
            ),
        )

        assertTrue(response.ok)
        assertEquals(PulseSignalingStatus.APPLIED, response.status)
        assertEquals(PulseServerCallState.CONNECTING, response.session?.state)
        assertEquals(PulseCallMediaType.AUDIO, response.session?.mediaType)
        assertEquals(setOf("caller"), response.session?.mediaReadyUids)
        assertNull(response.session?.terminalReason)
    }

    @Test
    fun `malformed session is rejected instead of guessed`() {
        val malformed = JSONObject()
            .put("protocolVersion", 2)
            .put("sessionId", "session-123")

        assertThrows(IllegalArgumentException::class.java) {
            RailwayCallingV2Codec.decodeSession(malformed)
        }
    }
}
