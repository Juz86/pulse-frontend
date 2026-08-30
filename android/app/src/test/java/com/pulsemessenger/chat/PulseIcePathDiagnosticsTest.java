package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import org.junit.Test;
import org.webrtc.RTCStats;
import org.webrtc.RTCStatsReport;

import java.util.HashMap;
import java.util.Map;

public class PulseIcePathDiagnosticsTest {
    @Test
    public void reportsRelayPathWithoutAddresses() {
        Map<String, RTCStats> stats = new HashMap<>();
        stats.put("transport-1", stat("transport-1", "transport", members("selectedCandidatePairId", "pair-1")));
        stats.put("pair-1", stat("pair-1", "candidate-pair", members(
            "localCandidateId", "local-1",
            "remoteCandidateId", "remote-1",
            "protocol", "udp"
        )));
        stats.put("local-1", stat("local-1", "local-candidate", members("candidateType", "relay", "address", "192.0.2.1")));
        stats.put("remote-1", stat("remote-1", "remote-candidate", members("candidateType", "srflx", "address", "198.51.100.2")));

        String summary = PulseIcePathDiagnostics.summarize(new RTCStatsReport(1L, stats));

        assertEquals("path=relay, local=relay, remote=srflx, protocol=udp", summary);
        assertFalse(summary.contains("192.0.2.1"));
        assertFalse(summary.contains("198.51.100.2"));
    }

    private RTCStats stat(String id, String type, Map<String, Object> members) {
        return new RTCStats(1L, type, id, members);
    }

    private Map<String, Object> members(Object... values) {
        Map<String, Object> result = new HashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            result.put(String.valueOf(values[index]), values[index + 1]);
        }
        return result;
    }
}
