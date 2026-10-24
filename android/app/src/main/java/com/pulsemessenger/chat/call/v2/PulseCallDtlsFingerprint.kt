package com.pulsemessenger.chat.call.v2

private val SHA256_FINGERPRINT = Regex("^[0-9a-f]{64}$")
private val SDP_SHA256_FINGERPRINT = Regex(
    pattern = "^a=fingerprint:sha-256\\s+([^\\r\\n]+)$",
    options = setOf(RegexOption.IGNORE_CASE, RegexOption.MULTILINE),
)

internal fun normalizeSha256DtlsFingerprint(value: String): String? =
    value.trim().lowercase().replace(":", "").takeIf(SHA256_FINGERPRINT::matches)

internal fun extractSha256DtlsFingerprint(sdp: String): String? {
    val fingerprints = SDP_SHA256_FINGERPRINT.findAll(sdp)
        .mapNotNull { match -> normalizeSha256DtlsFingerprint(match.groupValues[1]) }
        .toSet()
    return fingerprints.singleOrNull()
}
