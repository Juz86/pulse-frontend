package com.pulsemessenger.chat.call.v2

import android.content.Context
import android.os.Build
import android.telecom.DisconnectCause
import androidx.annotation.RequiresApi
import androidx.core.net.toUri
import androidx.core.telecom.CallAttributesCompat
import androidx.core.telecom.CallControlResult
import androidx.core.telecom.CallControlScope
import androidx.core.telecom.CallsManager
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@RequiresApi(Build.VERSION_CODES.O)
class CoreTelecomController(context: Context) : PulseTelecomController {
    private data class ActiveCall(
        val sessionId: String,
        val scope: CallControlScope,
    )

    private val callsManager = CallsManager(context.applicationContext)
    private val setupMutex = Mutex()
    private val activeCall = AtomicReference<ActiveCall?>(null)

    override fun registerApp() {
        callsManager.registerAppWithTelecom(CallsManager.CAPABILITY_BASELINE)
    }

    override suspend fun addCall(
        request: PulseCallRequest,
        callbacks: PulseTelecomCallbacks,
    ) = setupMutex.withLock {
        check(activeCall.get() == null) { "A Telecom call is already active" }
        val attributes = CallAttributesCompat(
            displayName = request.displayName,
            address = "sip:pulse-${request.sessionId}@pulse.invalid".toUri(),
            direction = if (request.direction == PulseCallDirection.INCOMING) {
                CallAttributesCompat.DIRECTION_INCOMING
            } else {
                CallAttributesCompat.DIRECTION_OUTGOING
            },
            callType = if (request.mediaType == PulseCallMediaType.VIDEO) {
                CallAttributesCompat.CALL_TYPE_VIDEO_CALL
            } else {
                CallAttributesCompat.CALL_TYPE_AUDIO_CALL
            },
            callCapabilities = 0,
        )

        try {
            callsManager.addCall(
                attributes,
                onAnswer = { callType -> callbacks.onAnswer(request.sessionId, callType) },
                onDisconnect = { cause -> callbacks.onDisconnect(request.sessionId, cause) },
                onSetActive = { callbacks.onSetActive(request.sessionId) },
                onSetInactive = { callbacks.onSetInactive(request.sessionId) },
            ) {
                activeCall.set(ActiveCall(request.sessionId, this))
                callbacks.onRegistered(request.sessionId)
            }
        } finally {
            activeCall.compareAndSet(activeCall.get()?.takeIf { it.sessionId == request.sessionId }, null)
        }
    }

    override suspend fun setActive(sessionId: String): Boolean {
        val call = activeCall.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return call.scope.setActive() is CallControlResult.Success
    }

    override suspend fun disconnect(sessionId: String, cause: DisconnectCause): Boolean {
        val call = activeCall.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return call.scope.disconnect(cause) is CallControlResult.Success
    }
}
