package com.pulsemessenger.chat.call.v2

import android.content.Context
import android.util.Base64
import com.pulsemessenger.chat.e2ee.v2.PulseCallIdentityBinding
import com.pulsemessenger.chat.e2ee.v2.PulseE2eeSecureStore
import com.pulsemessenger.chat.e2ee.v2.PulseE2eeV2Provider
import java.util.UUID

const val PULSE_CALL_E2EE_PROTOCOL = "pulse_call_e2ee_v1"
const val PULSE_CALL_E2EE_VERSION = 1

interface PulseCallE2eeIdentityBinder {
    suspend fun sign(
        session: PulseServerCallSession,
        localUid: String,
        description: PulseSessionDescription,
        verifiedPeer: PulseCallE2eeIdentityEnvelope?,
    ): PulseCallE2eeIdentityEnvelope

    suspend fun verify(
        session: PulseServerCallSession,
        remoteUid: String,
        description: PulseSessionDescription,
        identity: PulseCallE2eeIdentityEnvelope,
        localOffer: PulseCallE2eeIdentityEnvelope?,
    ): String
}

class NativePulseCallE2eeIdentityBinder(context: Context) : PulseCallE2eeIdentityBinder {
    private val provider = PulseE2eeV2Provider(PulseE2eeSecureStore(context.applicationContext))

    override suspend fun sign(
        session: PulseServerCallSession,
        localUid: String,
        description: PulseSessionDescription,
        verifiedPeer: PulseCallE2eeIdentityEnvelope?,
    ): PulseCallE2eeIdentityEnvelope {
        requireParticipant(session, localUid)
        requireDescriptionRole(session, localUid, description.type)
        val local = provider.getLocalDeviceBinding(localUid)
        val fingerprint = extractSha256DtlsFingerprint(description.value)
            ?: throw IllegalArgumentException("e2ee_call_fingerprint_invalid")
        val peerHash = when (description.type) {
            PulseSessionDescriptionType.OFFER -> ""
            PulseSessionDescriptionType.ANSWER -> verifiedPeer?.bindingHash()
                ?: throw IllegalStateException("e2ee_call_verified_offer_required")
        }
        val nonce = UUID.randomUUID().toString()
        val binding = PulseCallIdentityBinding(
            session.sessionId,
            session.callerUid,
            session.calleeUid,
            local.deviceId,
            local.signalDeviceId,
            local.identityVersion,
            session.mediaType.name.lowercase(),
            description.type.name.lowercase(),
            fingerprint,
            session.revision,
            nonce,
            peerHash,
        )
        val signature = provider.signCallIdentityBinding(localUid, local.signalDeviceId, binding)
        return PulseCallE2eeIdentityEnvelope(
            protocol = PULSE_CALL_E2EE_PROTOCOL,
            protocolVersion = PULSE_CALL_E2EE_VERSION,
            sessionId = session.sessionId,
            callerUserId = session.callerUid,
            calleeUserId = session.calleeUid,
            senderDeviceId = local.deviceId,
            senderSignalDeviceId = local.signalDeviceId,
            senderIdentityVersion = local.identityVersion,
            mediaType = session.mediaType,
            descriptionType = description.type,
            dtlsFingerprintSha256 = fingerprint,
            revision = session.revision,
            nonce = nonce,
            peerBindingHash = peerHash,
            identityKey = encode(provider.getLocalIdentityKey(localUid, local.signalDeviceId)),
            signature = encode(signature),
        )
    }

    override suspend fun verify(
        session: PulseServerCallSession,
        remoteUid: String,
        description: PulseSessionDescription,
        identity: PulseCallE2eeIdentityEnvelope,
        localOffer: PulseCallE2eeIdentityEnvelope?,
    ): String {
        requireParticipant(session, remoteUid)
        requireDescriptionRole(session, remoteUid, description.type)
        require(identity.protocol == PULSE_CALL_E2EE_PROTOCOL)
        require(identity.protocolVersion == PULSE_CALL_E2EE_VERSION)
        require(identity.sessionId == session.sessionId)
        require(identity.callerUserId == session.callerUid)
        require(identity.calleeUserId == session.calleeUid)
        require(identity.mediaType == session.mediaType)
        require(identity.descriptionType == description.type)
        require(identity.revision == session.revision)
        val fingerprint = extractSha256DtlsFingerprint(description.value)
            ?: throw IllegalArgumentException("e2ee_call_fingerprint_invalid")
        require(identity.dtlsFingerprintSha256 == fingerprint)
        if (description.type == PulseSessionDescriptionType.OFFER) {
            require(identity.peerBindingHash.isEmpty())
        } else {
            require(identity.peerBindingHash == localOffer?.bindingHash())
        }
        val local = provider.getLocalDeviceBinding(
            if (remoteUid == session.callerUid) session.calleeUid else session.callerUid,
        )
        provider.verifyCallIdentityBinding(
            if (remoteUid == session.callerUid) session.calleeUid else session.callerUid,
            local.signalDeviceId,
            remoteUid,
            identity.senderDeviceId,
            identity.senderSignalDeviceId,
            identity.senderIdentityVersion,
            decode(identity.identityKey),
            identity.toBinding(),
            decode(identity.signature),
        )
        return identity.bindingHash()
    }

    private fun PulseCallE2eeIdentityEnvelope.toBinding() = PulseCallIdentityBinding(
        sessionId,
        callerUserId,
        calleeUserId,
        senderDeviceId,
        senderSignalDeviceId,
        senderIdentityVersion,
        mediaType.name.lowercase(),
        descriptionType.name.lowercase(),
        dtlsFingerprintSha256,
        revision,
        nonce,
        peerBindingHash,
    )

    private fun PulseCallE2eeIdentityEnvelope.bindingHash(): String =
        toBinding().bindingHash(decode(signature))

    private fun requireParticipant(session: PulseServerCallSession, uid: String) {
        require(uid == session.callerUid || uid == session.calleeUid) {
            "e2ee_call_signer_not_participant"
        }
    }

    private fun requireDescriptionRole(
        session: PulseServerCallSession,
        uid: String,
        type: PulseSessionDescriptionType,
    ) {
        require(
            (type == PulseSessionDescriptionType.OFFER && uid == session.callerUid) ||
                (type == PulseSessionDescriptionType.ANSWER && uid == session.calleeUid),
        ) { "e2ee_call_description_role_invalid" }
    }

    private fun encode(value: ByteArray): String = Base64.encodeToString(value, Base64.NO_WRAP)

    private fun decode(value: String): ByteArray = try {
        Base64.decode(value, Base64.DEFAULT)
    } catch (error: IllegalArgumentException) {
        throw IllegalArgumentException("e2ee_base64_invalid", error)
    }
}
