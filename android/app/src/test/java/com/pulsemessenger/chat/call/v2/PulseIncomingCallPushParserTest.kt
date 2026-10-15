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

        assertEquals(
            PulseIncomingCallPush("session-123", null, null, PulseCallMediaType.AUDIO),
            parsed,
        )
    }

    @Test
    fun `keeps a valid caller display name`() {
        val parsed = PulseIncomingCallPushParser.parse(
            mapOf(
                "type" to "calling_v2_incoming",
                "protocolVersion" to "2",
                "sessionId" to "session-123",
                "callerDisplayName" to "  Yushua  ",
                "callerPhotoURL" to "https://cdn.pulse.test/yushua.jpg",
            ),
        )

        assertEquals(
            PulseIncomingCallPush(
                "session-123",
                "Yushua",
                "https://cdn.pulse.test/yushua.jpg",
                PulseCallMediaType.AUDIO,
            ),
            parsed,
        )
    }

    @Test
    fun `keeps video media type for a native wake-up`() {
        val parsed = PulseIncomingCallPushParser.parse(
            mapOf(
                "type" to "calling_v2_incoming",
                "protocolVersion" to "2",
                "sessionId" to "session-123",
                "mediaType" to "video",
            ),
        )

        assertEquals(
            PulseIncomingCallPush("session-123", null, null, PulseCallMediaType.VIDEO),
            parsed,
        )
    }

    @Test
    fun `discards a non-https caller photo`() {
        val parsed = PulseIncomingCallPushParser.parse(
            mapOf(
                "type" to "calling_v2_incoming",
                "protocolVersion" to "2",
                "sessionId" to "session-123",
                "callerPhotoURL" to "http://cdn.pulse.test/yushua.jpg",
            ),
        )

        assertEquals(
            PulseIncomingCallPush("session-123", null, null, PulseCallMediaType.AUDIO),
            parsed,
        )
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
                    "sessionId" to "session-123",
                    "mediaType" to "screen",
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
                "peerUid" to "caller-456",
                "peerDisplayName" to "Yousef",
                "peerPhotoURL" to "https://cdn.pulse.test/yousef.jpg",
                "mediaType" to "video",
                "showMissedNotification" to "true",
            ),
        )

        assertEquals(
            PulseTerminalCallPush(
                sessionId = "session-123",
                revision = 4,
                terminalReason = "missed",
                peerUid = "caller-456",
                peerDisplayName = "Yousef",
                peerPhotoUrl = "https://cdn.pulse.test/yousef.jpg",
                mediaType = PulseCallMediaType.VIDEO,
                showMissedNotification = true,
            ),
            parsed,
        )
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

    @Test
    fun `accepts a taken elsewhere wake-up`() {
        val parsed = PulseCallTakenElsewherePushParser.parse(
            mapOf(
                "type" to "calling_v2_taken_elsewhere",
                "protocolVersion" to "2",
                "sessionId" to "session-123",
                "acceptedInstallationId" to "installation-456",
                "revision" to "3",
            ),
        )

        assertEquals(
            PulseCallTakenElsewherePush("session-123", "installation-456", 3),
            parsed,
        )
    }

    @Test
    fun `rejects malformed taken elsewhere wake-ups`() {
        assertNull(
            PulseCallTakenElsewherePushParser.parse(
                mapOf(
                    "type" to "calling_v2_taken_elsewhere",
                    "protocolVersion" to "2",
                    "sessionId" to "session-123",
                    "acceptedInstallationId" to "bad/id",
                    "revision" to "3",
                ),
            ),
        )
    }
}
