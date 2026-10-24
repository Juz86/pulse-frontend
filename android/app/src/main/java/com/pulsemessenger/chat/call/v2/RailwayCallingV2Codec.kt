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
        installationId: String? = null,
    ): JSONObject = JSONObject()
        .put("sessionId", sessionId)
        .put("eventId", eventId)
        .put("expectedRevision", expectedRevision)
        .put("command", command.name)
        .apply { if (reason != null) put("reason", reason) }
        .apply { if (installationId != null) put("installationId", installationId) }

    fun encodeSnapshotRequest(sessionId: String): JSONObject =
        JSONObject().put("sessionId", sessionId)

    fun encodeDescription(
        sessionId: String,
        messageId: String,
        description: PulseSessionDescription,
        identity: PulseCallE2eeIdentityEnvelope? = null,
    ): JSONObject = JSONObject()
        .put("sessionId", sessionId)
        .put("messageId", messageId)
        .put("type", description.type.name.lowercase())
        .put("description", description.value)
        .apply { if (identity != null) put("identity", encodeCallIdentity(identity)) }

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
                identity = payload.optJSONObject("identity")?.let(::decodeCallIdentity),
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
            acceptedInstallationId = payload.optionalString("acceptedInstallationId"),
            iceRestartSequence = payload.optLong("iceRestartSequence", 0).coerceAtLeast(0),
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

    private fun encodeCallIdentity(value: PulseCallE2eeIdentityEnvelope): JSONObject =
        JSONObject()
            .put("protocol", value.protocol)
            .put("protocolVersion", value.protocolVersion)
            .put("sessionId", value.sessionId)
            .put("callerUserId", value.callerUserId)
            .put("calleeUserId", value.calleeUserId)
            .put("senderDeviceId", value.senderDeviceId)
            .put("senderSignalDeviceId", value.senderSignalDeviceId)
            .put("senderIdentityVersion", value.senderIdentityVersion)
            .put("mediaType", value.mediaType.name.lowercase())
            .put("descriptionType", value.descriptionType.name.lowercase())
            .put("dtlsFingerprintSha256", value.dtlsFingerprintSha256)
            .put("revision", value.revision)
            .put("nonce", value.nonce)
            .put("peerBindingHash", value.peerBindingHash)
            .put("identityKey", value.identityKey)
            .put("signature", value.signature)

    private fun decodeCallIdentity(value: JSONObject): PulseCallE2eeIdentityEnvelope =
        PulseCallE2eeIdentityEnvelope(
            protocol = value.requireString("protocol"),
            protocolVersion = value.requirePositiveInt("protocolVersion"),
            sessionId = value.requireString("sessionId"),
            callerUserId = value.requireString("callerUserId"),
            calleeUserId = value.requireString("calleeUserId"),
            senderDeviceId = value.requireString("senderDeviceId"),
            senderSignalDeviceId = value.requirePositiveInt("senderSignalDeviceId"),
            senderIdentityVersion = value.requirePositiveInt("senderIdentityVersion"),
            mediaType = value.requireEnum("mediaType", uppercase = true),
            descriptionType = value.requireEnum("descriptionType", uppercase = true),
            dtlsFingerprintSha256 = value.requireString("dtlsFingerprintSha256"),
            revision = value.requireNonNegativeLong("revision"),
            nonce = value.requireString("nonce"),
            peerBindingHash = value.optString("peerBindingHash"),
            identityKey = value.requireString("identityKey"),
            signature = value.requireString("signature"),
        )

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

    private fun JSONObject.requireNonNegativeLong(name: String): Long =
        optLong(name, -1).takeIf { it >= 0 }
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
