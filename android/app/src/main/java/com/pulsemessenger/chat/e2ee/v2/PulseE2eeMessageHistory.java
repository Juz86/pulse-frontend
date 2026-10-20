package com.pulsemessenger.chat.e2ee.v2;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class PulseE2eeMessageHistory {
    static final int MAX_MESSAGES_PER_CONVERSATION = 200;
    private static final int MAX_PLAINTEXT_BYTES = 64 * 1024;
    private static final int FORMAT_VERSION = 1;
    private static final String RECORD_TYPE = "message_history";
    private static final String INDEX_RECORD_TYPE = "message_history_index";

    private final PulseE2eeRecordStorage storage;

    PulseE2eeMessageHistory(PulseE2eeRecordStorage storage) {
        this.storage = storage;
    }

    synchronized int store(String userId, TextMessage message) throws GeneralSecurityException {
        validate(message);
        storage.put(
            userId,
            RECORD_TYPE,
            message.messageId,
            encodeMessage(message)
        );
        List<HistoryEntry> entries = loadIndex(userId, message.conversationId);
        entries.removeIf(existing -> existing.messageId.equals(message.messageId));
        entries.add(new HistoryEntry(message.messageId, message.createdAt));
        entries.sort(HistoryEntry.ORDER);
        List<HistoryEntry> removedEntries = new ArrayList<>();
        while (entries.size() > MAX_MESSAGES_PER_CONVERSATION) {
            removedEntries.add(entries.remove(0));
        }
        storage.put(
            userId,
            INDEX_RECORD_TYPE,
            message.conversationId,
            encodeIndex(entries)
        );
        for (HistoryEntry removed : removedEntries) {
            storage.remove(userId, RECORD_TYPE, removed.messageId);
        }
        return entries.size();
    }

    synchronized List<TextMessage> list(
        String userId,
        String conversationId,
        int limit,
        int offset
    ) throws GeneralSecurityException {
        PulseE2eeRecordKey.requireId(conversationId, "e2ee_conversation_id_invalid");
        if (limit < 1 || limit > 100) throw new IllegalArgumentException("e2ee_history_limit_invalid");
        if (offset < 0 || offset > 1000) throw new IllegalArgumentException("e2ee_history_offset_invalid");
        List<HistoryEntry> entries = loadIndex(userId, conversationId);
        int end = Math.max(0, entries.size() - offset);
        int start = Math.max(0, end - limit);
        List<TextMessage> messages = new ArrayList<>();
        for (HistoryEntry entry : entries.subList(start, end)) {
            byte[] encoded = storage.get(userId, RECORD_TYPE, entry.messageId);
            if (encoded == null) continue;
            TextMessage message = decodeMessage(encoded);
            validate(message);
            if (!conversationId.equals(message.conversationId)) {
                throw new GeneralSecurityException("e2ee_history_conversation_mismatch");
            }
            messages.add(message);
        }
        messages.sort(TextMessage.ORDER);
        return List.copyOf(messages);
    }

    synchronized int clear(String userId, String conversationId) throws GeneralSecurityException {
        List<HistoryEntry> entries = loadIndex(userId, conversationId);
        storage.remove(userId, INDEX_RECORD_TYPE, conversationId);
        int removed = 0;
        for (HistoryEntry entry : entries) {
            if (storage.remove(userId, RECORD_TYPE, entry.messageId)) removed++;
        }
        return removed;
    }

    private List<HistoryEntry> loadIndex(String userId, String conversationId)
        throws GeneralSecurityException {
        PulseE2eeRecordKey.requireId(userId, "e2ee_user_id_invalid");
        PulseE2eeRecordKey.requireId(conversationId, "e2ee_conversation_id_invalid");
        byte[] encoded = storage.get(userId, INDEX_RECORD_TYPE, conversationId);
        if (encoded == null) return new ArrayList<>();
        try {
            JSONObject root = new JSONObject(new String(encoded, StandardCharsets.UTF_8));
            if (root.getInt("version") != FORMAT_VERSION) {
                throw new JSONException("history_version_invalid");
            }
            JSONArray values = root.getJSONArray("entries");
            List<HistoryEntry> entries = new ArrayList<>();
            for (int index = 0; index < values.length(); index++) {
                entries.add(HistoryEntry.fromJson(values.getJSONObject(index)));
            }
            entries.sort(HistoryEntry.ORDER);
            return entries;
        } catch (JSONException | IllegalArgumentException error) {
            throw new GeneralSecurityException("e2ee_history_record_invalid", error);
        }
    }

    private static byte[] encodeIndex(List<HistoryEntry> entries) throws GeneralSecurityException {
        try {
            JSONArray values = new JSONArray();
            for (HistoryEntry entry : entries) values.put(entry.toJson());
            JSONObject root = new JSONObject();
            root.put("version", FORMAT_VERSION);
            root.put("entries", values);
            return root.toString().getBytes(StandardCharsets.UTF_8);
        } catch (JSONException error) {
            throw new GeneralSecurityException("e2ee_history_encode_failed", error);
        }
    }

    private static byte[] encodeMessage(TextMessage message) throws GeneralSecurityException {
        try {
            return message.toJson().toString().getBytes(StandardCharsets.UTF_8);
        } catch (JSONException error) {
            throw new GeneralSecurityException("e2ee_history_encode_failed", error);
        }
    }

    private static TextMessage decodeMessage(byte[] encoded) throws GeneralSecurityException {
        try {
            return TextMessage.fromJson(new JSONObject(new String(encoded, StandardCharsets.UTF_8)));
        } catch (JSONException error) {
            throw new GeneralSecurityException("e2ee_history_record_invalid", error);
        }
    }

    private static void validate(TextMessage message) {
        if (message == null) throw new IllegalArgumentException("e2ee_history_message_required");
        PulseE2eeRecordKey.requireId(message.conversationId, "e2ee_conversation_id_invalid");
        PulseE2eeRecordKey.requireId(message.messageId, "e2ee_message_id_invalid");
        PulseE2eeRecordKey.requireId(message.senderUserId, "e2ee_sender_user_id_invalid");
        PulseE2eeRecordKey.requireId(message.senderDeviceId, "e2ee_sender_device_id_invalid");
        if (message.clientMessageId != null) {
            PulseE2eeRecordKey.requireId(message.clientMessageId, "e2ee_client_message_id_invalid");
        }
        if (!"text".equals(message.messageType)) {
            throw new IllegalArgumentException("e2ee_history_message_type_invalid");
        }
        if (message.plaintext == null
            || message.plaintext.getBytes(StandardCharsets.UTF_8).length > MAX_PLAINTEXT_BYTES) {
            throw new IllegalArgumentException("e2ee_history_plaintext_size_invalid");
        }
        if (message.createdAt == null || message.createdAt.isBlank() || message.createdAt.length() > 64) {
            throw new IllegalArgumentException("e2ee_history_created_at_invalid");
        }
    }

    static final class TextMessage {
        static final Comparator<TextMessage> ORDER = Comparator
            .comparing((TextMessage value) -> value.createdAt)
            .thenComparing(value -> value.messageId);

        final String conversationId;
        final String messageId;
        final String clientMessageId;
        final String senderUserId;
        final String senderDeviceId;
        final String messageType;
        final String plaintext;
        final String createdAt;

        TextMessage(
            String conversationId,
            String messageId,
            String clientMessageId,
            String senderUserId,
            String senderDeviceId,
            String messageType,
            String plaintext,
            String createdAt
        ) {
            this.conversationId = conversationId;
            this.messageId = messageId;
            this.clientMessageId = clientMessageId;
            this.senderUserId = senderUserId;
            this.senderDeviceId = senderDeviceId;
            this.messageType = messageType;
            this.plaintext = plaintext;
            this.createdAt = createdAt;
        }

        JSONObject toJson() throws JSONException {
            JSONObject value = new JSONObject();
            value.put("conversationId", conversationId);
            value.put("messageId", messageId);
            if (clientMessageId != null) value.put("clientMessageId", clientMessageId);
            value.put("senderUserId", senderUserId);
            value.put("senderDeviceId", senderDeviceId);
            value.put("messageType", messageType);
            value.put("plaintext", plaintext);
            value.put("createdAt", createdAt);
            return value;
        }

        static TextMessage fromJson(JSONObject value) throws JSONException {
            return new TextMessage(
                value.getString("conversationId"),
                value.getString("messageId"),
                value.has("clientMessageId") ? value.getString("clientMessageId") : null,
                value.getString("senderUserId"),
                value.getString("senderDeviceId"),
                value.getString("messageType"),
                value.getString("plaintext"),
                value.getString("createdAt")
            );
        }
    }

    private static final class HistoryEntry {
        static final Comparator<HistoryEntry> ORDER = Comparator
            .comparing((HistoryEntry value) -> value.createdAt)
            .thenComparing(value -> value.messageId);

        final String messageId;
        final String createdAt;

        HistoryEntry(String messageId, String createdAt) {
            PulseE2eeRecordKey.requireId(messageId, "e2ee_message_id_invalid");
            if (createdAt == null || createdAt.isBlank() || createdAt.length() > 64) {
                throw new IllegalArgumentException("e2ee_history_created_at_invalid");
            }
            this.messageId = messageId;
            this.createdAt = createdAt;
        }

        JSONObject toJson() throws JSONException {
            JSONObject value = new JSONObject();
            value.put("messageId", messageId);
            value.put("createdAt", createdAt);
            return value;
        }

        static HistoryEntry fromJson(JSONObject value) throws JSONException {
            return new HistoryEntry(
                value.getString("messageId"),
                value.getString("createdAt")
            );
        }
    }
}
