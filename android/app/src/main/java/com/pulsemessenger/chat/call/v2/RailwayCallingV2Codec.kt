package com.pulsemessenger.chat.call.v2

import org.json.JSONArray
import org.json.JSONObject

object RailwayCallingV2Codec {
    const val EVENT_START = "call:v2:start"
    const val EVENT_COMMAND = "call:v2:command"
    const val EVENT_SNAPSHOT = "call:v2:snapshot"
    const val EVENT_UPDATED = "call:v2:updated"
    const val EVENT_ICE_CONFIG = "call:v2:ice-config"
    const val EVENT_MEDIA = "call:v2:media"

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

    fun encodeDescription(
        sessionId: String,
        messageId: String,
        description: PulseSessionDescription,
    ): JSONObject = JSONObject()
        .put("sessionId", sessionId)
        .put("messageId", messageId)
        .put("type", description.type.name.lowercase())
        .put("description", description.value)

    fun encodeIceCandidate(
        sessionId: String,
        messageId: String,
        candidate: PulseIceCandidate,
    ): JSONObject = JSONObject()
        .put("sessionId", sessionId)
        .put("messageId", messageId)
        .put("type", "candidate")
        .put(
            "candidate",
            JSONObject()
                .put("mediaStreamId", candidate.mediaStreamId ?: JSONObject.NULL)
                .put("mediaLineIndex", candidate.mediaLineIndex)
                .put("value", candidate.value),
        )

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

    fun decodeIceConfiguration(payload: JSONObject): PulseIceConfigurationResponse {
        val status = decodeStatus(payload)
        if (!payload.optBoolean("ok", false)) {
            return PulseIceConfigurationResponse(ok = false, status = status)
        }
        val rawServers = payload.optJSONArray("iceServers")
            ?: throw IllegalArgumentException("Calling v2 response is missing iceServers")
        val servers = buildList {
            for (index in 0 until rawServers.length()) {
                add(
                    decodeIceServer(
                        rawServers.optJSONObject(index)
                            ?: throw IllegalArgumentException("Calling v2 response has invalid iceServers"),
                    ),
                )
            }
        }
        if (servers.isEmpty()) {
            throw IllegalArgumentException("Calling v2 response has empty iceServers")
        }
        return PulseIceConfigurationResponse(
            ok = true,
            status = status,
            iceServers = servers,
            expiresInSeconds = payload.requirePositiveInt("expiresInSeconds"),
        )
    }

    fun decodeMediaSignal(payload: JSONObject): PulseRemoteMediaSignal {
        if (payload.requirePositiveInt("protocolVersion") != PULSE_CALL_PROTOCOL_VERSION) {
            throw IllegalArgumentException("Calling v2 response has an invalid protocolVersion")
        }
        val sessionId = payload.requireString("sessionId")
        val messageId = payload.requireString("messageId")
        val senderUid = payload.requireString("senderUid")
        return when (val type = payload.requireString("type")) {
            "offer", "answer" -> PulseRemoteDescriptionSignal(
                sessionId = sessionId,
                messageId = messageId,
                senderUid = senderUid,
                description = PulseSessionDescription(
                    type = if (type == "offer") {
                        PulseSessionDescriptionType.OFFER
                    } else {
                        PulseSessionDescriptionType.ANSWER
                    },
                    value = payload.requireString("description"),
                ),
            )
            "candidate" -> {
                val candidate = payload.optJSONObject("candidate")
                    ?: throw IllegalArgumentException("Calling v2 response is missing candidate")
                PulseRemoteIceCandidateSignal(
                    sessionId = sessionId,
                    messageId = messageId,
                    senderUid = senderUid,
                    candidate = PulseIceCandidate(
                        mediaStreamId = candidate.optionalString("mediaStreamId"),
                        mediaLineIndex = candidate.requireNonNegativeInt("mediaLineIndex"),
                        value = candidate.requireString("value"),
                    ),
                )
            }
            else -> throw IllegalArgumentException("Calling v2 response has an invalid type")
        }
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

    private fun decodeStatus(payload: JSONObject): PulseSignalingStatus =
        payload.optString("status").let { statusName ->
            PulseSignalingStatus.entries.firstOrNull { it.name == statusName }
                ?: PulseSignalingStatus.UNKNOWN
        }

    private fun decodeIceServer(payload: JSONObject): PulseIceServer {
        val rawUrls = payload.opt("urls")
        val urls = when (rawUrls) {
            is JSONArray -> buildList {
                for (index in 0 until rawUrls.length()) {
                    rawUrls.optString(index).takeIf(String::isNotBlank)?.let(::add)
                }
            }
            is String -> listOf(rawUrls).filter(String::isNotBlank)
            else -> emptyList()
        }
        return PulseIceServer(
            urls = urls,
            username = payload.optionalString("username"),
            credential = payload.optionalString("credential"),
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

    private fun JSONObject.requireNonNegativeInt(name: String): Int =
        optInt(name, -1).takeIf { it >= 0 }
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
