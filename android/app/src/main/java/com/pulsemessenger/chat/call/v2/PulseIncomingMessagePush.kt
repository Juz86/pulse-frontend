package com.pulsemessenger.chat.call.v2

data class PulseIncomingMessagePush(
    val conversationId: String,
    val messageId: String,
    val senderUid: String,
    val senderDisplayName: String,
    val senderPhotoUrl: String?,
    val body: String,
    val sentAtMs: Long?,
)

object PulseIncomingMessagePushParser {
    private const val TYPE = "pulse_message"

    fun parse(data: Map<String, String>): PulseIncomingMessagePush? {
        if (data["type"] != TYPE) return null
        val conversationId = data["convId"]?.trim().orEmpty()
        val messageId = data["messageId"]?.trim().orEmpty()
        val senderUid = data["senderUid"]?.trim().orEmpty()
        val senderDisplayName = normalizeText(data["senderDisplayName"], 160)
            ?: return null
        val body = normalizeText(data["body"], 500)
            ?: return null
        if (!conversationId.isSafeIdentifier() ||
            !messageId.isSafeIdentifier() ||
            !senderUid.isSafeIdentifier()
        ) return null

        val senderPhotoUrl = data["senderPhotoURL"]
            ?.trim()
            ?.takeIf(::isSafeHttpsUrl)
        val sentAtMs = data["sentAt"]?.toLongOrNull()?.takeIf { it > 0 }
        return PulseIncomingMessagePush(
            conversationId = conversationId,
            messageId = messageId,
            senderUid = senderUid,
            senderDisplayName = senderDisplayName,
            senderPhotoUrl = senderPhotoUrl,
            body = body,
            sentAtMs = sentAtMs,
        )
    }

    private fun String.isSafeIdentifier(): Boolean =
        length in 1..256 && all { it.isLetterOrDigit() || it == '-' || it == '_' }

    private fun normalizeText(value: String?, maxLength: Int): String? = value
        ?.replace(Regex("[\\p{Cc}\\p{Cf}]+"), " ")
        ?.trim()
        ?.take(maxLength)
        ?.takeIf(String::isNotEmpty)

    private fun isSafeHttpsUrl(value: String): Boolean = value.length <= 2_048 &&
        runCatching { java.net.URI(value).scheme.equals("https", ignoreCase = true) }.getOrDefault(false)
}
