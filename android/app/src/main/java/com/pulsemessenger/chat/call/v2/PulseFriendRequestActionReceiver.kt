package com.pulsemessenger.chat.call.v2

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.auth.FirebaseAuth
import com.pulsemessenger.chat.BuildConfig
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class PulseFriendRequestActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val requestId = intent.getStringExtra(EXTRA_REQUEST_ID)?.takeIf(::isSafeIdentifier) ?: return
        val action = intent.getStringExtra(EXTRA_ACTION)
            ?.takeIf { it == ACTION_ACCEPT || it == ACTION_DECLINE } ?: return
        val pendingResult = goAsync()
        val applicationContext = context.applicationContext
        val user = FirebaseAuth.getInstance().currentUser ?: run {
            pendingResult.finish()
            return
        }

        user.getIdToken(false)
            .addOnSuccessListener { tokenResult ->
                val token = tokenResult.token?.takeIf(String::isNotBlank) ?: run {
                    pendingResult.finish()
                    return@addOnSuccessListener
                }
                executor.execute {
                    try {
                        if (postAction(requestId, action, token)) {
                            NotificationManagerCompat.from(applicationContext)
                                .cancel(PulseFriendRequestNotifications.notificationId(requestId))
                        }
                    } finally {
                        pendingResult.finish()
                    }
                }
            }
            .addOnFailureListener {
                pendingResult.finish()
            }
    }

    private fun postAction(requestId: String, action: String, token: String): Boolean {
        var connection: HttpURLConnection? = null
        return try {
            val endpoint = "${BuildConfig.PULSE_NATIVE_API_URL}/api/friend-requests/$requestId/$action"
            connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Authorization", "Bearer $token")
            }
            connection.responseCode in 200..299
        } catch (error: Exception) {
            Log.w(TAG, "Friend request action failed: ${error.javaClass.simpleName}")
            false
        } finally {
            connection?.disconnect()
        }
    }

    companion object {
        const val ACTION_ACCEPT = "accept"
        const val ACTION_DECLINE = "decline"
        const val EXTRA_REQUEST_ID = "pulse_friend_request_id"
        const val EXTRA_ACTION = "pulse_friend_request_action"
        private const val TAG = "PulseFriendRequestAction"
        private val executor = Executors.newSingleThreadExecutor()

        private fun isSafeIdentifier(value: String): Boolean =
            value.length in 1..256 && value.all { it.isLetterOrDigit() || it == '-' || it == '_' }
    }
}
