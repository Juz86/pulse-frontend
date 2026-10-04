package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PulseIncomingCallPushParserTest {
    @Test
    fun `accepts a minimal calling v2 wake-up`() {
        val parsed = PulseIncomingCallPushParser.parse(
            mapOf(
                "type" to "calling_v2_incoming",
                "protocolVersion" to "2",
                "sessionId" to "session-123",
            ),
        )

        assertEquals(PulseIncomingCallPush("session-123"), parsed)
    }

    @Test
    fun `rejects unrelated or malformed push data`() {
        assertNull(PulseIncomingCallPushParser.parse(mapOf("type" to "message")))
        assertNull(
            PulseIncomingCallPushParser.parse(
                mapOf(
                    "type" to "calling_v2_incoming",
                    "protocolVersion" to "1",
                    "sessionId" to "session-123",
                ),
            ),
        )
        assertNull(
            PulseIncomingCallPushParser.parse(
                mapOf(
                    "type" to "calling_v2_incoming",
                    "protocolVersion" to "2",
                    "sessionId" to "invalid/session",
                ),
            ),
        )
    }

    @Test
    fun `accepts a terminal calling v2 wake-up`() {
        val parsed = PulseTerminalCallPushParser.parse(
            mapOf(
                "type" to "calling_v2_terminal",
                "protocolVersion" to "2",
                "sessionId" to "session-123",
                "state" to "ENDED",
                "revision" to "4",
                "terminalReason" to "missed",
            ),
        )

        assertEquals(PulseTerminalCallPush("session-123", 4), parsed)
    }

    @Test
    fun `rejects malformed terminal wake-ups`() {
        assertNull(
            PulseTerminalCallPushParser.parse(
                mapOf(
                    "type" to "calling_v2_terminal",
                    "protocolVersion" to "2",
                    "sessionId" to "session-123",
                    "state" to "ACTIVE",
                    "revision" to "4",
                ),
            ),
        )
        assertNull(
            PulseTerminalCallPushParser.parse(
                mapOf(
                    "type" to "calling_v2_terminal",
                    "protocolVersion" to "2",
                    "sessionId" to "session-123",
                    "state" to "ENDED",
                    "revision" to "0",
                ),
            ),
        )
    }
}
