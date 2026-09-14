package com.pulsemessenger.chat;

final class PulseCallStartGate {
    enum Result {
        STARTED,
        ALREADY_STARTED,
        BUSY,
        INVALID
    }

    private String sessionId;

    synchronized Result reserve(String requestedSessionId) {
        if (isBlank(requestedSessionId)) return Result.INVALID;
        if (requestedSessionId.equals(sessionId)) return Result.ALREADY_STARTED;
        if (sessionId != null) return Result.BUSY;
        sessionId = requestedSessionId;
        return Result.STARTED;
    }

    synchronized void release(String finishedSessionId) {
        if (finishedSessionId != null && finishedSessionId.equals(sessionId)) sessionId = null;
    }

    synchronized boolean isReserved(String requestedSessionId) {
        return requestedSessionId != null && requestedSessionId.equals(sessionId);
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
