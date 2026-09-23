package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseCallMediaEngineTest {
    @Test
    fun `audio session accepts authenticated TURN server`() {
        val server = PulseIceServer(
            urls = listOf("turns:turn.example.com:443?transport=tcp"),
            username = "temporary-user",
            credential = "temporary-secret",
        )

        val config = PulseAudioSessionConfig(
            sessionId = "session-123",
            role = PulseMediaRole.OFFERER,
            iceServers = listOf(server),
        )

        assertEquals("session-123", config.sessionId)
        assertEquals(PulseMediaRole.OFFERER, config.role)
        assertEquals(listOf(server), config.iceServers)
    }

    @Test
    fun `ICE credentials must be complete`() {
        assertThrows(IllegalArgumentException::class.java) {
            PulseIceServer(
                urls = listOf("turn:turn.example.com:3478"),
                username = "temporary-user",
            )
        }
    }

    @Test
    fun `empty media identifiers are rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            PulseAudioSessionConfig("", PulseMediaRole.ANSWERER, emptyList())
        }
        assertThrows(IllegalArgumentException::class.java) {
            PulseSessionDescription(PulseSessionDescriptionType.OFFER, "")
        }
        assertThrows(IllegalArgumentException::class.java) {
            PulseIceCandidate(null, -1, "candidate")
        }
    }

    @Test
    fun `SDP and ICE candidates are redacted from object text`() {
        val description = PulseSessionDescription(
            PulseSessionDescriptionType.OFFER,
            "v=0 private-session-description",
        )
        val candidate = PulseIceCandidate(
            "audio",
            0,
            "candidate:private-network-address",
        )

        assertFalse(description.toString().contains(description.value))
        assertFalse(candidate.toString().contains(candidate.value))
        assertTrue(description.toString().contains("<redacted>"))
        assertTrue(candidate.toString().contains("<redacted>"))
    }

    @Test
    fun `TURN credential is redacted from object text`() {
        val server = PulseIceServer(
            urls = listOf("turn:turn.example.com:3478"),
            username = "temporary-user",
            credential = "temporary-secret",
        )

        assertFalse(server.toString().contains("temporary-user"))
        assertFalse(server.toString().contains("temporary-secret"))
        assertTrue(server.toString().contains("<redacted>"))
    }
}
