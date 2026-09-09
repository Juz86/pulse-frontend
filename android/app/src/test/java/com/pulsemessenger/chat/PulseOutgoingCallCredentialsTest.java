package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class PulseOutgoingCallCredentialsTest {
    @Test
    public void tokenCanOnlyBeConsumedOnce() {
        PulseOutgoingCallCredentials.put("call-1", "token-1");

        assertEquals("token-1", PulseOutgoingCallCredentials.consume("call-1"));
        assertNull(PulseOutgoingCallCredentials.consume("call-1"));
    }

    @Test
    public void blankCredentialsAreNeverStored() {
        int initialSize = PulseOutgoingCallCredentials.sizeForTests();

        PulseOutgoingCallCredentials.put("", "token");
        PulseOutgoingCallCredentials.put("call-2", "");

        assertEquals(initialSize, PulseOutgoingCallCredentials.sizeForTests());
    }

    @Test
    public void tokenCanBeRemovedWhenTelecomRejectsTheCall() {
        PulseOutgoingCallCredentials.put("call-3", "token-3");
        PulseOutgoingCallCredentials.remove("call-3");

        assertNull(PulseOutgoingCallCredentials.consume("call-3"));
    }
}
