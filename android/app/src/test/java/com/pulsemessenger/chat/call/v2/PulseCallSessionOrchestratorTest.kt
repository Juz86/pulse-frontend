package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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
        runBlocking {
            orchestrator?.shutdown()
        }
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
            photoUrl = "https://cdn.pulse.test/contact.jpg",
            mediaType = PulseCallMediaType.AUDIO,
        )

        assertEquals(PulseCallLaunchResult.STARTED, result)
        assertEquals(listOf("start", "command:INVITE_READY"), signaling.operations)
        assertEquals("session-123", telecom.addedRequest?.sessionId)
        assertEquals(PulseCallState.RINGING, coordinator.state.value.state)
        assertEquals("https://cdn.pulse.test/contact.jpg", coordinator.state.value.photoUrl)
        assertEquals(2L, coordinator.state.value.signalingRevision)
    }

    @Test
    fun `repeated outgoing launch creates only one Railway and Telecom session`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            startResponse = response(session(PulseServerCallState.PREPARING, revision = 1))
            commandResponses += response(session(PulseServerCallState.RINGING, revision = 2))
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom, identityUid = "caller")

        val first = subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )
        val repeated = subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )

        assertEquals(PulseCallLaunchResult.STARTED, first)
        assertEquals(PulseCallLaunchResult.BUSY, repeated)
        assertEquals(1, signaling.operations.count { it == "start" })
        assertEquals("session-123", telecom.addedRequest?.sessionId)
    }

    @Test
    fun `replayed incoming wake creates only one snapshot and Telecom call`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom)

        assertEquals(PulseCallLaunchResult.STARTED, subject.registerIncoming("session-123", "Test contact"))
        assertEquals(PulseCallLaunchResult.BUSY, subject.registerIncoming("session-123", "Test contact"))
        assertEquals(listOf("snapshot"), signaling.operations)
        assertEquals("session-123", telecom.addedRequest?.sessionId)
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
        assertEquals("test-installation", signaling.commandInstallationIds.single())
    }

    @Test
    fun `callee device that loses accept race stops locally without ending server call`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
        }
        val telecom = FakeTelecom()
        val engine = FakeMediaEngine()
        val subject = subject(coordinator, signaling, telecom, mediaEngine = engine)
        subject.registerIncoming("session-123", "Test contact")

        signaling.listener?.onSessionUpdated(
            session(
                state = PulseServerCallState.CONNECTING,
                revision = 3,
                acceptedInstallationId = "other-installation",
            ),
        )

        assertEquals(listOf("session-123"), telecom.disconnectedSessions)
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
        assertEquals(0, engine.startCount)
        assertEquals(listOf("snapshot"), signaling.operations)
    }

    @Test
    fun `taken elsewhere wake is verified against Railway before stopping Telecom`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom)
        subject.registerIncoming("session-123", "Test contact")
        signaling.snapshotResponse = response(
            session(
                state = PulseServerCallState.CONNECTING,
                revision = 3,
                acceptedInstallationId = "authoritative-winner",
            ),
        )

        val stale = subject.reconcileTakenElsewhere("session-123", "different-winner")
        val verified = subject.reconcileTakenElsewhere("session-123", "authoritative-winner")

        assertEquals(PulseTakenElsewhereReconcileResult.REJECTED, stale)
        assertEquals(PulseTakenElsewhereReconcileResult.RECONCILED, verified)
        assertEquals(listOf("session-123"), telecom.disconnectedSessions)
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
    }

    @Test
    fun `notification answer asks Telecom to answer and sends accept once`() = runBlocking {
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
        subject.requestAnswer("session-123")

        assertEquals(listOf("session-123"), telecom.answeredSessions)
        assertEquals(listOf("snapshot", "command:ACCEPT"), signaling.operations)
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)
    }

    @Test
    fun `disconnect completes on first request when Telecom omits its callback`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(
                session(
                    state = PulseServerCallState.ENDED,
                    revision = 3,
                    terminalByUid = "callee",
                ),
            )
        }
        val telecom = FakeTelecom().apply { dispatchDisconnectCallback = false }
        val subject = subject(coordinator, signaling, telecom)
        subject.registerIncoming("session-123", "Test contact")

        subject.requestDisconnect("session-123")

        assertEquals(listOf("session-123"), telecom.disconnectedSessions)
        assertEquals(listOf("snapshot", "command:DECLINE"), signaling.operations)
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
    }

    @Test
    fun `failed accept ends Telecom and cleans up instead of remaining connecting`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += PulseSignalingResponse(
                ok = false,
                status = PulseSignalingStatus.SERVICE_UNAVAILABLE,
            )
            commandResponses += response(
                session(
                    state = PulseServerCallState.ENDED,
                    revision = 3,
                    terminalByUid = "callee",
                ),
            )
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom)

        assertEquals(
            PulseCallLaunchResult.STARTED,
            subject.registerIncoming("session-123", "Test contact"),
        )
        telecom.callbacks?.onAnswer("session-123", 0)

        assertEquals(
            listOf("snapshot", "command:ACCEPT", "command:FAIL"),
            signaling.operations,
        )
        assertEquals(
            PulseSignalingCommand.FAIL to "signaling_error",
            signaling.commandReasons.last(),
        )
        assertEquals(listOf("session-123"), telecom.disconnectedSessions)
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
        assertTrue(signaling.disconnected)
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
    fun `terminal wake reconciles an active local call through its server snapshot`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom)
        subject.registerIncoming("session-123", "Test contact")
        signaling.snapshotResponse = response(
            session(
                PulseServerCallState.ENDED,
                revision = 3,
                terminalByUid = "caller",
            ),
        )

        val result = subject.reconcileTerminal("session-123")

        assertEquals(PulseTerminalReconcileResult.RECONCILED, result)
        assertEquals(listOf("session-123"), telecom.disconnectedSessions)
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
        assertTrue(signaling.disconnected)
    }

    @Test
    fun `terminal wake verifies an ended session without creating a Telecom call`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(
                session(
                    PulseServerCallState.ENDED,
                    revision = 3,
                    terminalByUid = "caller",
                ),
            )
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom)

        val result = subject.reconcileTerminal("session-123")

        assertEquals(PulseTerminalReconcileResult.VERIFIED_ENDED, result)
        assertEquals(null, telecom.addedRequest)
        assertEquals(PulseCallState.IDLE, coordinator.state.value.state)
        assertTrue(signaling.disconnected)
    }

    @Test
    fun `stale terminal wake cannot stop a call the server still reports as ringing`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom)
        subject.registerIncoming("session-123", "Test contact")

        val result = subject.reconcileTerminal("session-123")

        assertEquals(PulseTerminalReconcileResult.REJECTED, result)
        assertTrue(telecom.disconnectedSessions.isEmpty())
        assertEquals(PulseCallState.RINGING, coordinator.state.value.state)
    }

    @Test
    fun `active outgoing call recovers from Railway and starts fresh media negotiation`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.ACTIVE, revision = 4))
            commandResponses += response(
                session(
                    state = PulseServerCallState.CONNECTING,
                    revision = 5,
                    iceRestartSequence = 1,
                ),
            )
        }
        val telecom = FakeTelecom()
        val engine = FakeMediaEngine()
        val records = mutableListOf<PulseCallRecoveryRecord?>()
        val subject = subject(
            coordinator = coordinator,
            signaling = signaling,
            telecom = telecom,
            identityUid = "caller",
            mediaEngine = engine,
            onRecoveryRecordChanged = records::add,
        )

        val result = subject.recover(
            PulseCallRecoveryRecord(
                sessionId = "session-123",
                ownerUid = "caller",
                peerUid = "callee",
                displayName = "Test contact",
                direction = PulseCallDirection.OUTGOING,
                mediaType = PulseCallMediaType.AUDIO,
            ),
        )

        assertEquals(PulseCallRecoveryResult.RECOVERED, result)
        assertEquals(listOf("snapshot", "command:NETWORK_LOST", "ice"), signaling.operations)
        assertEquals(listOf("session-123"), telecom.activatedSessions)
        assertEquals(1, engine.startCount)
        assertEquals(1, engine.restartCount)
        assertEquals("session-123", records.single()?.sessionId)
        assertEquals(PulseCallState.CONNECTING, coordinator.state.value.state)
    }

    @Test
    fun `winning incoming installation recovers as WebRTC answerer`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(
                session(
                    state = PulseServerCallState.ACTIVE,
                    revision = 4,
                    acceptedInstallationId = "test-installation",
                ),
            )
            commandResponses += response(
                session(
                    state = PulseServerCallState.CONNECTING,
                    revision = 5,
                    iceRestartSequence = 1,
                    acceptedInstallationId = "test-installation",
                ),
            )
        }
        val telecom = FakeTelecom()
        val engine = FakeMediaEngine()
        val subject = subject(coordinator, signaling, telecom, mediaEngine = engine)

        val result = subject.recover(
            PulseCallRecoveryRecord(
                sessionId = "session-123",
                ownerUid = "callee",
                peerUid = "caller",
                displayName = "Test contact",
                direction = PulseCallDirection.INCOMING,
                mediaType = PulseCallMediaType.AUDIO,
            ),
        )

        assertEquals(PulseCallRecoveryResult.RECOVERED, result)
        assertEquals(PulseMediaRole.ANSWERER, engine.config?.role)
        assertEquals(1, engine.startCount)
        assertEquals(0, engine.restartCount)
        assertEquals(listOf("session-123"), telecom.activatedSessions)
    }

    @Test
    fun `ended session is rejected during process recovery without recreating Telecom`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(
                session(
                    state = PulseServerCallState.ENDED,
                    revision = 5,
                    terminalByUid = "callee",
                ),
            )
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom, identityUid = "caller")

        val result = subject.recover(
            PulseCallRecoveryRecord(
                sessionId = "session-123",
                ownerUid = "caller",
                peerUid = "callee",
                displayName = "Test contact",
                direction = PulseCallDirection.OUTGOING,
                mediaType = PulseCallMediaType.AUDIO,
            ),
        )

        assertEquals(PulseCallRecoveryResult.STALE, result)
        assertEquals(null, telecom.addedRequest)
        assertEquals(PulseCallState.IDLE, coordinator.state.value.state)
        assertTrue(signaling.disconnected)
    }

    @Test
    fun `temporary snapshot outage remains retryable during process recovery`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = PulseSignalingResponse(
                ok = false,
                status = PulseSignalingStatus.SERVICE_UNAVAILABLE,
            )
        }
        val telecom = FakeTelecom()
        val subject = subject(coordinator, signaling, telecom, identityUid = "caller")

        val result = subject.recover(
            PulseCallRecoveryRecord(
                sessionId = "session-123",
                ownerUid = "caller",
                peerUid = "callee",
                displayName = "Test contact",
                direction = PulseCallDirection.OUTGOING,
                mediaType = PulseCallMediaType.AUDIO,
            ),
        )

        assertEquals(PulseCallRecoveryResult.SIGNALING_UNAVAILABLE, result)
        assertEquals(null, telecom.addedRequest)
        assertEquals(PulseCallState.IDLE, coordinator.state.value.state)
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
    fun `accepted call starts audio and reports media connected to Railway`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(session(PulseServerCallState.CONNECTING, revision = 3))
            commandResponses += response(session(PulseServerCallState.ACTIVE, revision = 4))
        }
        val engine = FakeMediaEngine()
        val telecom = FakeTelecom()
        val subject = subject(
            coordinator = coordinator,
            signaling = signaling,
            telecom = telecom,
            mediaEngine = engine,
        )

        assertEquals(
            PulseCallLaunchResult.STARTED,
            subject.registerIncoming("session-123", "Test contact"),
        )
        telecom.callbacks?.onAnswer("session-123", 0)

        assertEquals(PulseMediaRole.ANSWERER, engine.config?.role)
        signaling.listener?.onMediaSignal(
            PulseRemoteDescriptionSignal(
                sessionId = "session-123",
                messageId = "message-123",
                senderUid = "caller",
                description = PulseSessionDescription(PulseSessionDescriptionType.OFFER, "v=0"),
            ),
        )
        assertEquals(1, engine.remoteDescriptions.size)

        engine.listener?.onMediaStateChanged(PulseMediaState.CONNECTED)

        assertEquals(
            listOf("snapshot", "command:ACCEPT", "ice", "command:MEDIA_CONNECTED"),
            signaling.operations,
        )
        assertEquals(PulseCallState.ACTIVE, coordinator.state.value.state)
        assertTrue(coordinator.state.value.localMediaReady)
    }

    @Test
    fun `microphone foreground rejection fails call before WebRTC capture`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            startResponse = response(session(PulseServerCallState.PREPARING, revision = 1))
            commandResponses += response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(
                session(
                    state = PulseServerCallState.ENDED,
                    revision = 4,
                    terminalByUid = "caller",
                ),
            )
        }
        val engine = FakeMediaEngine()
        val telecom = FakeTelecom()
        val subject = subject(
            coordinator = coordinator,
            signaling = signaling,
            telecom = telecom,
            identityUid = "caller",
            mediaEngine = engine,
            beforeMediaStart = { false },
        )
        subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )

        signaling.listener?.onSessionUpdated(
            session(PulseServerCallState.CONNECTING, revision = 3),
        )

        assertEquals(0, engine.startCount)
        assertEquals(PulseSignalingCommand.FAIL to "media_error", signaling.commandReasons.last())
        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
        assertEquals(listOf("session-123"), telecom.disconnectedSessions)
    }

    @Test
    fun `default-network change requests one server-coordinated ICE restart`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            startResponse = response(session(PulseServerCallState.PREPARING, revision = 1))
            commandResponses += response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(session(PulseServerCallState.ACTIVE, revision = 4))
            commandResponses += response(
                session(
                    state = PulseServerCallState.CONNECTING,
                    revision = 5,
                    iceRestartSequence = 1,
                ),
            )
        }
        val engine = FakeMediaEngine()
        val subject = subject(
            coordinator = coordinator,
            signaling = signaling,
            telecom = FakeTelecom(),
            identityUid = "caller",
            mediaEngine = engine,
        )
        subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )
        signaling.listener?.onSessionUpdated(
            session(PulseServerCallState.CONNECTING, revision = 3),
        )
        engine.listener?.onMediaStateChanged(PulseMediaState.CONNECTED)

        subject.onNetworkChanged("session-123")
        subject.onNetworkChanged("session-123")
        signaling.listener?.onSessionUpdated(
            session(
                state = PulseServerCallState.CONNECTING,
                revision = 6,
                iceRestartSequence = 1,
            ),
        )

        assertEquals(1, engine.restartCount)
        assertEquals(1, signaling.operations.count { it == "command:NETWORK_LOST" })
    }

    @Test
    fun `socket reconnect flushes one pending server-coordinated ICE restart`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            startResponse = response(session(PulseServerCallState.PREPARING, revision = 1))
            commandResponses += response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(session(PulseServerCallState.ACTIVE, revision = 4))
            commandResponses += response(
                session(
                    state = PulseServerCallState.CONNECTING,
                    revision = 5,
                    iceRestartSequence = 1,
                ),
            )
        }
        val engine = FakeMediaEngine()
        val subject = subject(
            coordinator = coordinator,
            signaling = signaling,
            telecom = FakeTelecom(),
            identityUid = "caller",
            mediaEngine = engine,
        )
        subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )
        signaling.listener?.onSessionUpdated(
            session(PulseServerCallState.CONNECTING, revision = 3),
        )
        engine.listener?.onMediaStateChanged(PulseMediaState.CONNECTED)

        signaling.listener?.onConnectionChanged(false)
        signaling.listener?.onConnectionChanged(true)
        signaling.listener?.onConnectionChanged(true)

        assertEquals(1, engine.restartCount)
        assertEquals(1, signaling.operations.count { it == "command:NETWORK_LOST" })
    }

    @Test
    fun `callee accepts caller ICE restart without creating a competing restart`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(session(PulseServerCallState.CONNECTING, revision = 3))
        }
        val engine = FakeMediaEngine()
        val telecom = FakeTelecom()
        val subject = subject(
            coordinator = coordinator,
            signaling = signaling,
            telecom = telecom,
            identityUid = "callee",
            mediaEngine = engine,
        )
        subject.registerIncoming("session-123", "Test contact")
        telecom.callbacks?.onAnswer("session-123", 0)

        signaling.listener?.onSessionUpdated(
            session(
                state = PulseServerCallState.CONNECTING,
                revision = 4,
                iceRestartSequence = 1,
            ),
        )

        assertEquals(0, engine.restartCount)
        assertEquals(0, signaling.operations.count { it == "command:NETWORK_LOST" })
        assertEquals(1, engine.startCount)
    }

    @Test
    fun `media failure ends call and releases engine exactly once`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            snapshotResponse = response(session(PulseServerCallState.RINGING, revision = 2))
            commandResponses += response(session(PulseServerCallState.CONNECTING, revision = 3))
            commandResponses += response(
                session(
                    state = PulseServerCallState.ENDED,
                    revision = 4,
                    terminalByUid = "callee",
                ),
            )
        }
        val engine = FakeMediaEngine()
        val telecom = FakeTelecom()
        val failures = mutableListOf<Pair<String, String>>()
        val subject = subject(
            coordinator = coordinator,
            signaling = signaling,
            telecom = telecom,
            identityUid = "callee",
            mediaEngine = engine,
            onCallFailure = { sessionId, reason -> failures += sessionId to reason },
        )
        subject.registerIncoming("session-123", "Test contact")
        telecom.callbacks?.onAnswer("session-123", 0)

        engine.listener?.onMediaFailure("ice_failed")
        engine.listener?.onMediaFailure("ice_failed_again")

        assertEquals(PulseCallState.ENDED, coordinator.state.value.state)
        assertEquals(1, engine.closeCount)
        assertEquals(1, signaling.operations.count { it == "command:FAIL" })
        assertEquals(listOf("session-123"), telecom.disconnectedSessions)
        assertEquals(listOf("session-123" to "media_error"), failures)
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

    @Test
    fun `rate limited start is reported distinctly`() = runBlocking {
        val coordinator = PulseCallCoordinator.createForTests()
        val signaling = FakeSignaling().apply {
            startResponse = PulseSignalingResponse(false, PulseSignalingStatus.RATE_LIMITED)
        }
        val telecom = FakeTelecom()
        val subject = subject(
            coordinator = coordinator,
            signaling = signaling,
            telecom = telecom,
            identityUid = "caller",
        ).also { orchestrator = it }

        val result = subject.startOutgoing(
            requestId = "request-123",
            calleeUid = "callee",
            displayName = "Test contact",
            mediaType = PulseCallMediaType.AUDIO,
        )

        assertEquals(PulseCallLaunchResult.RATE_LIMITED, result)
        assertTrue(signaling.disconnected)
        assertEquals(null, telecom.addedRequest)
    }

    private fun subject(
        coordinator: PulseCallCoordinator,
        signaling: FakeSignaling,
        telecom: FakeTelecom,
        identityUid: String = "callee",
        installationId: String = "test-installation",
        mediaEngine: FakeMediaEngine? = null,
        beforeMediaStart: () -> Boolean = { true },
        onRecoveryRecordChanged: (PulseCallRecoveryRecord?) -> Unit = {},
        onCallFailure: (String, String) -> Unit = { _, _ -> },
    ) = PulseCallSessionOrchestrator(
        scope = scope,
        identityProvider = PulseCallIdentityProvider {
            PulseCallIdentity(
                uid = identityUid,
                authToken = "firebase-token",
                installationId = installationId,
            )
        },
        signaling = signaling,
        telecom = telecom,
        coordinator = coordinator,
        mediaEngineFactory = mediaEngine?.let { engine ->
            PulseCallMediaEngineFactory { engine }
        },
        beforeMediaStart = beforeMediaStart,
        onRecoveryRecordChanged = onRecoveryRecordChanged,
        onCallFailure = onCallFailure,
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
        iceRestartSequence: Long = 0,
        acceptedInstallationId: String? = null,
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
        acceptedInstallationId = acceptedInstallationId,
        iceRestartSequence = iceRestartSequence,
    )

    private class FakeSignaling : PulseCallSignalingGateway {
        var listener: PulseCallSignalingListener? = null
        var startResponse: PulseSignalingResponse? = null
        var snapshotResponse: PulseSignalingResponse? = null
        val commandResponses = ArrayDeque<PulseSignalingResponse>()
        val operations = mutableListOf<String>()
        val commandReasons = mutableListOf<Pair<PulseSignalingCommand, String?>>()
        val commandInstallationIds = mutableListOf<String?>()
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
            installationId: String?,
        ): PulseSignalingResponse {
            operations += "command:${command.name}"
            commandReasons += command to reason
            commandInstallationIds += installationId
            return commandResponses.removeFirst()
        }

        override suspend fun fetchSnapshot(sessionId: String): PulseSignalingResponse {
            operations += "snapshot"
            return requireNotNull(snapshotResponse)
        }

        override suspend fun fetchIceConfiguration(sessionId: String): PulseIceConfigurationResponse {
            operations += "ice"
            return PulseIceConfigurationResponse(
                ok = true,
                status = PulseSignalingStatus.FOUND,
                iceServers = listOf(
                    PulseIceServer(
                        urls = listOf("turns:turn.cloudflare.com:443?transport=tcp"),
                        username = "temporary-user",
                        credential = "temporary-secret",
                    ),
                ),
            )
        }

        override suspend fun sendDescription(
            sessionId: String,
            messageId: String,
            description: PulseSessionDescription,
        ) = PulseSignalingResponse(true, PulseSignalingStatus.RELAYED)

        override suspend fun sendIceCandidate(
            sessionId: String,
            messageId: String,
            candidate: PulseIceCandidate,
        ) = PulseSignalingResponse(true, PulseSignalingStatus.RELAYED)

        override fun disconnect() {
            disconnected = true
        }
    }

    private class FakeMediaEngine : PulseCallMediaEngine {
        private val mutableState = MutableStateFlow(PulseMediaState.NEW)
        override val state: StateFlow<PulseMediaState> = mutableState
        var config: PulseAudioSessionConfig? = null
        var listener: PulseCallMediaListener? = null
        var startCount = 0
        var closeCount = 0
        var restartCount = 0
        val remoteDescriptions = mutableListOf<PulseSessionDescription>()
        val remoteCandidates = mutableListOf<PulseIceCandidate>()

        override suspend fun start(config: PulseAudioSessionConfig, listener: PulseCallMediaListener) {
            this.config = config
            this.listener = listener
            startCount += 1
            mutableState.value = PulseMediaState.NEGOTIATING
        }

        override suspend fun applyRemoteDescription(description: PulseSessionDescription) {
            remoteDescriptions += description
        }

        override suspend fun addRemoteIceCandidate(candidate: PulseIceCandidate) {
            remoteCandidates += candidate
        }

        override suspend fun restartIce() {
            restartCount += 1
            mutableState.value = PulseMediaState.RECONNECTING
        }

        override suspend fun setMuted(muted: Boolean) = Unit

        override suspend fun close() {
            closeCount += 1
            mutableState.value = PulseMediaState.CLOSED
        }
    }

    private class FakeTelecom : PulseTelecomController {
        var addedRequest: PulseCallRequest? = null
        var callbacks: PulseTelecomCallbacks? = null
        val answeredSessions = mutableListOf<String>()
        val activatedSessions = mutableListOf<String>()
        val disconnectedSessions = mutableListOf<String>()
        var dispatchDisconnectCallback = true
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

        override suspend fun answer(sessionId: String, callType: Int): Boolean {
            answeredSessions += sessionId
            return true
        }

        override suspend fun setActive(sessionId: String): Boolean {
            activatedSessions += sessionId
            callbacks?.onSetActive(sessionId)
            return true
        }

        override suspend fun requestAudioRoute(sessionId: String, routeId: String): Boolean = true

        override suspend fun disconnect(sessionId: String, cause: DisconnectCause): Boolean {
            disconnectedSessions += sessionId
            if (dispatchDisconnectCallback) callbacks?.onDisconnect(sessionId, cause)
            lifetime.complete(Unit)
            return true
        }
    }
}
