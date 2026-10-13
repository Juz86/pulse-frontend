package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseTabletCallPanelPolicyTest {
    @Test
    fun `uses panel on a wide landscape tablet`() {
        assertTrue(PulseTabletCallPanelPolicy.shouldUsePanel(600, 1280, true))
    }

    @Test
    fun `keeps full screen call UI on phones`() {
        assertFalse(PulseTabletCallPanelPolicy.shouldUsePanel(411, 915, true))
    }

    @Test
    fun `keeps full screen call UI in tablet portrait`() {
        assertFalse(PulseTabletCallPanelPolicy.shouldUsePanel(600, 800, false))
    }

    @Test
    fun `keeps full screen call UI when three columns do not fit`() {
        assertFalse(PulseTabletCallPanelPolicy.shouldUsePanel(600, 839, true))
    }

    @Test
    fun `incoming ringing call remains in Android incoming call UI`() {
        assertFalse(
            PulseTabletCallPanelPolicy.shouldDisplayCall(
                PulseCallState.RINGING,
                PulseCallDirection.INCOMING,
                false,
            ),
        )
    }

    @Test
    fun `answered incoming call opens tablet panel`() {
        assertTrue(
            PulseTabletCallPanelPolicy.shouldDisplayCall(
                PulseCallState.ACTIVE,
                PulseCallDirection.INCOMING,
                false,
            ),
        )
    }

    @Test
    fun `outgoing ringing call opens tablet panel`() {
        assertTrue(
            PulseTabletCallPanelPolicy.shouldDisplayCall(
                PulseCallState.RINGING,
                PulseCallDirection.OUTGOING,
                false,
            ),
        )
    }
}
