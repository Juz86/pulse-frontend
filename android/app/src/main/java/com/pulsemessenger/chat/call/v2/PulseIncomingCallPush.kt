package com.pulsemessenger.chat.call.v2

data class PulseIncomingCallPush(
    val sessionId: String,
)

data class PulseTerminalCallPush(
    val sessionId: String,
    val revision: Long,
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

object PulseTerminalCallPushParser {
    private const val TYPE = "calling_v2_terminal"
    private const val PROTOCOL_VERSION = "2"

    fun parse(data: Map<String, String>): PulseTerminalCallPush? {
        if (data["type"] != TYPE ||
            data["protocolVersion"] != PROTOCOL_VERSION ||
            data["state"] != PulseServerCallState.ENDED.name
        ) return null
        val sessionId = data["sessionId"]?.trim().orEmpty()
        if (sessionId.length !in 8..128 || !sessionId.all(::isSafeIdentifierCharacter)) return null
        val revision = data["revision"]?.toLongOrNull()?.takeIf { it > 0 } ?: return null
        return PulseTerminalCallPush(sessionId, revision)
    }

    private fun isSafeIdentifierCharacter(character: Char): Boolean =
        character.isLetterOrDigit() || character == '-' || character == '_'
}
