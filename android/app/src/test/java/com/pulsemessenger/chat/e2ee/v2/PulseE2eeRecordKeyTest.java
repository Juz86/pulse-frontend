package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.Test;

public class PulseE2eeRecordKeyTest {
    @Test
    public void preferenceKeyDoesNotExposeRawIdentifiers() {
        String key = PulseE2eeRecordKey.preferenceKey("user-a", "session", "device-b1");
        assertTrue(key.startsWith("u2."));
        assertFalse(key.contains("user-a"));
        assertFalse(key.contains("device-b1"));
    }

    @Test
    public void keysAreStableAndSeparatedByRecordType() {
        String first = PulseE2eeRecordKey.preferenceKey("user-a", "session", "device-b1");
        String retry = PulseE2eeRecordKey.preferenceKey("user-a", "session", "device-b1");
        String identity = PulseE2eeRecordKey.preferenceKey("user-a", "identity", "device-b1");
        assertEquals(first, retry);
        assertFalse(first.equals(identity));
    }

    @Test
    public void associatedDataBindsUserTypeAndRecord() {
        assertArrayEquals(
            "PulseE2EE\u0000v2\u0000user-a\u0000session\u0000device-b1".getBytes(StandardCharsets.UTF_8),
            PulseE2eeRecordKey.associatedData("user-a", "session", "device-b1")
        );
    }

    @Test
    public void invalidIdentifiersAndRecordTypesFailClosed() {
        assertThrows(
            IllegalArgumentException.class,
            () -> PulseE2eeRecordKey.preferenceKey("../user", "session", "device-b1")
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> PulseE2eeRecordKey.preferenceKey("user-a", "plaintext", "device-b1")
        );
    }

    @Test
    public void acceptsEveryPersistentLibsignalRecordType() {
        for (String recordType : List.of(
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
            "signal_metadata"
        )) {
            assertEquals(recordType, PulseE2eeRecordKey.normalizeType(recordType));
        }
    }
}
