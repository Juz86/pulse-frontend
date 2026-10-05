package com.pulsemessenger.chat.call.v2

import android.util.Log

internal object PulseCallDiagnostics {
    private const val TAG = "PulseCallTrace"

    fun event(
        event: String,
        sessionId: String? = null,
        status: String? = null,
        state: String? = null,
        direction: PulseCallDirection? = null,
        revision: Long? = null,
        transport: String? = null,
        localCandidateType: String? = null,
        remoteCandidateType: String? = null,
        packetsReceived: Long? = null,
        bytesReceived: Long? = null,
    ) {
        val message = buildString {
            append("event=").append(event)
            sessionId?.let { append(" sessionId=").append(it) }
            status?.let { append(" status=").append(it) }
            state?.let { append(" state=").append(it) }
            direction?.let { append(" direction=").append(it.name) }
            revision?.let { append(" revision=").append(it) }
            transport?.let { append(" transport=").append(it) }
            localCandidateType?.let { append(" localCandidateType=").append(it) }
            remoteCandidateType?.let { append(" remoteCandidateType=").append(it) }
            packetsReceived?.let { append(" packetsReceived=").append(it) }
            bytesReceived?.let { append(" bytesReceived=").append(it) }
        }
        runCatching { Log.i(TAG, message) }
    }
}
