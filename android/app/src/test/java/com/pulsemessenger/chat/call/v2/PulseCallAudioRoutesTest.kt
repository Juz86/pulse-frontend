package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PulseCallAudioRoutesTest {
    @Test
    fun `current route follows the endpoint id reported by Telecom`() {
        val earpiece = PulseAudioRoute("earpiece", "Phone", PulseAudioRouteType.EARPIECE)
        val speaker = PulseAudioRoute("speaker", "Speaker", PulseAudioRouteType.SPEAKER)
        val routes = listOf(earpiece, speaker)

        assertEquals(
            speaker,
            PulseAudioRouteSnapshot(
                sessionId = "session-123",
                availableRoutes = routes,
                currentRouteId = speaker.id,
            ).currentRoute,
        )
        assertEquals(
            earpiece,
            PulseAudioRouteSnapshot(
                sessionId = "session-123",
                availableRoutes = routes,
                currentRouteId = earpiece.id,
            ).currentRoute,
        )
    }

    @Test
    fun `unknown or removed endpoint is not treated as an active route`() {
        assertNull(
            PulseAudioRouteSnapshot(
                sessionId = "session-123",
                availableRoutes = listOf(
                    PulseAudioRoute("speaker", "Speaker", PulseAudioRouteType.SPEAKER),
                ),
                currentRouteId = "bluetooth",
            ).currentRoute,
        )
    }
}
