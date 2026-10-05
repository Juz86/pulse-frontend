package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseWebRtcStatsAnalyzerTest {
    @Test
    fun `reports direct path for selected host and srflx candidates`() {
        val snapshot = PulseWebRtcStatsAnalyzer.analyze(
            listOf(
                stat("transport", "transport", "selectedCandidatePairId" to "pair"),
                stat(
                    "pair",
                    "candidate-pair",
                    "localCandidateId" to "local",
                    "remoteCandidateId" to "remote",
                ),
                stat("local", "local-candidate", "candidateType" to "host"),
                stat("remote", "remote-candidate", "candidateType" to "srflx"),
            ),
        )

        assertEquals(PulseIceTransportPath.DIRECT, snapshot.selectedIcePath?.transport)
        assertEquals("host", snapshot.selectedIcePath?.localCandidateType)
        assertEquals("srflx", snapshot.selectedIcePath?.remoteCandidateType)
    }

    @Test
    fun `reports relay path without exposing candidate addresses`() {
        val snapshot = PulseWebRtcStatsAnalyzer.analyze(
            listOf(
                stat(
                    "pair",
                    "candidate-pair",
                    "state" to "succeeded",
                    "nominated" to true,
                    "localCandidateId" to "local",
                    "remoteCandidateId" to "remote",
                    "bytesReceived" to 200L,
                ),
                stat(
                    "local",
                    "local-candidate",
                    "candidateType" to "relay",
                    "address" to "192.0.2.10",
                ),
                stat("remote", "remote-candidate", "candidateType" to "host"),
            ),
        )

        assertEquals(PulseIceTransportPath.RELAY, snapshot.selectedIcePath?.transport)
        assertEquals("relay", snapshot.selectedIcePath?.localCandidateType)
        assertEquals("host", snapshot.selectedIcePath?.remoteCandidateType)
    }

    @Test
    fun `confirms inbound audio only after packets and bytes arrive`() {
        val silent = PulseWebRtcStatsAnalyzer.analyze(
            listOf(
                stat(
                    "audio",
                    "inbound-rtp",
                    "kind" to "audio",
                    "packetsReceived" to 0L,
                    "bytesReceived" to 0L,
                ),
            ),
        )
        val flowing = PulseWebRtcStatsAnalyzer.analyze(
            listOf(
                stat(
                    "audio-1",
                    "inbound-rtp",
                    "mediaType" to "audio",
                    "packetsReceived" to 12L,
                    "bytesReceived" to 4_096L,
                ),
                stat(
                    "audio-2",
                    "inbound-rtp",
                    "kind" to "audio",
                    "packetsReceived" to 8L,
                    "bytesReceived" to 2_048L,
                ),
            ),
        )

        assertFalse(silent.inboundAudio?.confirmsAudioFlow ?: true)
        assertTrue(flowing.inboundAudio?.confirmsAudioFlow == true)
        assertEquals(20L, flowing.inboundAudio?.packetsReceived)
        assertEquals(6_144L, flowing.inboundAudio?.bytesReceived)
    }

    @Test
    fun `ignores video and incomplete candidate pairs`() {
        val snapshot = PulseWebRtcStatsAnalyzer.analyze(
            listOf(
                stat("video", "inbound-rtp", "kind" to "video", "packetsReceived" to 9L),
                stat("transport", "transport", "selectedCandidatePairId" to "pair"),
                stat(
                    "pair",
                    "candidate-pair",
                    "state" to "succeeded",
                    "localCandidateId" to "missing",
                    "remoteCandidateId" to "remote",
                ),
                stat("remote", "remote-candidate", "candidateType" to "host"),
            ),
        )

        assertNull(snapshot.inboundAudio)
        assertNull(snapshot.selectedIcePath)
    }

    private fun stat(
        id: String,
        type: String,
        vararg members: Pair<String, Any>,
    ) = PulseRtcStat(id, type, mapOf(*members))
}
