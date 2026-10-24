package com.pulsemessenger.chat.e2ee.v2;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.regex.Pattern;

public final class PulseCallIdentityBinding {
    private static final Pattern ID_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$");
    private static final Pattern SHA256_PATTERN = Pattern.compile("^[0-9a-f]{64}$");

    final String sessionId;
    final String callerUserId;
    final String calleeUserId;
    final String senderDeviceId;
    final int senderSignalDeviceId;
    final int senderIdentityVersion;
    final String mediaType;
    final String descriptionType;
    final String dtlsFingerprintSha256;
    final long revision;
    final String nonce;
    final String peerBindingHash;

    public PulseCallIdentityBinding(
        String sessionId,
        String callerUserId,
        String calleeUserId,
        String senderDeviceId,
        int senderSignalDeviceId,
        int senderIdentityVersion,
        String mediaType,
        String descriptionType,
        String dtlsFingerprintSha256,
        long revision,
        String nonce,
        String peerBindingHash
    ) {
        this.sessionId = requireId(sessionId, "e2ee_call_session_id_invalid");
        this.callerUserId = requireId(callerUserId, "e2ee_call_caller_id_invalid");
        this.calleeUserId = requireId(calleeUserId, "e2ee_call_callee_id_invalid");
        if (this.callerUserId.equals(this.calleeUserId)) {
            throw new IllegalArgumentException("e2ee_call_participants_invalid");
        }
        this.senderDeviceId = requireId(senderDeviceId, "e2ee_call_sender_device_id_invalid");
        if (senderSignalDeviceId < 1 || senderSignalDeviceId > 127) {
            throw new IllegalArgumentException("e2ee_call_signal_device_id_invalid");
        }
        this.senderSignalDeviceId = senderSignalDeviceId;
        if (senderIdentityVersion < 1) {
            throw new IllegalArgumentException("e2ee_call_identity_version_invalid");
        }
        this.senderIdentityVersion = senderIdentityVersion;
        if (!"audio".equals(mediaType) && !"video".equals(mediaType)) {
            throw new IllegalArgumentException("e2ee_call_media_type_invalid");
        }
        this.mediaType = mediaType;
        if (!"offer".equals(descriptionType) && !"answer".equals(descriptionType)) {
            throw new IllegalArgumentException("e2ee_call_description_type_invalid");
        }
        this.descriptionType = descriptionType;
        this.dtlsFingerprintSha256 = requireSha256(
            dtlsFingerprintSha256,
            "e2ee_call_fingerprint_invalid"
        );
        if (revision < 0) throw new IllegalArgumentException("e2ee_call_revision_invalid");
        this.revision = revision;
        this.nonce = requireId(nonce, "e2ee_call_nonce_invalid");
        String normalizedPeerHash = peerBindingHash == null
            ? ""
            : peerBindingHash.toLowerCase(Locale.ROOT);
        if ("answer".equals(descriptionType) && normalizedPeerHash.isEmpty()) {
            throw new IllegalArgumentException("e2ee_call_peer_binding_hash_required");
        }
        if (!normalizedPeerHash.isEmpty()) {
            requireSha256(normalizedPeerHash, "e2ee_call_peer_binding_hash_invalid");
        }
        this.peerBindingHash = normalizedPeerHash;
    }

    public byte[] canonicalBytes() {
        return String.join(
            "\u0000",
            "PulseCallE2EE",
            "1",
            sessionId,
            callerUserId,
            calleeUserId,
            senderDeviceId,
            Integer.toString(senderSignalDeviceId),
            Integer.toString(senderIdentityVersion),
            mediaType,
            descriptionType,
            dtlsFingerprintSha256,
            Long.toString(revision),
            nonce,
            peerBindingHash
        ).getBytes(StandardCharsets.UTF_8);
    }

    public String bindingHash(byte[] signature) {
        if (signature == null || signature.length == 0) {
            throw new IllegalArgumentException("e2ee_call_signature_required");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(canonicalBytes());
            byte[] value = digest.digest(signature);
            StringBuilder hex = new StringBuilder(value.length * 2);
            for (byte item : value) {
                hex.append(String.format(Locale.ROOT, "%02x", item & 0xff));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("sha256_unavailable", error);
        }
    }

    private static String requireId(String value, String code) {
        if (value == null || !ID_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException(code);
        }
        return value;
    }

    private static String requireSha256(String value, String code) {
        String normalized = value == null ? "" : value.toLowerCase(Locale.ROOT).replace(":", "");
        if (!SHA256_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException(code);
        }
        return normalized;
    }
}
