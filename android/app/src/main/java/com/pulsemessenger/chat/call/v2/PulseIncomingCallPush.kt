package com.pulsemessenger.chat.call.v2

data class PulseIncomingCallPush(
    val sessionId: String,
)

object PulseIncomingCallPushParser {
    private const val TYPE = "calling_v2_incoming"
    private const val PROTOCOL_VERSION = "2"

    fun parse(data: Map<String, String>): PulseIncomingCallPush? {
        if (data["type"] != TYPE || data["protocolVersion"] != PROTOCOL_VERSION) return null
        val sessionId = data["sessionId"]?.trim().orEmpty()
        if (sessionId.length !in 8..128 || !sessionId.all(::isSafeIdentifierCharacter)) return null
        return PulseIncomingCallPush(sessionId)
    }

    private fun isSafeIdentifierCharacter(character: Char): Boolean =
        character.isLetterOrDigit() || character == '-' || character == '_'
}
