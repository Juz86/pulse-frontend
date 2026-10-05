package com.pulsemessenger.chat.call.v2

internal data class PulseRtcStat(
    val id: String,
    val type: String,
    val members: Map<String, Any>,
)

internal enum class PulseIceTransportPath {
    DIRECT,
    RELAY,
}

internal data class PulseSelectedIcePath(
    val transport: PulseIceTransportPath,
    val localCandidateType: String,
    val remoteCandidateType: String,
)

internal data class PulseInboundAudioStats(
    val packetsReceived: Long,
    val bytesReceived: Long,
) {
    val confirmsAudioFlow: Boolean
        get() = packetsReceived > 0L && bytesReceived > 0L
}

internal data class PulseWebRtcDiagnosticsSnapshot(
    val selectedIcePath: PulseSelectedIcePath?,
    val inboundAudio: PulseInboundAudioStats?,
)

internal object PulseWebRtcStatsAnalyzer {
    private val candidateTypes = setOf("host", "srflx", "prflx", "relay")

    fun analyze(stats: Collection<PulseRtcStat>): PulseWebRtcDiagnosticsSnapshot {
        val byId = stats.associateBy(PulseRtcStat::id)
        return PulseWebRtcDiagnosticsSnapshot(
            selectedIcePath = selectedCandidatePair(stats, byId),
            inboundAudio = inboundAudio(stats),
        )
    }

    private fun selectedCandidatePair(
        stats: Collection<PulseRtcStat>,
        byId: Map<String, PulseRtcStat>,
    ): PulseSelectedIcePath? {
        val selectedPairId = stats.firstNotNullOfOrNull { stat ->
            if (stat.type == "transport") stat.members.string("selectedCandidatePairId") else null
        }
        val pair = selectedPairId?.let(byId::get) ?: stats
            .asSequence()
            .filter { it.type == "candidate-pair" && it.members.string("state") == "succeeded" }
            .filter {
                it.members.boolean("nominated") == true || it.members.boolean("selected") == true
            }
            .maxByOrNull {
                it.members.long("bytesReceived") + it.members.long("bytesSent")
            }
            ?: return null

        val localType = candidateType(byId[pair.members.string("localCandidateId")])
        val remoteType = candidateType(byId[pair.members.string("remoteCandidateId")])
        if (localType == "unknown" || remoteType == "unknown") return null
        return PulseSelectedIcePath(
            transport = if (localType == "relay" || remoteType == "relay") {
                PulseIceTransportPath.RELAY
            } else {
                PulseIceTransportPath.DIRECT
            },
            localCandidateType = localType,
            remoteCandidateType = remoteType,
        )
    }

    private fun inboundAudio(stats: Collection<PulseRtcStat>): PulseInboundAudioStats? {
        val audioStats = stats.filter { stat ->
            stat.type == "inbound-rtp" &&
                (stat.members.string("kind") == "audio" ||
                    stat.members.string("mediaType") == "audio")
        }
        if (audioStats.isEmpty()) return null
        return PulseInboundAudioStats(
            packetsReceived = audioStats.sumOf { it.members.long("packetsReceived") },
            bytesReceived = audioStats.sumOf { it.members.long("bytesReceived") },
        )
    }

    private fun candidateType(stat: PulseRtcStat?): String {
        val type = stat?.members?.string("candidateType")?.lowercase()
        return type?.takeIf(candidateTypes::contains) ?: "unknown"
    }

    private fun Map<String, Any>.string(key: String): String? = get(key) as? String

    private fun Map<String, Any>.boolean(key: String): Boolean? = get(key) as? Boolean

    private fun Map<String, Any>.long(key: String): Long = (get(key) as? Number)?.toLong() ?: 0L
}
