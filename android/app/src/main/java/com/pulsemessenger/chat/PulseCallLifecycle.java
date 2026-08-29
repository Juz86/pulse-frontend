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
    private long connectionDeadlineMs = -1L;

    synchronized boolean beginAnswer() {
        return beginAnswer(-1L, 0L);
    }

    synchronized boolean beginAnswer(long nowMs, long timeoutMs) {
        if (state != State.IDLE) return false;
        state = State.CONNECTING;
        connectionDeadlineMs = nowMs < 0L ? -1L : nowMs + Math.max(0L, timeoutMs);
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
        connectionDeadlineMs = -1L;
        return true;
    }

    synchronized boolean isConnectionTimedOut(long nowMs) {
        return state == State.CONNECTING && connectionDeadlineMs >= 0L && nowMs >= connectionDeadlineMs;
    }

    synchronized boolean isRecoveryTimedOut(long nowMs) {
        return state == State.RECONNECTING && recoveryDeadlineMs >= 0L && nowMs >= recoveryDeadlineMs;
    }

    synchronized boolean isExpired(long nowMs) {
        return isConnectionTimedOut(nowMs) || isRecoveryTimedOut(nowMs);
    }

    synchronized boolean stop() {
        if (state == State.STOPPED) return false;
        state = State.STOPPED;
        recoveryDeadlineMs = -1L;
        connectionDeadlineMs = -1L;
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
