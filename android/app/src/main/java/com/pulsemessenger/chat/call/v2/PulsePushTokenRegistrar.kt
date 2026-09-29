package com.pulsemessenger.chat.call.v2

import android.content.Context
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors

object PulsePushTokenRegistrar {
    private const val REGISTRATION_URL = "https://api.pulse-messenger.com/api/fcm-token"
    private const val PREFERENCES_NAME = "pulse_push_device"
    private const val INSTALLATION_ID_KEY = "installation_id"
    private const val TAG = "PulsePushRegistration"
    private val executor = Executors.newSingleThreadExecutor()

    @Suppress("DEPRECATION") // Multicast delivery still requires the current FCM registration token.
    fun registerCurrentToken(context: Context) {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                if (token.isNotBlank()) registerToken(context, token)
            }
            .addOnFailureListener { error ->
                Log.w(TAG, "event=PUSH_TOKEN_FETCH_FAILED status=${error.javaClass.simpleName}")
            }
    }

    fun registerToken(context: Context, token: String) {
        val normalizedToken = token.trim()
        if (normalizedToken.isEmpty()) return
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null) {
            Log.i(TAG, "event=PUSH_TOKEN_REGISTRATION_DEFERRED status=NATIVE_IDENTITY_MISSING")
            return
        }
        val applicationContext = context.applicationContext
        user.getIdToken(false)
            .addOnSuccessListener { result ->
                val authToken = result.token?.takeIf(String::isNotBlank)
                if (authToken == null) {
                    Log.w(TAG, "event=PUSH_TOKEN_REGISTRATION_FAILED status=AUTH_TOKEN_MISSING")
                    return@addOnSuccessListener
                }
                executor.execute {
                    register(
                        context = applicationContext,
                        uid = user.uid,
                        authToken = authToken,
                        token = normalizedToken,
                    )
                }
            }
            .addOnFailureListener { error ->
                Log.w(
                    TAG,
                    "event=PUSH_TOKEN_REGISTRATION_FAILED status=${error.javaClass.simpleName}",
                )
            }
    }

    private fun register(
        context: Context,
        uid: String,
        authToken: String,
        token: String,
    ) {
        var connection: HttpURLConnection? = null
        val fingerprint = fingerprint(token)
        try {
            val requestBody = JSONObject()
                .put("uid", uid)
                .put("token", token)
                .put("installationId", installationId(context))
                .put("transport", "fcm_native")
                .put("platform", "android")
                .toString()
                .toByteArray(StandardCharsets.UTF_8)
            connection = (URL(REGISTRATION_URL).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 10_000
                doOutput = true
                setRequestProperty("Authorization", "Bearer $authToken")
                setRequestProperty("Content-Type", "application/json")
                setFixedLengthStreamingMode(requestBody.size)
            }
            connection.outputStream.use { it.write(requestBody) }
            val status = connection.responseCode
            if (status in 200..299) {
                Log.i(TAG, "event=PUSH_TOKEN_REGISTERED tokenFingerprint=$fingerprint")
            } else {
                Log.w(TAG, "event=PUSH_TOKEN_REGISTRATION_FAILED status=HTTP_$status tokenFingerprint=$fingerprint")
            }
        } catch (error: Exception) {
            Log.w(
                TAG,
                "event=PUSH_TOKEN_REGISTRATION_FAILED status=${error.javaClass.simpleName} tokenFingerprint=$fingerprint",
            )
        } finally {
            connection?.disconnect()
        }
    }

    internal fun installationId(context: Context): String {
        val preferences = context.applicationContext.getSharedPreferences(
            PREFERENCES_NAME,
            Context.MODE_PRIVATE,
        )
        synchronized(this) {
            preferences.getString(INSTALLATION_ID_KEY, null)
                ?.takeIf(String::isNotBlank)
                ?.let { return it }
            return UUID.randomUUID().toString().also { generated ->
                preferences.edit().putString(INSTALLATION_ID_KEY, generated).apply()
            }
        }
    }

    private fun fingerprint(token: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(token.toByteArray(StandardCharsets.UTF_8))
            .take(6)
            .joinToString("") { byte -> "%02x".format(byte) }
}
