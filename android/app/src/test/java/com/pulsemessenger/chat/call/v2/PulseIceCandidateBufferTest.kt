package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class PulseIceCandidateBufferTest {
    private val first = PulseIceCandidate("audio", 0, "candidate:first")
    private val second = PulseIceCandidate("audio", 0, "candidate:second")

    @Test
    fun `candidates wait for the remote description in arrival order`() {
        val buffer = PulseIceCandidateBuffer()

        assertNull(buffer.offer(first))
        assertNull(buffer.offer(second))

        assertEquals(listOf(first, second), buffer.markRemoteDescriptionApplied())
    }

    @Test
    fun `candidate passes through after remote description`() {
        val buffer = PulseIceCandidateBuffer()
        buffer.markRemoteDescriptionApplied()

        assertEquals(first, buffer.offer(first))
        assertEquals(emptyList<PulseIceCandidate>(), buffer.markRemoteDescriptionApplied())
    }

    @Test
    fun `buffer is bounded`() {
        val buffer = PulseIceCandidateBuffer(capacity = 1)
        buffer.offer(first)

        assertThrows(IllegalStateException::class.java) { buffer.offer(second) }
    }

    @Test
    fun `clear starts a fresh negotiation`() {
        val buffer = PulseIceCandidateBuffer()
        buffer.markRemoteDescriptionApplied()
        buffer.clear()

        assertNull(buffer.offer(first))
        assertEquals(listOf(first), buffer.markRemoteDescriptionApplied())
    }
}
