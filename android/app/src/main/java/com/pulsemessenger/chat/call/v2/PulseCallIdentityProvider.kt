package com.pulsemessenger.chat.call.v2

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

data class PulseCallIdentity(
    val uid: String,
    val authToken: String,
    val installationId: String,
)

fun interface PulseCallIdentityProvider {
    suspend fun getIdentity(): PulseCallIdentity?
}

class FirebasePulseCallIdentityProvider(
    context: Context,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : PulseCallIdentityProvider {
    private val applicationContext = context.applicationContext

    override suspend fun getIdentity(): PulseCallIdentity? {
        val user = auth.currentUser ?: return null
        val token = suspendCancellableCoroutine<String?> { continuation ->
            user.getIdToken(false)
                .addOnSuccessListener { result ->
                    if (continuation.isActive) continuation.resume(result.token)
                }
                .addOnFailureListener {
                    if (continuation.isActive) continuation.resume(null)
                }
        }?.takeIf(String::isNotBlank) ?: return null
        return PulseCallIdentity(
            uid = user.uid,
            authToken = token,
            installationId = PulsePushTokenRegistrar.installationId(applicationContext),
        )
    }
}
