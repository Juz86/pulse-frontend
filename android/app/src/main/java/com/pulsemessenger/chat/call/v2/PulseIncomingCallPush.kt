package com.pulsemessenger.chat.call.v2

data class PulseIncomingCallPush(
    val sessionId: String,
    val callerDisplayName: String?,
    val callerPhotoUrl: String?,
    val mediaType: PulseCallMediaType,
)

data class PulseTerminalCallPush(
    val sessionId: String,
    val revision: Long,
    val terminalReason: String,
    val peerUid: String?,
    val peerDisplayName: String?,
    val peerPhotoUrl: String?,
    val mediaType: PulseCallMediaType,
    val showMissedNotification: Boolean,
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
        val callerPhotoUrl = data["callerPhotoURL"]
            ?.trim()
            ?.takeIf(::isSafeHttpsUrl)
        val mediaType = when (data["mediaType"]?.trim()?.lowercase()) {
            null, "", "audio" -> PulseCallMediaType.AUDIO
            "video" -> PulseCallMediaType.VIDEO
            else -> return null
        }
        return PulseIncomingCallPush(sessionId, callerDisplayName, callerPhotoUrl, mediaType)
    }

    private fun isSafeIdentifierCharacter(character: Char): Boolean =
        character.isLetterOrDigit() || character == '-' || character == '_'

    private fun isSafeHttpsUrl(value: String): Boolean = value.length <= 2_048 &&
        runCatching { java.net.URI(value).scheme.equals("https", ignoreCase = true) }.getOrDefault(false)
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
        val terminalReason = data["terminalReason"]?.trim()?.lowercase().orEmpty()
        if (terminalReason.isEmpty() || terminalReason.length > 64) return null
        val peerUid = data["peerUid"]?.trim()?.takeIf {
            it.length in 1..128 && it.all(::isSafeIdentifierCharacter)
        }
        val peerDisplayName = data["peerDisplayName"]
            ?.trim()
            ?.takeIf { it.isNotEmpty() && it.length <= 160 && it.none(Char::isISOControl) }
        val peerPhotoUrl = data["peerPhotoURL"]?.trim()?.takeIf(::isSafeHttpsUrl)
        val mediaType = when (data["mediaType"]?.trim()?.lowercase()) {
            null, "", "audio" -> PulseCallMediaType.AUDIO
            "video" -> PulseCallMediaType.VIDEO
            else -> return null
        }
        return PulseTerminalCallPush(
            sessionId,
            revision,
            terminalReason,
            peerUid,
            peerDisplayName,
            peerPhotoUrl,
            mediaType,
            data["showMissedNotification"] == "true",
        )
    }

    private fun isSafeIdentifierCharacter(character: Char): Boolean =
        character.isLetterOrDigit() || character == '-' || character == '_'

    private fun isSafeHttpsUrl(value: String): Boolean = value.length <= 2_048 &&
        runCatching { java.net.URI(value).scheme.equals("https", ignoreCase = true) }.getOrDefault(false)
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
