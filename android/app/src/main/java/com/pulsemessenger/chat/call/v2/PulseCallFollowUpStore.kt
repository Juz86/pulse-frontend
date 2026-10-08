package com.pulsemessenger.chat.call.v2

import android.content.Context

data class PulseCallFollowUpAction(
    val type: String,
    val peerUid: String,
    val displayName: String,
)

object PulseCallFollowUpStore {
    private const val PREFERENCES_NAME = "pulse_call_follow_up"
    private const val ACTION_TYPE = "action_type"
    private const val PEER_UID = "peer_uid"
    private const val DISPLAY_NAME = "display_name"
    const val TYPE_MESSAGE = "message"

    fun saveMessage(context: Context, peerUid: String, displayName: String) {
        if (peerUid.isBlank() || displayName.isBlank()) return
        preferences(context).edit()
            .putString(ACTION_TYPE, TYPE_MESSAGE)
            .putString(PEER_UID, peerUid)
            .putString(DISPLAY_NAME, displayName)
            .apply()
    }

    fun consume(context: Context): PulseCallFollowUpAction? {
        val preferences = preferences(context)
        val type = preferences.getString(ACTION_TYPE, null)
        val peerUid = preferences.getString(PEER_UID, null)
        val displayName = preferences.getString(DISPLAY_NAME, null)
        preferences.edit().clear().apply()
        if (type != TYPE_MESSAGE || peerUid.isNullOrBlank() || displayName.isNullOrBlank()) {
            return null
        }
        return PulseCallFollowUpAction(type, peerUid, displayName)
    }

    private fun preferences(context: Context) = context.applicationContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )
}
