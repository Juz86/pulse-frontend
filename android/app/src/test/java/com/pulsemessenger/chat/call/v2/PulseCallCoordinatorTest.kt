package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Test

class PulseCallCoordinatorTest {
    @Test
    fun `repeated start for the same session is idempotent`() {
        val coordinator = PulseCallCoordinator.createForTests()
        val request = request("session-one", PulseCallDirection.OUTGOING)

        assertEquals(PulseCoordinatorResult.APPLIED, coordinator.begin(request))
        assertEquals(PulseCoordinatorResult.IDEMPOTENT, coordinator.begin(request))
        assertEquals("session-one", coordinator.state.value.sessionId)
        assertEquals("Test contact", coordinator.state.value.displayName)
        assertEquals(PulseCallState.PREPARING, coordinator.state.value.state)
    }

    @Test
    fun `a second live session is rejected`() {
        val coordinator = PulseCallCoordinator.createForTests()

        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))

        assertEquals(
            PulseCoordinatorResult.REJECTED_BUSY,
            coordinator.begin(request("session-two", PulseCallDirection.INCOMING)),
        )
        assertEquals("session-one", coordinator.state.value.sessionId)
    }

    @Test
    fun `incoming Telecom activation moves the call to connecting`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.INCOMING))

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onTelecomRegistered("session-one"),
        )
        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onTelecomSetActive("session-one"),
        )
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)
        assertEquals(true, coordinator.state.value.telecomRegistered)
        assertEquals(true, coordinator.state.value.telecomActive)
    }

    @Test
    fun `disconnect and cleanup reach ended before another session starts`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onTelecomRegistered("session-one")

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.beginEnding("session-one", remote = false),
        )
        assertEquals(PulseCallState.ENDING, coordinator.state.value.state)
        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.completeCleanup("session-one"),
        )
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.begin(request("session-two", PulseCallDirection.OUTGOING)),
        )
        assertEquals("session-two", coordinator.state.value.sessionId)
        assertEquals(PulseCallState.PREPARING, coordinator.state.value.state)
    }

    @Test
    fun `callbacks for a stale session cannot change the active call`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.INCOMING))

        assertEquals(
            PulseCoordinatorResult.REJECTED_SESSION,
            coordinator.onTelecomSetActive("stale-session"),
        )
        assertEquals(PulseCallState.RINGING, coordinator.state.value.state)
    }

    @Test
    fun `outgoing call cannot activate before Telecom registration`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))

        assertEquals(
            PulseCoordinatorResult.REJECTED_TRANSITION,
            coordinator.onTelecomSetActive("session-one"),
        )
        assertEquals(false, coordinator.state.value.telecomActive)
        assertEquals(PulseCallState.PREPARING, coordinator.state.value.state)
    }

    private fun request(
        sessionId: String,
        direction: PulseCallDirection,
    ) = PulseCallRequest(
        sessionId = sessionId,
        displayName = "Test contact",
        direction = direction,
    )
}
