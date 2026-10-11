package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ResilientTelecomControllerTest {
    @Test
    fun `registration failure routes call through standalone controller`() = runBlocking {
        val primary = FakeTelecom(registerFailure = IllegalStateException("Telecom unavailable"))
        val fallback = FakeTelecom()
        val callbacks = RecordingCallbacks()
        val subject = ResilientTelecomController(primary, fallback)

        subject.registerApp()
        val call = async { subject.addCall(request(), callbacks) }
        withTimeout(1_000) { fallback.registered.await() }

        assertEquals(0, primary.addCount)
        assertEquals(1, fallback.addCount)
        assertTrue(subject.disconnect("session-123", DisconnectCause(DisconnectCause.LOCAL)))
        call.await()
    }

    @Test
    fun `add failure before registration retries through fallback`() = runBlocking {
        val primary = FakeTelecom(addFailure = IllegalStateException("Unsupported tablet Telecom"))
        val fallback = FakeTelecom()
        val subject = ResilientTelecomController(primary, fallback)

        subject.registerApp()
        val call = async { subject.addCall(request(), RecordingCallbacks()) }
        withTimeout(1_000) { fallback.registered.await() }

        assertEquals(1, primary.addCount)
        assertEquals(1, fallback.addCount)
        assertTrue(subject.disconnect("session-123", DisconnectCause(DisconnectCause.LOCAL)))
        call.await()
    }

    @Test
    fun `failure after Core Telecom registration does not create duplicate call`() = runBlocking {
        val primary = FakeTelecom(
            addFailure = IllegalStateException("Call ended with framework error"),
            registerBeforeFailure = true,
        )
        val fallback = FakeTelecom()
        val subject = ResilientTelecomController(primary, fallback)

        subject.registerApp()
        val result = runCatching { subject.addCall(request(), RecordingCallbacks()) }

        assertTrue(result.exceptionOrNull() is IllegalStateException)
        assertEquals(1, primary.addCount)
        assertEquals(0, fallback.addCount)
        assertFalse(fallback.registered.isCompleted)
    }

    private fun request() = PulseCallRequest(
        sessionId = "session-123",
        peerUid = "callee",
        displayName = "Test contact",
        direction = PulseCallDirection.OUTGOING,
        mediaType = PulseCallMediaType.AUDIO,
    )

    private class RecordingCallbacks : PulseTelecomCallbacks {
        override fun onRegistered(sessionId: String) = Unit
        override suspend fun onAnswer(sessionId: String, callType: Int) = Unit
        override suspend fun onDisconnect(sessionId: String, cause: DisconnectCause) = Unit
        override suspend fun onSetActive(sessionId: String) = Unit
        override suspend fun onSetInactive(sessionId: String) = Unit
    }

    private class FakeTelecom(
        private val registerFailure: Throwable? = null,
        private val addFailure: Throwable? = null,
        private val registerBeforeFailure: Boolean = false,
    ) : PulseTelecomController {
        val registered = CompletableDeferred<Unit>()
        var addCount = 0
        private var activeSessionId: String? = null
        private val lifetime = CompletableDeferred<Unit>()

        override fun registerApp() {
            registerFailure?.let { throw it }
        }

        override suspend fun addCall(request: PulseCallRequest, callbacks: PulseTelecomCallbacks) {
            addCount += 1
            activeSessionId = request.sessionId
            if (registerBeforeFailure) callbacks.onRegistered(request.sessionId)
            addFailure?.let { throw it }
            callbacks.onRegistered(request.sessionId)
            registered.complete(Unit)
            lifetime.await()
        }

        override suspend fun answer(sessionId: String, callType: Int): Boolean =
            activeSessionId == sessionId

        override suspend fun setActive(sessionId: String): Boolean = activeSessionId == sessionId

        override suspend fun requestAudioRoute(sessionId: String, routeId: String): Boolean = false

        override suspend fun disconnect(sessionId: String, cause: DisconnectCause): Boolean {
            if (activeSessionId != sessionId) return false
            lifetime.complete(Unit)
            return true
        }
    }
}
