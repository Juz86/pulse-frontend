package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred

fun createPulseTelecomController(
    primaryFactory: () -> PulseTelecomController,
    fallback: PulseTelecomController = StandaloneTelecomController(),
): PulseTelecomController {
    val primary = try {
        primaryFactory()
    } catch (error: Throwable) {
        if (error is VirtualMachineError || error is ThreadDeath) throw error
        fallback.registerApp()
        return fallback
    }
    return ResilientTelecomController(primary, fallback).also(PulseTelecomController::registerApp)
}

/**
 * Keeps Core Telecom as the preferred integration, while allowing calls to work on
 * Android tablets that expose an incomplete or unavailable Telecom implementation.
 */
class ResilientTelecomController(
    private val primary: PulseTelecomController,
    private val fallback: PulseTelecomController = StandaloneTelecomController(),
) : PulseTelecomController {
    private val fallbackRequired = AtomicBoolean(false)
    private val activeController = AtomicReference<PulseTelecomController?>(null)

    override fun registerApp() {
        try {
            primary.registerApp()
        } catch (error: Throwable) {
            if (error is VirtualMachineError || error is ThreadDeath) throw error
            fallbackRequired.set(true)
            fallback.registerApp()
        }
    }

    override suspend fun addCall(
        request: PulseCallRequest,
        callbacks: PulseTelecomCallbacks,
    ) {
        if (fallbackRequired.get()) {
            runFallback(request, callbacks)
            return
        }

        var registered = false
        val trackingCallbacks = object : PulseTelecomCallbacks by callbacks {
            override fun onRegistered(sessionId: String) {
                registered = true
                callbacks.onRegistered(sessionId)
            }
        }
        activeController.set(primary)
        try {
            primary.addCall(request, trackingCallbacks)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            if (registered) throw error
            fallbackRequired.set(true)
            PulseCallDiagnostics.event(
                "TELECOM_FALLBACK",
                request.sessionId,
                status = error.javaClass.simpleName,
                direction = request.direction,
            )
            runFallback(request, callbacks)
        } finally {
            activeController.compareAndSet(primary, null)
        }
    }

    override suspend fun answer(sessionId: String, callType: Int): Boolean =
        activeController.get()?.answer(sessionId, callType) ?: false

    override suspend fun setActive(sessionId: String): Boolean =
        activeController.get()?.setActive(sessionId) ?: false

    override suspend fun requestAudioRoute(sessionId: String, routeId: String): Boolean =
        activeController.get()?.requestAudioRoute(sessionId, routeId) ?: false

    override suspend fun disconnect(sessionId: String, cause: DisconnectCause): Boolean =
        activeController.get()?.disconnect(sessionId, cause) ?: false

    private suspend fun runFallback(
        request: PulseCallRequest,
        callbacks: PulseTelecomCallbacks,
    ) {
        activeController.set(fallback)
        try {
            fallback.addCall(request, callbacks)
        } finally {
            activeController.compareAndSet(fallback, null)
        }
    }
}

/** Minimal in-app call lifecycle for devices without usable Android Telecom support. */
class StandaloneTelecomController : PulseTelecomController {
    private data class ActiveCall(
        val sessionId: String,
        val callbacks: PulseTelecomCallbacks,
        val lifetime: CompletableDeferred<Unit> = CompletableDeferred(),
    )

    private val activeCall = AtomicReference<ActiveCall?>(null)

    override fun registerApp() = Unit

    override suspend fun addCall(
        request: PulseCallRequest,
        callbacks: PulseTelecomCallbacks,
    ) {
        val call = ActiveCall(request.sessionId, callbacks)
        check(activeCall.compareAndSet(null, call)) { "A standalone call is already active" }
        PulseCallAudioRoutes.begin(request.sessionId)
        try {
            callbacks.onRegistered(request.sessionId)
            call.lifetime.await()
        } finally {
            activeCall.compareAndSet(call, null)
            PulseCallAudioRoutes.clear(request.sessionId)
        }
    }

    override suspend fun answer(sessionId: String, callType: Int): Boolean =
        activeCall.get()?.sessionId == sessionId

    override suspend fun setActive(sessionId: String): Boolean {
        val call = activeCall.get()?.takeIf { it.sessionId == sessionId } ?: return false
        call.callbacks.onSetActive(sessionId)
        return true
    }

    override suspend fun requestAudioRoute(sessionId: String, routeId: String): Boolean = false

    override suspend fun disconnect(sessionId: String, cause: DisconnectCause): Boolean {
        val call = activeCall.get()?.takeIf { it.sessionId == sessionId } ?: return false
        call.callbacks.onDisconnect(sessionId, cause)
        call.lifetime.complete(Unit)
        return true
    }
}
