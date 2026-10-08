package com.pulsemessenger.chat.call.v2

import android.content.Context

data class PulseCallRecoveryRecord(
    val sessionId: String,
    val ownerUid: String,
    val peerUid: String,
    val displayName: String,
    val direction: PulseCallDirection,
    val mediaType: PulseCallMediaType,
)

class PulseCallRecoveryStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )

    fun save(record: PulseCallRecoveryRecord) {
        preferences.edit()
            .putString(SESSION_ID, record.sessionId)
            .putString(OWNER_UID, record.ownerUid)
            .putString(PEER_UID, record.peerUid)
            .putString(DISPLAY_NAME, record.displayName)
            .putString(DIRECTION, record.direction.name)
            .putString(MEDIA_TYPE, record.mediaType.name)
            .apply()
    }

    fun load(): PulseCallRecoveryRecord? {
        val sessionId = preferences.getString(SESSION_ID, null)?.takeIf(::isValidValue)
        val ownerUid = preferences.getString(OWNER_UID, null)?.takeIf(::isValidValue)
        val peerUid = preferences.getString(PEER_UID, null)?.takeIf(::isValidValue)
        val displayName = preferences.getString(DISPLAY_NAME, null)?.takeIf(::isValidValue)
        val direction = preferences.getString(DIRECTION, null)?.let {
            runCatching { PulseCallDirection.valueOf(it) }.getOrNull()
        }
        val mediaType = preferences.getString(MEDIA_TYPE, null)?.let {
            runCatching { PulseCallMediaType.valueOf(it) }.getOrNull()
        }
        if (sessionId == null || ownerUid == null || peerUid == null || displayName == null ||
            direction == null || mediaType == null
        ) {
            clear()
            return null
        }
        return PulseCallRecoveryRecord(sessionId, ownerUid, peerUid, displayName, direction, mediaType)
    }

    fun clear(expectedSessionId: String? = null) {
        if (expectedSessionId != null && preferences.getString(SESSION_ID, null) != expectedSessionId) return
        preferences.edit().clear().apply()
    }

    fun hasRecord(): Boolean = preferences.contains(SESSION_ID)

    private fun isValidValue(value: String): Boolean = value.isNotBlank() && value.length <= 256

    private companion object {
        const val PREFERENCES_NAME = "pulse_call_recovery"
        const val SESSION_ID = "session_id"
        const val OWNER_UID = "owner_uid"
        const val PEER_UID = "peer_uid"
        const val DISPLAY_NAME = "display_name"
        const val DIRECTION = "direction"
        const val MEDIA_TYPE = "media_type"
    }
}
