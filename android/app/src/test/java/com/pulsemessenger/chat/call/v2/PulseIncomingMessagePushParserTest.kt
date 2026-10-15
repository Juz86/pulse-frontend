package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PulseIncomingMessagePushParserTest {
    @Test
    fun `accepts a complete native message push`() {
        val parsed = PulseIncomingMessagePushParser.parse(
            mapOf(
                "type" to "pulse_message",
                "convId" to "conversation-123",
                "messageId" to "message-456",
                "senderUid" to "user-789",
                "senderDisplayName" to "  Yousef  ",
                "senderPhotoURL" to "https://cdn.pulse.test/yousef.jpg",
                "body" to "  Hallo  ",
                "sentAt" to "1728936780000",
            ),
        )

        assertEquals(
            PulseIncomingMessagePush(
                conversationId = "conversation-123",
                messageId = "message-456",
                senderUid = "user-789",
                senderDisplayName = "Yousef",
                senderPhotoUrl = "https://cdn.pulse.test/yousef.jpg",
                body = "Hallo",
                sentAtMs = 1728936780000,
            ),
            parsed,
        )
    }

    @Test
    fun `keeps the message but drops an unsafe photo url`() {
        val parsed = PulseIncomingMessagePushParser.parse(
            mapOf(
                "type" to "pulse_message",
                "convId" to "conversation-123",
                "messageId" to "message-456",
                "senderUid" to "user-789",
                "senderDisplayName" to "Yousef",
                "senderPhotoURL" to "http://cdn.pulse.test/yousef.jpg",
                "body" to "Hallo",
            ),
        )

        assertEquals(null, parsed?.senderPhotoUrl)
    }

    @Test
    fun `normalizes multiline notification text`() {
        val parsed = PulseIncomingMessagePushParser.parse(
            mapOf(
                "type" to "pulse_message",
                "convId" to "conversation-123",
                "messageId" to "message-456",
                "senderUid" to "user-789",
                "senderDisplayName" to "Yousef",
                "body" to "Hallo\nhoe gaat het?",
            ),
        )

        assertEquals("Hallo hoe gaat het?", parsed?.body)
    }

    @Test
    fun `rejects malformed or unrelated message pushes`() {
        assertNull(PulseIncomingMessagePushParser.parse(mapOf("type" to "message")))
        assertNull(
            PulseIncomingMessagePushParser.parse(
                mapOf(
                    "type" to "pulse_message",
                    "convId" to "conversation/123",
                    "messageId" to "message-456",
                    "senderUid" to "user-789",
                    "senderDisplayName" to "Yousef",
                    "body" to "Hallo",
                ),
            ),
        )
        assertNull(
            PulseIncomingMessagePushParser.parse(
                mapOf(
                    "type" to "pulse_message",
                    "convId" to "conversation-123",
                    "messageId" to "message-456",
                    "senderUid" to "user-789",
                    "senderDisplayName" to "Yousef",
                    "body" to "",
                ),
            ),
        )
    }
}
