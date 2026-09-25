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
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            Log.w(TAG, "Incoming native calls require Android 8 or newer")
            return
        }
        if (FirebaseAuth.getInstance().currentUser == null) {
            Log.w(TAG, "Incoming call wake-up ignored without a native identity")
            return
        }

        runCatching {
            ContextCompat.startForegroundService(
                this,
                PulseCallService.incomingIntent(
                    context = this,
                    sessionId = incomingCall.sessionId,
                    displayName = getString(R.string.pulse_call_unknown_caller),
                ),
            )
        }.onFailure { error ->
            Log.e(TAG, "Incoming call foreground service could not start", error)
        }
    }

    private companion object {
        const val TAG = "PulseMessagingService"
    }
}
