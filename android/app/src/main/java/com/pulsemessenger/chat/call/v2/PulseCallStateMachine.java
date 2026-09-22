package com.pulsemessenger.chat.call.v2;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Deterministic call lifecycle. This class owns no Android, network, or media resources.
 */
public final class PulseCallStateMachine {
    private static final int RETIRED_SESSION_LIMIT = 128;

    private final Set<String> processedEventIds = new HashSet<>();
    private final LinkedHashSet<String> retiredSessionIds = new LinkedHashSet<>();

    private PulseCallState state = PulseCallState.IDLE;
    private PulseCallRole role;
    private String sessionId;
    private long lastSequence;

    public synchronized PulseCallTransition apply(PulseCallCommand command) {
        PulseCallState previous = state;
        if (!isValid(command)) {
            return result(PulseCallTransition.Outcome.REJECTED_MALFORMED, previous);
        }

        String commandSessionId = command.getSessionId();
        if (state == PulseCallState.IDLE) {
            if (retiredSessionIds.contains(commandSessionId)) {
                return result(PulseCallTransition.Outcome.REJECTED_STALE_SESSION, previous);
            }
            return startSession(command, previous);
        }

        if (!commandSessionId.equals(sessionId)) {
            return result(PulseCallTransition.Outcome.REJECTED_STALE_SESSION, previous);
        }
        if (processedEventIds.contains(command.getEventId())) {
            return result(PulseCallTransition.Outcome.DUPLICATE, previous);
        }
        if (command.getSequence() <= lastSequence) {
            return result(PulseCallTransition.Outcome.REJECTED_OUT_OF_ORDER, previous);
        }

        PulseCallState next = resolveNextState(command.getEvent());
        if (next == null) {
            return result(PulseCallTransition.Outcome.REJECTED_INVALID_TRANSITION, previous);
        }

        state = next;
        lastSequence = command.getSequence();
        processedEventIds.add(command.getEventId());
        if (command.getEvent() == PulseCallEvent.RESET) {
            retireCurrentSession();
        }
        return result(PulseCallTransition.Outcome.APPLIED, previous);
    }

    public synchronized PulseCallState getState() {
        return state;
    }

    public synchronized PulseCallRole getRole() {
        return role;
    }

    public synchronized String getSessionId() {
        return sessionId;
    }

    public synchronized long getLastSequence() {
        return lastSequence;
    }

    private PulseCallTransition startSession(PulseCallCommand command, PulseCallState previous) {
        if (command.getEvent() == PulseCallEvent.START_OUTGOING) {
            role = PulseCallRole.OUTGOING;
            state = PulseCallState.PREPARING;
        } else if (command.getEvent() == PulseCallEvent.RECEIVE_INCOMING) {
            role = PulseCallRole.INCOMING;
            state = PulseCallState.RINGING;
        } else {
            return result(PulseCallTransition.Outcome.REJECTED_INVALID_TRANSITION, previous);
        }

        sessionId = command.getSessionId();
        lastSequence = command.getSequence();
        processedEventIds.clear();
        processedEventIds.add(command.getEventId());
        return result(PulseCallTransition.Outcome.APPLIED, previous);
    }

    private PulseCallState resolveNextState(PulseCallEvent event) {
        if (event == PulseCallEvent.END_REQUESTED || event == PulseCallEvent.REMOTE_ENDED
            || event == PulseCallEvent.FAILED || event == PulseCallEvent.TIMED_OUT) {
            return state == PulseCallState.ENDING || state == PulseCallState.ENDED
                ? null
                : PulseCallState.ENDING;
        }

        switch (state) {
            case PREPARING:
                if (event == PulseCallEvent.SIGNALING_READY) return PulseCallState.RINGING;
                if (event == PulseCallEvent.REMOTE_DECLINED) return PulseCallState.ENDING;
                break;
            case RINGING:
                if (event == PulseCallEvent.LOCAL_ACCEPTED && role == PulseCallRole.INCOMING) {
                    return PulseCallState.CONNECTING;
                }
                if (event == PulseCallEvent.REMOTE_ACCEPTED && role == PulseCallRole.OUTGOING) {
                    return PulseCallState.CONNECTING;
                }
                if (event == PulseCallEvent.REMOTE_DECLINED) return PulseCallState.ENDING;
                break;
            case CONNECTING:
                if (event == PulseCallEvent.MEDIA_CONNECTED) return PulseCallState.ACTIVE;
                if (event == PulseCallEvent.NETWORK_LOST) return PulseCallState.CONNECTING;
                break;
            case ACTIVE:
                if (event == PulseCallEvent.NETWORK_LOST) return PulseCallState.CONNECTING;
                break;
            case ENDING:
                if (event == PulseCallEvent.CLEANUP_COMPLETED) return PulseCallState.ENDED;
                break;
            case ENDED:
                if (event == PulseCallEvent.RESET) return PulseCallState.IDLE;
                break;
            default:
                break;
        }
        return null;
    }

    private boolean isValid(PulseCallCommand command) {
        return command != null
            && command.getSessionId() != null
            && !command.getSessionId().trim().isEmpty()
            && command.getEventId() != null
            && !command.getEventId().trim().isEmpty()
            && command.getSequence() > 0;
    }

    private void retireCurrentSession() {
        retiredSessionIds.add(sessionId);
        while (retiredSessionIds.size() > RETIRED_SESSION_LIMIT) {
            retiredSessionIds.remove(retiredSessionIds.iterator().next());
        }
        sessionId = null;
        role = null;
        lastSequence = 0;
        processedEventIds.clear();
    }

    private PulseCallTransition result(PulseCallTransition.Outcome outcome, PulseCallState previous) {
        return new PulseCallTransition(outcome, previous, state);
    }
}
