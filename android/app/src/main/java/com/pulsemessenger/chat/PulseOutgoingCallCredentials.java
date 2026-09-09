package com.pulsemessenger.chat;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

final class PulseOutgoingCallCredentials {
    private static final long TOKEN_TTL_MS = 60_000L;
    private static final Map<String, Entry> TOKENS = new ConcurrentHashMap<>();

    private PulseOutgoingCallCredentials() {}

    static void put(String sessionId, String idToken) {
        if (isBlank(sessionId) || isBlank(idToken)) return;
        long nowMs = nowMs();
        for (Map.Entry<String, Entry> entry : TOKENS.entrySet()) {
            if (entry.getValue().isExpired(nowMs)) TOKENS.remove(entry.getKey());
        }
        TOKENS.put(sessionId, new Entry(idToken, nowMs + TOKEN_TTL_MS));
    }

    static String consume(String sessionId) {
        if (isBlank(sessionId)) return null;
        Entry entry = TOKENS.remove(sessionId);
        return entry == null || entry.isExpired(nowMs()) ? null : entry.idToken;
    }

    static void remove(String sessionId) {
        if (sessionId != null) TOKENS.remove(sessionId);
    }

    static int sizeForTests() {
        return TOKENS.size();
    }

    private static long nowMs() {
        return System.nanoTime() / 1_000_000L;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static final class Entry {
        private final String idToken;
        private final long expiresAtMs;

        private Entry(String idToken, long expiresAtMs) {
            this.idToken = idToken;
            this.expiresAtMs = expiresAtMs;
        }

        private boolean isExpired(long nowMs) {
            return nowMs >= expiresAtMs;
        }
    }
}
