package com.pulsemessenger.chat;

final class PulseOutgoingServiceStartPolicy {
    enum Result {
        WAITING,
        READY,
        TIMED_OUT
    }

    private PulseOutgoingServiceStartPolicy() {}

    static Result evaluate(boolean serviceActive, long elapsedMs, long timeoutMs) {
        if (serviceActive) return Result.READY;
        return elapsedMs >= timeoutMs ? Result.TIMED_OUT : Result.WAITING;
    }
}
