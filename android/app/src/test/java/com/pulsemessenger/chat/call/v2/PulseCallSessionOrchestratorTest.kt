package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseCallSessionOrchestratorTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    private var orchestrator: PulseCallSessionOrchestrator? = null

    @After
    fun tearDown() {
        orchestrator?.shutdown()
    }

    @Test
    fun `outgoing launch creates Railway session before Telecom and invite`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            startResponse = response(session(PulseServerCallState.PREPARING, revision = 1))
            commandResponses += response(session(PulseServerCallState.RINGING, revision = 2))
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom, identityUid = "caller")

        val result = subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )

        assertEquals(PulseCallLaunchResult.STARTED, result)
        assertEquals(listOf("start", "command:INVITE_READY"), signaling.operations)
        assertEquals("session-123", telecom.addedRequest?.sessionId)
        assertEquals(PulseCallState.RINGING, coordinator.state.value.state)
        assertEquals(2L, coordinator.state.value.signalingRevision)
    }

    @Test
    fun `incoming answer sends accept before activating Telecom`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(session(PulseServerCallState.CONNECTING, revision = 3))
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom)

        assertEquals(
            PulseCallLaunchResult.STARTED,
            subject.registerIncoming("session-123", "Test contact"),
        )
        telecom.callbacks?.onAnswer("session-123", 0)

        assertEquals(listOf("snapshot", "command:ACCEPT"), signaling.operations)
        assertEquals(listOf("session-123"), telecom.activatedSessions)
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)
    }

    @Test
    fun `remote end disconnects Telecom and completes local cleanup`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom)
        subject.registerIncoming("session-123", "Test contact")

        signaling.listener?.onSessionUpdated(
            session(
                state = PulseServerCallState.ENDED,
                revision = 3,
                terminalByUid = "caller",
            ),
        )

        assertEquals(listOf("session-123"), telecom.disconnectedSessions)
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
        assertTrue(signaling.disconnected)
    }

    @Test
    fun `local disconnect sends end once and completes cleanup`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            startResponse = response(session(PulseServerCallState.PREPARING, revision = 1))
            commandResponses += response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(
                session(
                    state = PulseServerCallState.ENDED,
                    revision = 3,
                    terminalByUid = "caller",
                ),
            )
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom, identityUid = "caller")
        subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )

        telecom.callbacks?.onDisconnect(
            "session-123",
            DisconnectCause(DisconnectCause.LOCAL),
        )

        assertEquals(
            listOf("start", "command:INVITE_READY", "command:END"),
            signaling.operations,
        )
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
        assertTrue(signaling.disconnected)
    }

    @Test
    fun `missing Firebase identity fails before contacting Railway`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling()
        val telecom = FakeTelecom()
        val subject = PulseCallSessionOrchestrator(
            scope = scope,
            identityProvider = PulseCallIdentityProvider { null },
            signaling = signaling,
            telecom = telecom,
            coordinator = coordinator,
        ).also { orchestrator = it }

        val result = subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )

        assertEquals(PulseCallLaunchResult.AUTH_REQUIRED, result)
        assertTrue(signaling.operations.isEmpty())
        assertEquals(null, telecom.addedRequest)
    }

    private fun subject(
        coordinator: PulseCallCoordinator,
        signaling: FakeSignaling,
        telecom: FakeTelecom,
        identityUid: String = "callee",
    ) = PulseCallSessionOrchestrator(
        scope = scope,
        identityProvider = PulseCallIdentityProvider {
            PulseCallIdentity(uid = identityUid, authToken = "firebase-token")
        },
        signaling = signaling,
        telecom = telecom,
        coordinator = coordinator,
    ).also { orchestrator = it }

    private fun response(session: PulseServerCallSession) = PulseSignalingResponse(
        ok = true,
        status = when (session.state) {
            PulseServerCallState.PREPARING -> PulseSignalingStatus.CREATED
            else -> PulseSignalingStatus.APPLIED
        },
        session = session,
    )

    private fun session(
        state: PulseServerCallState,
        revision: Long,
        terminalByUid: String? = null,
    ) = PulseServerCallSession(
        protocolVersion = PULSE_CALL_PROTOCOL_VERSION,
        sessionId = "session-123",
        requestId = "request-123",
        callerUid = "caller",
        calleeUid = "callee",
        mediaType = PulseCallMediaType.AUDIO,
        state = state,
        revision = revision,
        mediaReadyUids = emptySet(),
        terminalReason = if (state == PulseServerCallState.ENDED) "hangup" else null,
        terminalByUid = terminalByUid,
    )

    private class FakeSignaling : PulseCallSignalingGateway {
        var listener: PulseCallSignalingListener? = null
        var startResponse: PulseSignalingResponse? = null
        var snapshotResponse: PulseSignalingResponse? = null
        val commandResponses = ArrayDeque<PulseSignalingResponse>()
        val operations = mutableListOf<String>()
        var disconnected = false

        override suspend fun connect(authToken: String, listener: PulseCallSignalingListener) {
            this.listener = listener
            disconnected = false
        }

        override suspend fun startCall(
            requestId: String,
            calleeUid: String,
            mediaType: PulseCallMediaType,
        ): PulseSignalingResponse {
            operations += "start"
            return requireNotNull(startResponse)
        }

        override suspend fun sendCommand(
            sessionId: String,
            eventId: String,
            expectedRevision: Long,
            command: PulseSignalingCommand,
            reason: String?,
        ): PulseSignalingResponse {
            operations += "command:${command.name}"
            return commandResponses.removeFirst()
        }

        override suspend fun fetchSnapshot(sessionId: String): PulseSignalingResponse {
            operations += "snapshot"
            return requireNotNull(snapshotResponse)
        }

        override suspend fun fetchIceConfiguration(sessionId: String) =
            PulseIceConfigurationResponse(
                ok = false,
                status = PulseSignalingStatus.SERVICE_UNAVAILABLE,
            )

        override suspend fun sendDescription(
            sessionId: String,
            messageId: String,
            description: PulseSessionDescription,
        ) = PulseSignalingResponse(false, PulseSignalingStatus.SERVICE_UNAVAILABLE)

        override suspend fun sendIceCandidate(
            sessionId: String,
            messageId: String,
            candidate: PulseIceCandidate,
        ) = PulseSignalingResponse(false, PulseSignalingStatus.SERVICE_UNAVAILABLE)

        override fun disconnect() {
            disconnected = true
        }
    }

    private class FakeTelecom : PulseTelecomController {
        var addedRequest: PulseCallRequest? = null
        var callbacks: PulseTelecomCallbacks? = null
        val activatedSessions = mutableListOf<String>()
        val disconnectedSessions = mutableListOf<String>()
        private val lifetime = CompletableDeferred<Unit>()

        override fun registerApp() = Unit

        override suspend fun addCall(
            request: PulseCallRequest,
            callbacks: PulseTelecomCallbacks,
        ) {
            addedRequest = request
            this.callbacks = callbacks
            callbacks.onRegistered(request.sessionId)
            lifetime.await()
        }

        override suspend fun setActive(sessionId: String): Boolean {
            activatedSessions += sessionId
            callbacks?.onSetActive(sessionId)
            return true
        }

        override suspend fun disconnect(sessionId: String, cause: DisconnectCause): Boolean {
            disconnectedSessions += sessionId
            callbacks?.onDisconnect(sessionId, cause)
            lifetime.complete(Unit)
            return true
        }
    }
}
