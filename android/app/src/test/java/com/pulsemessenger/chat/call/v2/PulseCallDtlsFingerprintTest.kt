package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PulseCallDtlsFingerprintTest {
    @Test
    fun extractsOneConsistentSha256Fingerprint() {
        val normalized = "ab".repeat(32)
        val fingerprint = normalized.chunked(2).joinToString(":").uppercase()
        val sdp = listOf(
            "v=0",
            "a=fingerprint:sha-256 $fingerprint",
            "a=fingerprint:sha-256 $fingerprint",
        ).joinToString("\r\n")

        assertEquals(normalized, extractSha256DtlsFingerprint(sdp))
    }

    @Test
    fun rejectsMissingWeakMalformedAndInconsistentFingerprints() {
        assertNull(extractSha256DtlsFingerprint("v=0"))
        assertNull(extractSha256DtlsFingerprint("a=fingerprint:sha-1 AA:BB"))
        assertNull(extractSha256DtlsFingerprint("a=fingerprint:sha-256 AA:BB"))
        assertNull(extractSha256DtlsFingerprint(listOf(
            "a=fingerprint:sha-256 ${"aa".repeat(32)}",
            "a=fingerprint:sha-256 ${"bb".repeat(32)}",
        ).joinToString("\r\n")))
    }
}
