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
            installationId = "installation-123",
        )

        assertEquals("ACCEPT", payload.getString("command"))
        assertEquals("installation-123", payload.getString("installationId"))
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
                        "iceRestartSequence": 2,
                        "terminalReason": null,
                        "terminalByUid": null,
                        "acceptedInstallationId": "installation-123"
                    }
                }""".trimIndent(),
            ),
        )

        assertTrue(response.ok)
        assertEquals(PulseSignalingStatus.APPLIED, response.status)
        assertEquals(PulseServerCallState.CONNECTING, response.session?.state)
        assertEquals(PulseCallMediaType.AUDIO, response.session?.mediaType)
        assertEquals(setOf("caller"), response.session?.mediaReadyUids)
        assertEquals(2L, response.session?.iceRestartSequence)
        assertEquals("installation-123", response.session?.acceptedInstallationId)
        assertNull(response.session?.terminalReason)
    }

    @Test
    fun `response preserves rate limit status`() {
        val response = RailwayCallingV2Codec.decodeResponse(
            JSONObject("""{"ok":false,"status":"RATE_LIMITED"}"""),
        )

        assertFalse(response.ok)
        assertEquals(PulseSignalingStatus.RATE_LIMITED, response.status)
        assertNull(response.session)
    }

    @Test
    fun `older sessions without an ICE restart sequence remain compatible`() {
        val payload = JSONObject(
            """{
                "protocolVersion": 2,
                "sessionId": "session-123",
                "requestId": "request-123",
                "callerUid": "caller",
                "calleeUid": "callee",
                "mediaType": "audio",
                "state": "CONNECTING",
                "revision": 3,
                "mediaReadyUids": []
            }""".trimIndent(),
        )

        assertEquals(0L, RailwayCallingV2Codec.decodeSession(payload).iceRestartSequence)
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

    @Test
    fun `media payloads match Railway contract without exposing them through object text`() {
        val description = PulseSessionDescription(PulseSessionDescriptionType.OFFER, "v=0 private")
        val offer = RailwayCallingV2Codec.encodeDescription(
            sessionId = "session-123",
            messageId = "message-123",
            description = description,
        )
        assertEquals("offer", offer.getString("type"))
        assertEquals("v=0 private", offer.getString("description"))
        assertFalse(description.toString().contains("v=0 private"))

        val candidate = PulseIceCandidate(null, 0, "candidate:private")
        val encodedCandidate = RailwayCallingV2Codec.encodeIceCandidate(
            sessionId = "session-123",
            messageId = "message-456",
            candidate = candidate,
        ).getJSONObject("candidate")
        assertTrue(encodedCandidate.isNull("mediaStreamId"))
        assertEquals(0, encodedCandidate.getInt("mediaLineIndex"))
        assertEquals("candidate:private", encodedCandidate.getString("value"))
        assertFalse(candidate.toString().contains("candidate:private"))
    }

    @Test
    fun `ICE configuration decodes Cloudflare relay credentials`() {
        val response = RailwayCallingV2Codec.decodeIceConfiguration(
            JSONObject()
                .put("ok", true)
                .put("status", "FOUND")
                .put("expiresInSeconds", 7200)
                .put(
                    "iceServers",
                    org.json.JSONArray()
                        .put(JSONObject().put("urls", org.json.JSONArray().put("stun:stun.cloudflare.com:3478")))
                        .put(
                            JSONObject()
                                .put("urls", org.json.JSONArray().put("turns:turn.cloudflare.com:443?transport=tcp"))
                                .put("username", "temporary-user")
                                .put("credential", "temporary-secret"),
                        ),
                ),
        )

        assertTrue(response.ok)
        assertEquals(PulseSignalingStatus.FOUND, response.status)
        assertEquals(7200, response.expiresInSeconds)
        assertEquals(2, response.iceServers.size)
        assertEquals("temporary-user", response.iceServers.last().username)
        assertFalse(response.iceServers.last().toString().contains("temporary-secret"))
    }

    @Test
    fun `incoming media signals decode to typed redacted models`() {
        val offer = RailwayCallingV2Codec.decodeMediaSignal(
            JSONObject()
                .put("protocolVersion", 2)
                .put("sessionId", "session-123")
                .put("messageId", "message-123")
                .put("senderUid", "caller")
                .put("type", "offer")
                .put("description", "v=0 private"),
        ) as PulseRemoteDescriptionSignal
        assertEquals(PulseSessionDescriptionType.OFFER, offer.description.type)
        assertFalse(offer.description.toString().contains("v=0 private"))

        val candidate = RailwayCallingV2Codec.decodeMediaSignal(
            JSONObject()
                .put("protocolVersion", 2)
                .put("sessionId", "session-123")
                .put("messageId", "message-456")
                .put("senderUid", "callee")
                .put("type", "candidate")
                .put(
                    "candidate",
                    JSONObject()
                        .put("mediaStreamId", JSONObject.NULL)
                        .put("mediaLineIndex", 0)
                        .put("value", "candidate:private"),
                ),
        ) as PulseRemoteIceCandidateSignal
        assertNull(candidate.candidate.mediaStreamId)
        assertEquals(0, candidate.candidate.mediaLineIndex)
        assertFalse(candidate.candidate.toString().contains("candidate:private"))
    }

    @Test
    fun `media signal rejects a different protocol version`() {
        assertThrows(IllegalArgumentException::class.java) {
            RailwayCallingV2Codec.decodeMediaSignal(
                JSONObject()
                    .put("protocolVersion", 3)
                    .put("sessionId", "session-123")
                    .put("messageId", "message-123")
                    .put("senderUid", "caller")
                    .put("type", "offer")
                    .put("description", "v=0"),
            )
        }
    }
}
