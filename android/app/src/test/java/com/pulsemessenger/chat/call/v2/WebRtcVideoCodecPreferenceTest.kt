package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Test
import org.webrtc.RtpCapabilities

class WebRtcVideoCodecPreferenceTest {
    @Test
    fun `prioritizes fast baseline codecs without removing fallbacks`() {
        val codecs = listOf("AV1", "rtx", "H265", "VP9", "H264", "VP8", "red")
            .map { name -> RtpCapabilities.CodecCapability().apply { this.name = name } }

        val prioritized = prioritizeVideoCodecs(codecs)

        assertEquals(
            listOf("VP8", "H264", "VP9", "AV1", "H265", "rtx", "red"),
            prioritized.map(RtpCapabilities.CodecCapability::name),
        )
        assertEquals(codecs.toSet(), prioritized.toSet())
    }
}
