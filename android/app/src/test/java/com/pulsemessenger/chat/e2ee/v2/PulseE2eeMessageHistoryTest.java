package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import java.security.GeneralSecurityException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.Test;

public class PulseE2eeMessageHistoryTest {
    @Test
    public void restoresMessagesAcrossHistoryInstancesAndReplacesDuplicateIds() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeMessageHistory first = new PulseE2eeMessageHistory(storage);
        first.store("alice", message("conversation-1", "message-2", "Tweede", "2026-10-19T12:01:00.000Z"));
        first.store("alice", message("conversation-1", "message-1", "Eerste", "2026-10-19T12:00:00.000Z"));
        first.store("alice", message("conversation-1", "message-2", "Tweede nieuw", "2026-10-19T12:01:00.000Z"));

        PulseE2eeMessageHistory reopened = new PulseE2eeMessageHistory(storage);
        List<PulseE2eeMessageHistory.TextMessage> messages = reopened.list(
            "alice",
            "conversation-1",
            50,
            0
        );

        assertEquals(2, messages.size());
        assertEquals("message-1", messages.get(0).messageId);
        assertEquals("message-2", messages.get(1).messageId);
        assertEquals("Tweede nieuw", messages.get(1).plaintext);
        assertEquals(2, reopened.clear("alice", "conversation-1"));
        assertEquals(0, reopened.list("alice", "conversation-1", 50, 0).size());
    }

    @Test
    public void keepsOnlyTheNewestBoundedHistoryAndPagesFromTheEnd() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeMessageHistory history = new PulseE2eeMessageHistory(storage);
        for (int index = 0; index < PulseE2eeMessageHistory.MAX_MESSAGES_PER_CONVERSATION + 3; index++) {
            history.store(
                "alice",
                message(
                    "conversation-1",
                    String.format("message-%03d", index),
                    "Bericht " + index,
                    String.format("2026-10-19T12:%02d:%02d.000Z", (index / 60) % 60, index % 60)
                )
            );
        }

        List<PulseE2eeMessageHistory.TextMessage> newest = history.list(
            "alice",
            "conversation-1",
            2,
            0
        );
        List<PulseE2eeMessageHistory.TextMessage> previous = history.list(
            "alice",
            "conversation-1",
            2,
            2
        );

        assertEquals("message-201", newest.get(0).messageId);
        assertEquals("message-202", newest.get(1).messageId);
        assertEquals("message-199", previous.get(0).messageId);
        assertEquals("message-200", previous.get(1).messageId);
    }

    @Test
    public void rejectsUnsupportedMessageTypesAndInvalidPaging() {
        PulseE2eeMessageHistory history = new PulseE2eeMessageHistory(new MemoryRecordStorage());
        PulseE2eeMessageHistory.TextMessage invalid = new PulseE2eeMessageHistory.TextMessage(
            "conversation-1",
            "message-1",
            null,
            "bob",
            "device-b",
            "image",
            "geen tekst",
            "2026-10-19T12:00:00.000Z"
        );

        assertThrows(IllegalArgumentException.class, () -> history.store("alice", invalid));
        assertThrows(
            IllegalArgumentException.class,
            () -> history.list("alice", "conversation-1", 0, 0)
        );
    }

    private static PulseE2eeMessageHistory.TextMessage message(
        String conversationId,
        String messageId,
        String plaintext,
        String createdAt
    ) {
        return new PulseE2eeMessageHistory.TextMessage(
            conversationId,
            messageId,
            "client-" + messageId,
            "bob",
            "device-b",
            "text",
            plaintext,
            createdAt
        );
    }

    private static final class MemoryRecordStorage implements PulseE2eeRecordStorage {
        private final Map<String, byte[]> records = new HashMap<>();

        @Override
        public void put(String userId, String recordType, String recordId, byte[] plaintext) {
            records.put(key(userId, recordType, recordId), plaintext.clone());
        }

        @Override
        public byte[] get(String userId, String recordType, String recordId) {
            byte[] value = records.get(key(userId, recordType, recordId));
            return value == null ? null : value.clone();
        }

        @Override
        public boolean remove(String userId, String recordType, String recordId) {
            return records.remove(key(userId, recordType, recordId)) != null;
        }

        private static String key(String userId, String recordType, String recordId) {
            return userId + "\u0000" + recordType + "\u0000" + recordId;
        }
    }
}
