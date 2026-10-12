package com.pulsemessenger.chat.call.v2

import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.capacitorjs.plugins.pushnotifications.MessagingService
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.RemoteMessage
import com.pulsemessenger.chat.R

class PulseMessagingService : MessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        PulsePushTokenRegistrar.registerToken(applicationContext, token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val takenElsewhere = PulseCallTakenElsewherePushParser.parse(remoteMessage.data)
        if (takenElsewhere != null) {
            handleTakenElsewhere(takenElsewhere)
            return
        }
        val terminalCall = PulseTerminalCallPushParser.parse(remoteMessage.data)
        if (terminalCall != null) {
            handleTerminalCall(terminalCall)
            return
        }
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
                    displayName = incomingCall.callerDisplayName
                        ?: getString(R.string.pulse_call_unknown_caller),
                    photoUrl = incomingCall.callerPhotoUrl,
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

    private fun handleTakenElsewhere(push: PulseCallTakenElsewherePush) {
        PulseCallDiagnostics.event(
            "FCM_TAKEN_ELSEWHERE_RECEIVED",
            push.sessionId,
            revision = push.revision,
        )
        if (PulsePushTokenRegistrar.installationId(this) == push.acceptedInstallationId) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            FirebaseAuth.getInstance().currentUser == null
        ) return
        runCatching {
            ContextCompat.startForegroundService(
                this,
                PulseCallService.takenElsewhereIntent(
                    this,
                    push.sessionId,
                    push.acceptedInstallationId,
                ),
            )
        }.onFailure { error ->
            PulseCallDiagnostics.event(
                "TAKEN_ELSEWHERE_SERVICE_FAILED",
                push.sessionId,
                status = error.javaClass.simpleName,
            )
            Log.e(TAG, "Taken-elsewhere reconciliation service could not start", error)
        }
    }

    private fun handleTerminalCall(terminalCall: PulseTerminalCallPush) {
        PulseCallDiagnostics.event(
            "FCM_TERMINAL_RECEIVED",
            terminalCall.sessionId,
            revision = terminalCall.revision,
        )
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (FirebaseAuth.getInstance().currentUser == null) {
            PulseCallDiagnostics.event(
                "TERMINAL_RECONCILIATION_REJECTED",
                terminalCall.sessionId,
                status = "NATIVE_IDENTITY_MISSING",
            )
            return
        }
        runCatching {
            ContextCompat.startForegroundService(
                this,
                PulseCallService.terminalIntent(this, terminalCall.sessionId),
            )
            PulseCallDiagnostics.event(
                "TERMINAL_RECONCILIATION_SERVICE_STARTED",
                terminalCall.sessionId,
            )
        }.onFailure { error ->
            PulseCallDiagnostics.event(
                "TERMINAL_RECONCILIATION_SERVICE_FAILED",
                terminalCall.sessionId,
                status = error.javaClass.simpleName,
            )
            Log.e(TAG, "Terminal call reconciliation service could not start", error)
        }
    }

    private companion object {
        const val TAG = "PulseMessagingService"
    }
}
