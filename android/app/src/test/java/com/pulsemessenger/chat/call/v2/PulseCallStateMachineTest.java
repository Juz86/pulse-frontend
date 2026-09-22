package com.pulsemessenger.chat.call.v2;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PulseCallStateMachineTest {
    @Test
    public void outgoingCallCompletesExpectedLifecycle() {
        PulseCallStateMachine machine = new PulseCallStateMachine();

        assertApplied(machine, command("call-a", "event-1", 1, PulseCallEvent.START_OUTGOING), PulseCallState.PREPARING);
        assertEquals(PulseCallRole.OUTGOING, machine.getRole());
        assertApplied(machine, command("call-a", "event-2", 2, PulseCallEvent.SIGNALING_READY), PulseCallState.RINGING);
        assertApplied(machine, command("call-a", "event-3", 3, PulseCallEvent.REMOTE_ACCEPTED), PulseCallState.CONNECTING);
        assertApplied(machine, command("call-a", "event-4", 4, PulseCallEvent.MEDIA_CONNECTED), PulseCallState.ACTIVE);
        assertApplied(machine, command("call-a", "event-5", 5, PulseCallEvent.END_REQUESTED), PulseCallState.ENDING);
        assertApplied(machine, command("call-a", "event-6", 6, PulseCallEvent.CLEANUP_COMPLETED), PulseCallState.ENDED);
        assertApplied(machine, command("call-a", "event-7", 7, PulseCallEvent.RESET), PulseCallState.IDLE);
        assertNull(machine.getSessionId());
    }

    @Test
    public void incomingCallCanOnlyBeAcceptedLocally() {
        PulseCallStateMachine machine = new PulseCallStateMachine();

        assertApplied(machine, command("call-b", "event-1", 1, PulseCallEvent.RECEIVE_INCOMING), PulseCallState.RINGING);
        assertEquals(PulseCallRole.INCOMING, machine.getRole());
        assertEquals(
            PulseCallTransition.Outcome.REJECTED_INVALID_TRANSITION,
            machine.apply(command("call-b", "event-2", 2, PulseCallEvent.REMOTE_ACCEPTED)).getOutcome()
        );
        assertApplied(machine, command("call-b", "event-3", 3, PulseCallEvent.LOCAL_ACCEPTED), PulseCallState.CONNECTING);
    }

    @Test
    public void duplicateEventIsIdempotent() {
        PulseCallStateMachine machine = new PulseCallStateMachine();
        PulseCallCommand start = command("call-c", "event-1", 1, PulseCallEvent.START_OUTGOING);

        assertTrue(machine.apply(start).wasApplied());
        PulseCallTransition duplicate = machine.apply(start);

        assertEquals(PulseCallTransition.Outcome.DUPLICATE, duplicate.getOutcome());
        assertEquals(PulseCallState.PREPARING, machine.getState());
        assertEquals(1, machine.getLastSequence());
    }

    @Test
    public void repeatedStartTapCannotOpenSecondSession() {
        PulseCallStateMachine machine = new PulseCallStateMachine();
        machine.apply(command("call-first", "event-1", 1, PulseCallEvent.START_OUTGOING));

        PulseCallTransition secondStart = machine.apply(
            command("call-second", "event-2", 1, PulseCallEvent.START_OUTGOING)
        );

        assertEquals(PulseCallTransition.Outcome.REJECTED_STALE_SESSION, secondStart.getOutcome());
        assertEquals("call-first", machine.getSessionId());
        assertEquals(PulseCallState.PREPARING, machine.getState());
    }

    @Test
    public void staleSessionAndOutOfOrderEventsAreRejected() {
        PulseCallStateMachine machine = new PulseCallStateMachine();
        machine.apply(command("call-d", "event-1", 10, PulseCallEvent.START_OUTGOING));

        assertEquals(
            PulseCallTransition.Outcome.REJECTED_STALE_SESSION,
            machine.apply(command("other-call", "event-2", 11, PulseCallEvent.SIGNALING_READY)).getOutcome()
        );
        assertEquals(
            PulseCallTransition.Outcome.REJECTED_OUT_OF_ORDER,
            machine.apply(command("call-d", "event-3", 9, PulseCallEvent.SIGNALING_READY)).getOutcome()
        );
        assertEquals(PulseCallState.PREPARING, machine.getState());
    }

    @Test
    public void activeCallReturnsToConnectingDuringNetworkRecovery() {
        PulseCallStateMachine machine = activeOutgoingCall("call-e");

        assertApplied(machine, command("call-e", "event-5", 5, PulseCallEvent.NETWORK_LOST), PulseCallState.CONNECTING);
        assertApplied(machine, command("call-e", "event-6", 6, PulseCallEvent.MEDIA_CONNECTED), PulseCallState.ACTIVE);
    }

    @Test
    public void retiredSessionCannotBeStartedAgain() {
        PulseCallStateMachine machine = activeOutgoingCall("call-f");
        machine.apply(command("call-f", "event-5", 5, PulseCallEvent.END_REQUESTED));
        machine.apply(command("call-f", "event-6", 6, PulseCallEvent.CLEANUP_COMPLETED));
        machine.apply(command("call-f", "event-7", 7, PulseCallEvent.RESET));

        assertEquals(
            PulseCallTransition.Outcome.REJECTED_STALE_SESSION,
            machine.apply(command("call-f", "event-8", 8, PulseCallEvent.START_OUTGOING)).getOutcome()
        );
        assertEquals(PulseCallState.IDLE, machine.getState());
    }

    private static PulseCallStateMachine activeOutgoingCall(String sessionId) {
        PulseCallStateMachine machine = new PulseCallStateMachine();
        machine.apply(command(sessionId, "event-1", 1, PulseCallEvent.START_OUTGOING));
        machine.apply(command(sessionId, "event-2", 2, PulseCallEvent.SIGNALING_READY));
        machine.apply(command(sessionId, "event-3", 3, PulseCallEvent.REMOTE_ACCEPTED));
        machine.apply(command(sessionId, "event-4", 4, PulseCallEvent.MEDIA_CONNECTED));
        return machine;
    }

    private static PulseCallCommand command(String sessionId, String eventId, long sequence, PulseCallEvent event) {
        return new PulseCallCommand(sessionId, eventId, sequence, event);
    }

    private static void assertApplied(
        PulseCallStateMachine machine,
        PulseCallCommand command,
        PulseCallState expectedState
    ) {
        PulseCallTransition result = machine.apply(command);
        assertEquals(PulseCallTransition.Outcome.APPLIED, result.getOutcome());
        assertEquals(expectedState, result.getCurrentState());
        assertEquals(expectedState, machine.getState());
    }
}
