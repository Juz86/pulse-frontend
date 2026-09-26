package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Test

class PulseDefaultNetworkChangeDetectorTest {
    @Test
    fun `reports only an actual default-network replacement`() {
        var changes = 0
        val detector = PulseDefaultNetworkChangeDetector("wifi") { changes += 1 }

        detector.onAvailable("wifi")
        detector.onAvailable("mobile")
        detector.onAvailable("mobile")

        assertEquals(1, changes)
    }

    @Test
    fun `reports network restoration after the default network was lost`() {
        var changes = 0
        val detector = PulseDefaultNetworkChangeDetector("wifi") { changes += 1 }

        detector.onLost("wifi")
        detector.onAvailable("wifi")

        assertEquals(1, changes)
    }
}
