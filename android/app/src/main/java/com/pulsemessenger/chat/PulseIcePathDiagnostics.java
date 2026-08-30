package com.pulsemessenger.chat;

import org.webrtc.RTCStats;
import org.webrtc.RTCStatsReport;

import java.util.Map;

final class PulseIcePathDiagnostics {
    private PulseIcePathDiagnostics() {}

    static String summarize(RTCStatsReport report) {
        if (report == null || report.getStatsMap() == null) return "path=unknown";
        Map<String, RTCStats> stats = report.getStatsMap();
        RTCStats pair = selectedPair(stats);
        if (pair == null) return "path=unknown";

        String localType = candidateType(stats.get(stringMember(pair, "localCandidateId")));
        String remoteType = candidateType(stats.get(stringMember(pair, "remoteCandidateId")));
        String path = pathType(localType, remoteType);
        String protocol = lowerString(member(pair, "protocol"));
        if ("unknown".equals(protocol)) {
            RTCStats local = stats.get(stringMember(pair, "localCandidateId"));
            protocol = lowerString(member(local, "protocol"));
        }
        return "path=" + path
            + ", local=" + localType
            + ", remote=" + remoteType
            + ", protocol=" + protocol;
    }

    private static RTCStats selectedPair(Map<String, RTCStats> stats) {
        for (RTCStats stat : stats.values()) {
            if (!"transport".equals(stat.getType())) continue;
            String selectedId = stringMember(stat, "selectedCandidatePairId");
            if (selectedId != null && stats.containsKey(selectedId)) return stats.get(selectedId);
        }
        for (RTCStats stat : stats.values()) {
            if (!"candidate-pair".equals(stat.getType())) continue;
            boolean selected = booleanMember(stat, "selected");
            boolean nominated = booleanMember(stat, "nominated");
            boolean succeeded = "succeeded".equals(lowerString(member(stat, "state")));
            if (selected || (nominated && succeeded)) return stat;
        }
        return null;
    }

    private static String candidateType(RTCStats candidate) {
        return lowerString(member(candidate, "candidateType"));
    }

    private static String pathType(String localType, String remoteType) {
        if ("relay".equals(localType) || "relay".equals(remoteType)) return "relay";
        if ("srflx".equals(localType) || "srflx".equals(remoteType)
            || "prflx".equals(localType) || "prflx".equals(remoteType)) return "srflx";
        if ("host".equals(localType) || "host".equals(remoteType)) return "host";
        return "unknown";
    }

    private static Object member(RTCStats stat, String name) {
        return stat == null || stat.getMembers() == null ? null : stat.getMembers().get(name);
    }

    private static String stringMember(RTCStats stat, String name) {
        Object value = member(stat, name);
        return value == null ? null : String.valueOf(value);
    }

    private static boolean booleanMember(RTCStats stat, String name) {
        Object value = member(stat, name);
        return value instanceof Boolean ? (Boolean) value : "true".equalsIgnoreCase(String.valueOf(value));
    }

    private static String lowerString(Object value) {
        return value == null ? "unknown" : String.valueOf(value).toLowerCase();
    }
}
