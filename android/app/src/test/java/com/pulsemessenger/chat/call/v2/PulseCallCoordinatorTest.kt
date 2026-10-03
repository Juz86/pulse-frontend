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
    fun `incoming Telecom answer moves the call to connecting`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.INCOMING))

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onTelecomRegistered("session-one"),
        )
        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onLocalAnswer("session-one"),
        )
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)
        assertEquals(true, coordinator.state.value.telecomRegistered)
        assertEquals(false, coordinator.state.value.telecomActive)
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
    fun `Telecom registration does not invent signaling readiness`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onTelecomRegistered("session-one"),
        )
        assertEquals(PulseCallState.PREPARING, coordinator.state.value.state)
    }

    @Test
    fun `Railway snapshot advances outgoing call using authoritative revision`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onSignalingSnapshot(
                serverSession(state = PulseServerCallState.RINGING, revision = 2),
                localUid = "caller",
            ),
        )
        assertEquals(PulseCallState.RINGING, coordinator.state.value.state)
        assertEquals(2L, coordinator.state.value.signalingRevision)

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onSignalingSnapshot(
                serverSession(state = PulseServerCallState.CONNECTING, revision = 3),
                localUid = "caller",
            ),
        )
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)
    }

    @Test
    fun `stale Railway snapshot cannot roll call state back`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.CONNECTING, revision = 3),
            localUid = "caller",
        )

        assertEquals(
            PulseCoordinatorResult.REJECTED_REVISION,
            coordinator.onSignalingSnapshot(
                serverSession(state = PulseServerCallState.RINGING, revision = 2),
                localUid = "caller",
            ),
        )
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)
        assertEquals(3L, coordinator.state.value.signalingRevision)
    }

    @Test
    fun `Railway terminal snapshot enters ending without pretending cleanup finished`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.RINGING, revision = 2),
            localUid = "caller",
        )

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onSignalingSnapshot(
                serverSession(
                    state = PulseServerCallState.ENDED,
                    revision = 3,
                    terminalByUid = "callee",
                ),
                localUid = "caller",
            ),
        )
        assertEquals(PulseCallState.ENDING, coordinator.state.value.state)
    }

    @Test
    fun `local media readiness waits for authoritative active snapshot`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.CONNECTING, revision = 3),
            localUid = "caller",
        )

        assertEquals(PulseCoordinatorResult.APPLIED, coordinator.onMediaConnected("session-one"))
        assertEquals(true, coordinator.state.value.localMediaReady)
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)

        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.ACTIVE, revision = 4),
            localUid = "caller",
        )
        assertEquals(PulseCallState.ACTIVE, coordinator.state.value.state)
    }

    @Test
    fun `authoritative reconnect moves active call back to connecting`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.CONNECTING, revision = 3),
            localUid = "caller",
        )
        coordinator.onMediaConnected("session-one")
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.ACTIVE, revision = 4),
            localUid = "caller",
        )

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onSignalingSnapshot(
                serverSession(
                    state = PulseServerCallState.CONNECTING,
                    revision = 5,
                    mediaReadyUids = setOf("callee"),
                ),
                localUid = "caller",
            ),
        )
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)
        assertEquals(false, coordinator.state.value.localMediaReady)
    }

    private fun request(
        sessionId: String,
        direction: PulseCallDirection,
    ) = PulseCallRequest(
        sessionId = sessionId,
        displayName = "Test contact",
        direction = direction,
    )

    private fun serverSession(
        state: PulseServerCallState,
        revision: Long,
        terminalByUid: String? = null,
        mediaReadyUids: Set<String> = emptySet(),
    ) = PulseServerCallSession(
        protocolVersion = PULSE_CALL_PROTOCOL_VERSION,
        sessionId = "session-one",
        requestId = "request-one",
        callerUid = "caller",
        calleeUid = "callee",
        mediaType = PulseCallMediaType.AUDIO,
        state = state,
        revision = revision,
        mediaReadyUids = mediaReadyUids,
        terminalReason = if (state == PulseServerCallState.ENDED) "hangup" else null,
        terminalByUid = terminalByUid,
    )
}
