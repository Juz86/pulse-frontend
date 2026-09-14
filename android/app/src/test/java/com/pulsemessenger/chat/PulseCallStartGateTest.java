package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PulseCallStartGateTest {
    @Test
    public void oneSessionCanOnlyStartOnce() {
        PulseCallStartGate gate = new PulseCallStartGate();

        assertEquals(PulseCallStartGate.Result.STARTED, gate.reserve("call-1"));
        assertEquals(PulseCallStartGate.Result.ALREADY_STARTED, gate.reserve("call-1"));
        assertTrue(gate.isReserved("call-1"));
    }

    @Test
    public void anotherSessionIsBusyUntilCurrentCallFinishes() {
        PulseCallStartGate gate = new PulseCallStartGate();

        assertEquals(PulseCallStartGate.Result.STARTED, gate.reserve("call-1"));
        assertEquals(PulseCallStartGate.Result.BUSY, gate.reserve("call-2"));
        gate.release("call-1");
        assertEquals(PulseCallStartGate.Result.STARTED, gate.reserve("call-2"));
    }

    @Test
    public void unrelatedReleaseCannotClearActiveSession() {
        PulseCallStartGate gate = new PulseCallStartGate();

        gate.reserve("call-1");
        gate.release("call-2");
        assertTrue(gate.isReserved("call-1"));
        assertFalse(gate.isReserved("call-2"));
    }

    @Test
    public void blankSessionIsRejected() {
        PulseCallStartGate gate = new PulseCallStartGate();

        assertEquals(PulseCallStartGate.Result.INVALID, gate.reserve(null));
        assertEquals(PulseCallStartGate.Result.INVALID, gate.reserve("  "));
    }
}
