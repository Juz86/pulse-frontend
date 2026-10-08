package com.pulsemessenger.chat.call.v2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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
    fun `only the current peer can update the live call profile`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(
            request("session-one", PulseCallDirection.OUTGOING).copy(
                photoUrl = "https://cdn.pulse.test/old.jpg",
            ),
        )

        assertEquals(
            PulseCoordinatorResult.REJECTED_SESSION,
            coordinator.onPeerProfileUpdated(
                PulsePeerProfileUpdate("other", "Anders", null, photoUrlChanged = true),
            ),
        )
        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onPeerProfileUpdated(
                PulsePeerProfileUpdate(
                    "callee",
                    "Nieuwe naam",
                    "https://cdn.pulse.test/new.jpg",
                    photoUrlChanged = true,
                ),
            ),
        )
        assertEquals("Nieuwe naam", coordinator.state.value.displayName)
        assertEquals("https://cdn.pulse.test/new.jpg", coordinator.state.value.photoUrl)
    }

    @Test
    fun `confirmed mute state is published only for the active call`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.ACTIVE, revision = 2),
            localUid = "caller",
        )

        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onMutedChanged("session-one", true),
        )
        assertTrue(coordinator.state.value.isMuted)
        assertEquals(
            PulseCoordinatorResult.REJECTED_SESSION,
            coordinator.onMutedChanged("other-session", false),
        )
        assertTrue(coordinator.state.value.isMuted)
        assertEquals(
            PulseCoordinatorResult.APPLIED,
            coordinator.onMutedChanged("session-one", false),
        )
        assertFalse(coordinator.state.value.isMuted)
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
    fun `active timestamp starts on authoritative active transition`() {
        var now = 42_000L
        val coordinator = PulseCallCoordinator.createForTests { now }
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.CONNECTING, revision = 3),
            localUid = "caller",
        )

        assertEquals(null, coordinator.state.value.activeSinceElapsedRealtimeMs)

        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.ACTIVE, revision = 4),
            localUid = "caller",
        )
        assertEquals(42_000L, coordinator.state.value.activeSinceElapsedRealtimeMs)

        now = 99_000L
        coordinator.onTelecomSetActive("session-one")
        assertEquals(42_000L, coordinator.state.value.activeSinceElapsedRealtimeMs)

        coordinator.beginEnding("session-one", remote = false, terminalReason = "hangup")
        assertEquals(42_000L, coordinator.state.value.activeSinceElapsedRealtimeMs)
        assertEquals(57_000L, coordinator.state.value.finalActiveDurationMs)
        assertTrue(coordinator.state.value.wasActive)
    }

    @Test
    fun `declined server reason maps only the outgoing caller to rejected UI`() {
        val coordinator = PulseCallCoordinator.createForTests()
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.RINGING, revision = 2),
            localUid = "caller",
        )

        coordinator.onSignalingSnapshot(
            serverSession(
                state = PulseServerCallState.ENDED,
                revision = 3,
                terminalReason = "declined",
                terminalByUid = "callee",
            ),
            localUid = "caller",
        )
        coordinator.completeCleanup("session-one")

        assertEquals("declined", coordinator.state.value.terminalReason)
        assertEquals(
            PulseCallTerminalPresentation.REJECTED,
            coordinator.state.value.terminalPresentation(),
        )
        assertFalse(coordinator.state.value.wasActive)
    }

    @Test
    fun `normal hangup freezes duration measured only from active`() {
        var now = 10_000L
        val coordinator = PulseCallCoordinator.createForTests { now }
        coordinator.begin(request("session-one", PulseCallDirection.OUTGOING))
        coordinator.onSignalingSnapshot(
            serverSession(state = PulseServerCallState.ACTIVE, revision = 2),
            localUid = "caller",
        )
        now = 42_500L

        coordinator.onSignalingSnapshot(
            serverSession(
                state = PulseServerCallState.ENDED,
                revision = 3,
                terminalReason = "hangup",
                terminalByUid = "callee",
            ),
            localUid = "caller",
        )
        coordinator.completeCleanup("session-one")

        assertEquals(32_500L, coordinator.state.value.finalActiveDurationMs)
        assertEquals(
            PulseCallTerminalPresentation.COMPLETED,
            coordinator.state.value.terminalPresentation(),
        )
    }

    @Test
    fun `cancelled missed and failed calls do not use completed terminal UI`() {
        listOf("cancelled", "missed", "connect_timeout", "signaling_error").forEach { reason ->
            assertEquals(
                null,
                PulseCallSnapshot(
                    direction = PulseCallDirection.OUTGOING,
                    state = PulseCallState.ENDED,
                    wasActive = false,
                    terminalReason = reason,
                ).terminalPresentation(),
            )
        }
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
        peerUid = if (direction == PulseCallDirection.OUTGOING) "callee" else "caller",
        displayName = "Test contact",
        direction = direction,
    )

    private fun serverSession(
        state: PulseServerCallState,
        revision: Long,
        terminalReason: String? = if (state == PulseServerCallState.ENDED) "hangup" else null,
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
        terminalReason = terminalReason,
        terminalByUid = terminalByUid,
    )
}
