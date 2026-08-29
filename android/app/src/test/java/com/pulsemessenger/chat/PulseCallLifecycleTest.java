package com.pulsemessenger.chat;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class PulseCallLifecycleTest {
    @Test
    public void answerStartsOnlyOnce() {
        PulseCallLifecycle lifecycle = new PulseCallLifecycle();

        assertTrue(lifecycle.beginAnswer());
        assertFalse(lifecycle.beginAnswer());
        assertEquals(PulseCallLifecycle.State.CONNECTING, lifecycle.state());
    }

    @Test
    public void recoveryTimesOutAtDeadline() {
        PulseCallLifecycle lifecycle = connectedLifecycle();

        assertTrue(lifecycle.beginRecovery(true, 1_000L, 20_000L));
        assertFalse(lifecycle.isRecoveryTimedOut(20_999L));
        assertTrue(lifecycle.isRecoveryTimedOut(21_000L));
    }

    @Test
    public void connectingCallTimesOutFromInitialServiceStart() {
        PulseCallLifecycle lifecycle = new PulseCallLifecycle();

        assertTrue(lifecycle.beginAnswer(1_000L, 30_000L));
        assertFalse(lifecycle.isConnectionTimedOut(30_999L));
        assertTrue(lifecycle.isConnectionTimedOut(31_000L));
    }

    @Test
    public void connectedCallClearsInitialConnectionDeadline() {
        PulseCallLifecycle lifecycle = new PulseCallLifecycle();

        assertTrue(lifecycle.beginAnswer(1_000L, 30_000L));
        assertTrue(lifecycle.markConnected());
        assertFalse(lifecycle.isConnectionTimedOut(60_000L));
    }

    @Test
    public void reconnectCompletesAndCancelsTimeoutState() {
        PulseCallLifecycle lifecycle = connectedLifecycle();

        assertTrue(lifecycle.beginRecovery(true, 1_000L, 20_000L));
        assertTrue(lifecycle.markConnected());
        assertTrue(lifecycle.isConnected());
        assertFalse(lifecycle.isRecoveryTimedOut(30_000L));
    }

    @Test
    public void recoveryRequiresStartedPeer() {
        PulseCallLifecycle lifecycle = new PulseCallLifecycle();
        assertTrue(lifecycle.beginAnswer());

        assertFalse(lifecycle.beginRecovery(false, 1_000L, 20_000L));
        assertEquals(PulseCallLifecycle.State.CONNECTING, lifecycle.state());
    }

    @Test
    public void duplicateRecoveryDoesNotExtendDeadline() {
        PulseCallLifecycle lifecycle = connectedLifecycle();

        assertTrue(lifecycle.beginRecovery(true, 1_000L, 20_000L));
        assertFalse(lifecycle.beginRecovery(true, 10_000L, 20_000L));
        assertTrue(lifecycle.isRecoveryTimedOut(21_000L));
    }

    @Test
    public void stoppedCallCannotRestartOrRecover() {
        PulseCallLifecycle lifecycle = connectedLifecycle();

        assertTrue(lifecycle.stop());
        assertFalse(lifecycle.stop());
        assertFalse(lifecycle.beginAnswer());
        assertFalse(lifecycle.beginRecovery(true, 1_000L, 20_000L));
        assertFalse(lifecycle.markConnected());
    }

    private PulseCallLifecycle connectedLifecycle() {
        PulseCallLifecycle lifecycle = new PulseCallLifecycle();
        assertTrue(lifecycle.beginAnswer());
        assertTrue(lifecycle.markConnected());
        return lifecycle;
    }
}
