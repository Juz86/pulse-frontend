package com.pulsemessenger.chat.call.v2

data class PulseFriendRequestPush(
    val kind: Kind,
    val recipientUid: String,
    val requestId: String,
    val senderUid: String?,
    val senderDisplayName: String?,
    val actorDisplayName: String?,
    val body: String,
) {
    enum class Kind { INCOMING, ACCEPTED, DECLINED }
}

object PulseFriendRequestPushParser {
    fun parse(data: Map<String, String>): PulseFriendRequestPush? {
        val kind = when (data["type"]) {
            "friend_request" -> PulseFriendRequestPush.Kind.INCOMING
            "friend_request_result" -> when (data["outcome"]) {
                "accepted" -> PulseFriendRequestPush.Kind.ACCEPTED
                "declined" -> PulseFriendRequestPush.Kind.DECLINED
                else -> return null
            }
            else -> return null
        }
        val recipientUid = safeIdentifier(data["recipientUid"]) ?: return null
        val requestId = safeIdentifier(data["requestId"]) ?: return null
        val body = normalizeText(data["body"], 500) ?: return null
        val senderUid = safeIdentifier(data["senderUid"])
        val senderDisplayName = normalizeText(data["senderDisplayName"], 160)
        val actorDisplayName = normalizeText(data["actorDisplayName"], 160)

        if (kind == PulseFriendRequestPush.Kind.INCOMING &&
            (senderUid == null || senderDisplayName == null)
        ) return null

        if (kind != PulseFriendRequestPush.Kind.INCOMING && actorDisplayName == null) return null

        return PulseFriendRequestPush(
            kind = kind,
            recipientUid = recipientUid,
            requestId = requestId,
            senderUid = senderUid,
            senderDisplayName = senderDisplayName,
            actorDisplayName = actorDisplayName,
            body = body,
        )
    }

    private fun safeIdentifier(value: String?): String? = value
        ?.trim()
        ?.takeIf { it.length in 1..256 && it.all { char -> char.isLetterOrDigit() || char == '-' || char == '_' } }

    private fun normalizeText(value: String?, maxLength: Int): String? = value
        ?.replace(Regex("[\\p{Cc}\\p{Cf}]+"), " ")
        ?.trim()
        ?.take(maxLength)
        ?.takeIf(String::isNotEmpty)
}
