package com.pulsemessenger.chat.e2ee.v2;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

final class PulseE2eeRecordKey {
    private static final Pattern ID_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$");
    private static final Set<String> RECORD_TYPES = Set.of(
        "identity",
        "signed_prekey",
        "one_time_prekey",
        "session",
        "device_metadata",
        "signal_identity",
        "signal_remote_identity",
        "signal_remote_device",
        "signal_prekey",
        "signal_signed_prekey",
        "signal_kyber_prekey",
        "signal_kyber_use",
        "signal_session",
        "signal_sender_key",
        "signal_index",
        "signal_metadata",
        "message_history",
        "message_history_index"
    );

    private PulseE2eeRecordKey() {}

    static String normalizeType(String recordType) {
        String normalized = recordType == null ? "" : recordType.toLowerCase(Locale.ROOT);
        if (!RECORD_TYPES.contains(normalized)) {
            throw new IllegalArgumentException("e2ee_record_type_invalid");
        }
        return normalized;
    }

    static void requireId(String value, String errorCode) {
        if (value == null || !ID_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    static String preferenceKey(String userId, String recordType, String recordId) {
        requireId(userId, "e2ee_user_id_invalid");
        requireId(recordId, "e2ee_record_id_invalid");
        String normalizedType = normalizeType(recordType);
        return "u2." + digest(userId) + "." + digest(normalizedType + "\u0000" + recordId);
    }

    static String userPrefix(String userId) {
        requireId(userId, "e2ee_user_id_invalid");
        return "u2." + digest(userId) + ".";
    }

    static byte[] associatedData(String userId, String recordType, String recordId) {
        requireId(userId, "e2ee_user_id_invalid");
        requireId(recordId, "e2ee_record_id_invalid");
        String normalizedType = normalizeType(recordType);
        return ("PulseE2EE\u0000v2\u0000" + userId + "\u0000" + normalizedType + "\u0000" + recordId)
            .getBytes(StandardCharsets.UTF_8);
    }

    private static String digest(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte valueByte : bytes) {
                hex.append(String.format(Locale.ROOT, "%02x", valueByte & 0xff));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("sha256_unavailable", error);
        }
    }
}
