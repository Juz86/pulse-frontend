package com.pulsemessenger.chat.call.v2

import org.json.JSONArray
import org.json.JSONObject

object RailwayCallingV2Codec {
    const val EVENT_START = "call:v2:start"
    const val EVENT_COMMAND = "call:v2:command"
    const val EVENT_SNAPSHOT = "call:v2:snapshot"
    const val EVENT_UPDATED = "call:v2:updated"

    fun encodeStart(
        requestId: String,
        calleeUid: String,
        mediaType: PulseCallMediaType,
    ): JSONObject = JSONObject()
        .put("requestId", requestId)
        .put("calleeUid", calleeUid)
        .put("mediaType", mediaType.name.lowercase())

    fun encodeCommand(
        sessionId: String,
        eventId: String,
        expectedRevision: Long,
        command: PulseSignalingCommand,
        reason: String? = null,
    ): JSONObject = JSONObject()
        .put("sessionId", sessionId)
        .put("eventId", eventId)
        .put("expectedRevision", expectedRevision)
        .put("command", command.name)
        .apply { if (reason != null) put("reason", reason) }

    fun encodeSnapshotRequest(sessionId: String): JSONObject =
        JSONObject().put("sessionId", sessionId)

    fun decodeResponse(payload: JSONObject): PulseSignalingResponse {
        val statusName = payload.optString("status")
        val status = PulseSignalingStatus.entries.firstOrNull { it.name == statusName }
            ?: PulseSignalingStatus.UNKNOWN
        return PulseSignalingResponse(
            ok = payload.optBoolean("ok", false),
            status = status,
            session = payload.optJSONObject("session")?.let(::decodeSession),
        )
    }

    fun decodeSession(payload: JSONObject): PulseServerCallSession {
        val mediaReady = payload.optJSONArray("mediaReadyUids") ?: JSONArray()
        return PulseServerCallSession(
            protocolVersion = payload.requirePositiveInt("protocolVersion"),
            sessionId = payload.requireString("sessionId"),
            requestId = payload.requireString("requestId"),
            callerUid = payload.requireString("callerUid"),
            calleeUid = payload.requireString("calleeUid"),
            mediaType = payload.requireEnum<PulseCallMediaType>("mediaType", uppercase = true),
            state = payload.requireEnum("state"),
            revision = payload.requirePositiveLong("revision"),
            mediaReadyUids = buildSet {
                for (index in 0 until mediaReady.length()) {
                    mediaReady.optString(index).takeIf(String::isNotBlank)?.let(::add)
                }
            },
            terminalReason = payload.optionalString("terminalReason"),
            terminalByUid = payload.optionalString("terminalByUid"),
        )
    }

    private fun JSONObject.requireString(name: String): String =
        optString(name).takeIf(String::isNotBlank)
            ?: throw IllegalArgumentException("Calling v2 response is missing $name")

    private fun JSONObject.requirePositiveInt(name: String): Int =
        optInt(name, 0).takeIf { it > 0 }
            ?: throw IllegalArgumentException("Calling v2 response has an invalid $name")

    private fun JSONObject.requirePositiveLong(name: String): Long =
        optLong(name, 0).takeIf { it > 0 }
            ?: throw IllegalArgumentException("Calling v2 response has an invalid $name")

    private inline fun <reified T : Enum<T>> JSONObject.requireEnum(
        name: String,
        uppercase: Boolean = false,
    ): T {
        val value = requireString(name).let { if (uppercase) it.uppercase() else it }
        return enumValues<T>().firstOrNull { it.name == value }
            ?: throw IllegalArgumentException("Calling v2 response has an invalid $name")
    }

    private fun JSONObject.optionalString(name: String): String? =
        if (isNull(name)) null else optString(name).takeIf(String::isNotBlank)
}
