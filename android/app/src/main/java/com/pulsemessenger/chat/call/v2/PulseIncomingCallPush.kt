package com.pulsemessenger.chat.call.v2

data class PulseIncomingCallPush(
    val sessionId: String,
    val callerDisplayName: String?,
)

data class PulseTerminalCallPush(
    val sessionId: String,
    val revision: Long,
)

data class PulseCallTakenElsewherePush(
    val sessionId: String,
    val acceptedInstallationId: String,
    val revision: Long,
)

object PulseIncomingCallPushParser {
    private const val TYPE = "calling_v2_incoming"
    private const val PROTOCOL_VERSION = "2"

    fun parse(data: Map<String, String>): PulseIncomingCallPush? {
        if (data["type"] != TYPE || data["protocolVersion"] != PROTOCOL_VERSION) return null
        val sessionId = data["sessionId"]?.trim().orEmpty()
        if (sessionId.length !in 8..128 || !sessionId.all(::isSafeIdentifierCharacter)) return null
        val callerDisplayName = data["callerDisplayName"]
            ?.trim()
            ?.takeIf { it.isNotEmpty() && it.length <= 160 && it.none(Char::isISOControl) }
        return PulseIncomingCallPush(sessionId, callerDisplayName)
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

object PulseCallTakenElsewherePushParser {
    private const val TYPE = "calling_v2_taken_elsewhere"
    private const val PROTOCOL_VERSION = "2"

    fun parse(data: Map<String, String>): PulseCallTakenElsewherePush? {
        if (data["type"] != TYPE || data["protocolVersion"] != PROTOCOL_VERSION) return null
        val sessionId = data["sessionId"]?.trim().orEmpty()
        val acceptedInstallationId = data["acceptedInstallationId"]?.trim().orEmpty()
        if (!sessionId.isSafeIdentifier() || !acceptedInstallationId.isSafeIdentifier()) return null
        val revision = data["revision"]?.toLongOrNull()?.takeIf { it > 0 } ?: return null
        return PulseCallTakenElsewherePush(sessionId, acceptedInstallationId, revision)
    }

    private fun String.isSafeIdentifier(): Boolean =
        length in 8..128 && all { it.isLetterOrDigit() || it == '-' || it == '_' }
}
