package com.pulsemessenger.chat;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;

final class PulseIncomingCallStore {
    static final String ACTION_ANSWER = "com.pulsemessenger.chat.CALL_ANSWER";
    static final String ACTION_DECLINE = "com.pulsemessenger.chat.CALL_DECLINE";

    private static final String PREFS = "pulse_incoming_call";
    private static final String KEY_SESSION_ID = "sessionId";
    private static final String KEY_FROM_UID = "fromUid";
    private static final String KEY_CALLER_NAME = "callerName";
    private static final String KEY_IS_VIDEO = "isVideo";
    private static final String KEY_CALL_ENGINE = "callEngine";
    private static final String KEY_ACTION = "action";

    private PulseIncomingCallStore() {}

    static void save(Context context, Intent intent, String action) {
        if (context == null || intent == null) return;
        save(
            context,
            intent.getStringExtra(KEY_SESSION_ID),
            intent.getStringExtra(KEY_FROM_UID),
            intent.getStringExtra(KEY_CALLER_NAME),
            intent.getBooleanExtra(KEY_IS_VIDEO, false),
            intent.getStringExtra(KEY_CALL_ENGINE),
            action
        );
    }

    static void save(Context context, String sessionId, String fromUid, String callerName, boolean isVideo, String action) {
        save(context, sessionId, fromUid, callerName, isVideo, "webrtc-v1", action);
    }

    static void save(
        Context context,
        String sessionId,
        String fromUid,
        String callerName,
        boolean isVideo,
        String callEngine,
        String action
    ) {
        if (context == null || isBlank(sessionId) || isBlank(fromUid)) return;
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SESSION_ID, sessionId)
            .putString(KEY_FROM_UID, fromUid)
            .putString(KEY_CALLER_NAME, isBlank(callerName) ? "Iemand" : callerName)
            .putBoolean(KEY_IS_VIDEO, isVideo)
            .putString(KEY_CALL_ENGINE, isBlank(callEngine) ? "webrtc-v1" : callEngine)
            .putString(KEY_ACTION, action == null ? "open" : action)
            .apply();
    }

    static JSObject consume(Context context) {
        JSObject result = new JSObject();
        if (context == null) return result;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String sessionId = prefs.getString(KEY_SESSION_ID, null);
        String fromUid = prefs.getString(KEY_FROM_UID, null);
        if (isBlank(sessionId) || isBlank(fromUid)) return result;

        result.put(KEY_SESSION_ID, sessionId);
        result.put(KEY_FROM_UID, fromUid);
        result.put(KEY_CALLER_NAME, prefs.getString(KEY_CALLER_NAME, "Iemand"));
        result.put(KEY_IS_VIDEO, prefs.getBoolean(KEY_IS_VIDEO, false));
        result.put(KEY_CALL_ENGINE, prefs.getString(KEY_CALL_ENGINE, "webrtc-v1"));
        result.put(KEY_ACTION, prefs.getString(KEY_ACTION, "open"));
        prefs.edit()
            .remove(KEY_SESSION_ID)
            .remove(KEY_FROM_UID)
            .remove(KEY_CALLER_NAME)
            .remove(KEY_IS_VIDEO)
            .remove(KEY_CALL_ENGINE)
            .remove(KEY_ACTION)
            .apply();
        return result;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
