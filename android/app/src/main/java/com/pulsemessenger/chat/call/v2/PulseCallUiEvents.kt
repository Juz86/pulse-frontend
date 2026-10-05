package com.pulsemessenger.chat.call.v2

import android.content.Context
import android.content.Intent

object PulseCallUiEvents {
    const val ACTION_CALL_STATUS_CHANGED =
        "com.pulsemessenger.chat.action.CALL_STATUS_CHANGED"
    const val EXTRA_CALL_ID = "callId"
    const val EXTRA_CODE = "code"
    const val EXTRA_STATUS = "status"
    const val STATUS_FAILED = "failed"

    fun reportFailure(context: Context, callId: String, code: String) {
        if (callId.isBlank() || code !in ALLOWED_FAILURE_CODES) return
        PulseCallDiagnostics.event("UI_FAILURE_REPORTED", callId, status = code)
        context.sendBroadcast(
            Intent(ACTION_CALL_STATUS_CHANGED)
                .setPackage(context.packageName)
                .putExtra(EXTRA_CALL_ID, callId)
                .putExtra(EXTRA_CODE, code)
                .putExtra(EXTRA_STATUS, STATUS_FAILED),
        )
    }

    private val ALLOWED_FAILURE_CODES = setOf(
        "call_already_active",
        "native_auth_required",
        "call_signaling_unavailable",
        "call_rejected",
        "media_error",
        "signaling_error",
        "telecom_error",
    )
}
