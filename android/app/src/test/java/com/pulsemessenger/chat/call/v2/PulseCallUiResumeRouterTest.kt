package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseCallUiResumeRouterTest {
    @Test
    fun `restores an active phone call`() {
        assertTrue(PulseCallUiResumeRouter.shouldRestore("call-1", PulseCallState.ACTIVE, false))
    }

    @Test
    fun `restores a reconnecting phone call`() {
        assertTrue(
            PulseCallUiResumeRouter.shouldRestore("call-1", PulseCallState.CONNECTING, false),
        )
    }

    @Test
    fun `does not restore terminal or missing calls`() {
        assertFalse(PulseCallUiResumeRouter.shouldRestore("call-1", PulseCallState.ENDED, false))
        assertFalse(PulseCallUiResumeRouter.shouldRestore(null, PulseCallState.ACTIVE, false))
    }

    @Test
    fun `leaves active tablet calls in the embedded panel`() {
        assertFalse(PulseCallUiResumeRouter.shouldRestore("call-1", PulseCallState.ACTIVE, true))
    }
}
