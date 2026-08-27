package com.pulsemessenger.chat;

final class PulseCallLifecycle {
    enum State {
        IDLE,
        CONNECTING,
        CONNECTED,
        RECONNECTING,
        STOPPED
    }

    private State state = State.IDLE;
    private long recoveryDeadlineMs = -1L;

    synchronized boolean beginAnswer() {
        if (state != State.IDLE) return false;
        state = State.CONNECTING;
        return true;
    }

    synchronized boolean beginRecovery(boolean peerStarted, long nowMs, long timeoutMs) {
        if (!peerStarted || state == State.IDLE || state == State.STOPPED || state == State.RECONNECTING) {
            return false;
        }
        state = State.RECONNECTING;
        recoveryDeadlineMs = nowMs + Math.max(0L, timeoutMs);
        return true;
    }

    synchronized boolean markConnected() {
        if (state == State.IDLE || state == State.STOPPED || state == State.CONNECTED) return false;
        state = State.CONNECTED;
        recoveryDeadlineMs = -1L;
        return true;
    }

    synchronized boolean isRecoveryTimedOut(long nowMs) {
        return state == State.RECONNECTING && recoveryDeadlineMs >= 0L && nowMs >= recoveryDeadlineMs;
    }

    synchronized boolean stop() {
        if (state == State.STOPPED) return false;
        state = State.STOPPED;
        recoveryDeadlineMs = -1L;
        return true;
    }

    synchronized boolean isConnected() {
        return state == State.CONNECTED;
    }

    synchronized boolean isStopped() {
        return state == State.STOPPED;
    }

    synchronized State state() {
        return state;
    }
}
