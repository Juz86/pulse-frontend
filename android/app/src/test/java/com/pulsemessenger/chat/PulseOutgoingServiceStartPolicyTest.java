package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class PulseOutgoingServiceStartPolicyTest {
    @Test
    public void activeServiceIsReadyImmediately() {
        assertEquals(
            PulseOutgoingServiceStartPolicy.Result.READY,
            PulseOutgoingServiceStartPolicy.evaluate(true, 0L, 5_000L)
        );
    }

    @Test
    public void inactiveServiceWaitsBeforeDeadline() {
        assertEquals(
            PulseOutgoingServiceStartPolicy.Result.WAITING,
            PulseOutgoingServiceStartPolicy.evaluate(false, 4_999L, 5_000L)
        );
    }

    @Test
    public void inactiveServiceTimesOutAtDeadline() {
        assertEquals(
            PulseOutgoingServiceStartPolicy.Result.TIMED_OUT,
            PulseOutgoingServiceStartPolicy.evaluate(false, 5_000L, 5_000L)
        );
    }
}
