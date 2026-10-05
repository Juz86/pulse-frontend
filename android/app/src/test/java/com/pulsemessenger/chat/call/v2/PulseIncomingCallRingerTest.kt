package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseIncomingCallRingerTest {
    @Test
    fun `only an incoming ringing call plays the incoming alert`() {
        assertTrue(snapshot(PulseCallDirection.INCOMING, PulseCallState.RINGING).shouldPlayIncomingAlert())

        assertFalse(snapshot(PulseCallDirection.OUTGOING, PulseCallState.RINGING).shouldPlayIncomingAlert())
        assertFalse(snapshot(PulseCallDirection.INCOMING, PulseCallState.CONNECTING).shouldPlayIncomingAlert())
        assertFalse(snapshot(PulseCallDirection.INCOMING, PulseCallState.ACTIVE).shouldPlayIncomingAlert())
        assertFalse(snapshot(PulseCallDirection.INCOMING, PulseCallState.ENDING).shouldPlayIncomingAlert())
        assertFalse(snapshot(PulseCallDirection.INCOMING, PulseCallState.ENDED).shouldPlayIncomingAlert())
    }

    private fun snapshot(direction: PulseCallDirection, state: PulseCallState) =
        PulseCallSnapshot(
            sessionId = "session-123",
            direction = direction,
            state = state,
        )
}
