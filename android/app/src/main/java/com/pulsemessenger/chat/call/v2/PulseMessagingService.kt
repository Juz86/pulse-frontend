package com.pulsemessenger.chat.call.v2

import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.capacitorjs.plugins.pushnotifications.MessagingService
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.RemoteMessage
import com.pulsemessenger.chat.R

class PulseMessagingService : MessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val incomingCall = PulseIncomingCallPushParser.parse(remoteMessage.data)
        if (incomingCall == null) {
            super.onMessageReceived(remoteMessage)
            return
        }
        PulseCallDiagnostics.event("FCM_RECEIVED", incomingCall.sessionId)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            PulseCallDiagnostics.event(
                "FCM_REJECTED",
                incomingCall.sessionId,
                status = "UNSUPPORTED_ANDROID",
            )
            Log.w(TAG, "Incoming native calls require Android 8 or newer")
            return
        }
        if (FirebaseAuth.getInstance().currentUser == null) {
            PulseCallDiagnostics.event(
                "AUTHENTICATION_FAILED",
                incomingCall.sessionId,
                status = "NATIVE_IDENTITY_MISSING",
            )
            Log.w(TAG, "Incoming call wake-up ignored without a native identity")
            return
        }

        runCatching {
            PulseCallDiagnostics.event("CALL_SERVICE_START_REQUESTED", incomingCall.sessionId)
            ContextCompat.startForegroundService(
                this,
                PulseCallService.incomingIntent(
                    context = this,
                    sessionId = incomingCall.sessionId,
                    displayName = getString(R.string.pulse_call_unknown_caller),
                ),
            )
            PulseCallDiagnostics.event("CALL_SERVICE_START_SUCCEEDED", incomingCall.sessionId)
        }.onFailure { error ->
            PulseCallDiagnostics.event(
                "CALL_SERVICE_START_FAILED",
                incomingCall.sessionId,
                status = error.javaClass.simpleName,
            )
            Log.e(TAG, "Incoming call foreground service could not start", error)
        }
    }

    private companion object {
        const val TAG = "PulseMessagingService"
    }
}
