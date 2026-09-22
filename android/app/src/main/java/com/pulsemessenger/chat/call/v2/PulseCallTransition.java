package com.pulsemessenger.chat.call.v2;

public final class PulseCallTransition {
    public enum Outcome {
        APPLIED,
        DUPLICATE,
        REJECTED_MALFORMED,
        REJECTED_STALE_SESSION,
        REJECTED_OUT_OF_ORDER,
        REJECTED_INVALID_TRANSITION
    }

    private final Outcome outcome;
    private final PulseCallState previousState;
    private final PulseCallState currentState;

    PulseCallTransition(Outcome outcome, PulseCallState previousState, PulseCallState currentState) {
        this.outcome = outcome;
        this.previousState = previousState;
        this.currentState = currentState;
    }

    public Outcome getOutcome() {
        return outcome;
    }

    public PulseCallState getPreviousState() {
        return previousState;
    }

    public PulseCallState getCurrentState() {
        return currentState;
    }

    public boolean wasApplied() {
        return outcome == Outcome.APPLIED;
    }
}
