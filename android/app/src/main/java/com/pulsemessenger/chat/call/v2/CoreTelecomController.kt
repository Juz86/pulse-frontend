package com.pulsemessenger.chat.call.v2

import android.content.Context
import android.os.Build
import android.telecom.DisconnectCause
import androidx.annotation.RequiresApi
import androidx.core.net.toUri
import androidx.core.telecom.CallAttributesCompat
import androidx.core.telecom.CallControlResult
import androidx.core.telecom.CallControlScope
import androidx.core.telecom.CallEndpointCompat
import androidx.core.telecom.CallsManager
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@RequiresApi(Build.VERSION_CODES.O)
class CoreTelecomController(context: Context) : PulseTelecomController {
    private data class ActiveCall(
        val sessionId: String,
        val scope: CallControlScope,
        val endpoints: AtomicReference<List<CallEndpointCompat>> = AtomicReference(emptyList()),
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
        PulseCallDiagnostics.event(
            "TELECOM_ADD_CALL",
            request.sessionId,
            direction = request.direction,
        )
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
                onAnswer = { callType ->
                    PulseCallDiagnostics.event("TELECOM_ON_ANSWER", request.sessionId)
                    callbacks.onAnswer(request.sessionId, callType)
                },
                onDisconnect = { cause ->
                    PulseCallDiagnostics.event("TELECOM_ON_DISCONNECT", request.sessionId)
                    callbacks.onDisconnect(request.sessionId, cause)
                },
                onSetActive = {
                    PulseCallDiagnostics.event("TELECOM_ON_SET_ACTIVE", request.sessionId)
                    callbacks.onSetActive(request.sessionId)
                },
                onSetInactive = {
                    PulseCallDiagnostics.event("TELECOM_ON_SET_INACTIVE", request.sessionId)
                    callbacks.onSetInactive(request.sessionId)
                },
            ) {
                val call = ActiveCall(request.sessionId, this)
                activeCall.set(call)
                PulseCallAudioRoutes.begin(request.sessionId)
                launch {
                    availableEndpoints.collectLatest { endpoints ->
                        call.endpoints.set(endpoints)
                        PulseCallAudioRoutes.updateAvailable(
                            request.sessionId,
                            endpoints.mapNotNull(::toPulseAudioRoute),
                        )
                    }
                }
                launch {
                    currentCallEndpoint.collectLatest { endpoint ->
                        PulseCallAudioRoutes.updateCurrent(
                            request.sessionId,
                            toPulseAudioRoute(endpoint),
                        )
                    }
                }
                PulseCallDiagnostics.event(
                    if (request.direction == PulseCallDirection.INCOMING) {
                        "TELECOM_INCOMING_REGISTERED"
                    } else {
                        "TELECOM_OUTGOING_REGISTERED"
                    },
                    request.sessionId,
                    direction = request.direction,
                )
                callbacks.onRegistered(request.sessionId)
            }
        } finally {
            activeCall.compareAndSet(activeCall.get()?.takeIf { it.sessionId == request.sessionId }, null)
            PulseCallAudioRoutes.clear(request.sessionId)
        }
    }

    override suspend fun answer(sessionId: String, callType: Int): Boolean {
        val call = activeCall.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return call.scope.answer(callType) is CallControlResult.Success
    }

    override suspend fun setActive(sessionId: String): Boolean {
        val call = activeCall.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return call.scope.setActive() is CallControlResult.Success
    }

    override suspend fun requestAudioRoute(sessionId: String, routeId: String): Boolean {
        val call = activeCall.get()?.takeIf { it.sessionId == sessionId } ?: return false
        val endpoint = call.endpoints.get().firstOrNull {
            it.identifier.uuid.toString() == routeId
        } ?: return false
        return call.scope.requestEndpointChange(endpoint) is CallControlResult.Success
    }

    override suspend fun disconnect(sessionId: String, cause: DisconnectCause): Boolean {
        val call = activeCall.get()?.takeIf { it.sessionId == sessionId } ?: return false
        return call.scope.disconnect(cause) is CallControlResult.Success
    }

    private fun toPulseAudioRoute(endpoint: CallEndpointCompat): PulseAudioRoute? {
        val type = when (endpoint.type) {
            CallEndpointCompat.TYPE_EARPIECE -> PulseAudioRouteType.EARPIECE
            CallEndpointCompat.TYPE_SPEAKER -> PulseAudioRouteType.SPEAKER
            CallEndpointCompat.TYPE_BLUETOOTH -> PulseAudioRouteType.BLUETOOTH
            CallEndpointCompat.TYPE_WIRED_HEADSET -> PulseAudioRouteType.WIRED_HEADSET
            else -> return null
        }
        return PulseAudioRoute(
            id = endpoint.identifier.uuid.toString(),
            name = endpoint.name.toString(),
            type = type,
        )
    }
}
