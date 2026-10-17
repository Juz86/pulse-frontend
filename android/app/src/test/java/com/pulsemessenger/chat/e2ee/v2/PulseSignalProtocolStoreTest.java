package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.security.GeneralSecurityException;
import java.util.HashMap;
import java.util.Map;

import org.junit.Test;
import org.signal.libsignal.protocol.SignalProtocolAddress;

public class PulseSignalProtocolStoreTest {
    @Test
    public void rejectsAmbiguousOpaqueToSignalDeviceMappings() throws Exception {
        PulseSignalProtocolStore store = PulseSignalProtocolStore.openOrCreate(
            new MemoryRecordStorage(),
            "alice"
        );

        store.bindRemoteDevice("bob", "device-b1", 2);

        assertThrows(
            IllegalStateException.class,
            () -> store.bindRemoteDevice("bob", "device-b1", 3)
        );
        assertThrows(
            IllegalStateException.class,
            () -> store.bindRemoteDevice("bob", "device-b2", 2)
        );
        assertTrue(store.listSessionDevices("bob").isEmpty());
    }

    @Test
    public void restoresIdentityPreKeysAndSessionsAfterRestart() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseSignalProtocolStore aliceStore = PulseSignalProtocolStore.openOrCreate(storage, "alice");
        PulseSignalProtocolStore bobStore = PulseSignalProtocolStore.openOrCreate(storage, "bob");
        byte[] aliceIdentity = aliceStore.getIdentityKeyPair().serialize();
        byte[] bobIdentity = bobStore.getIdentityKeyPair().serialize();
        int aliceRegistration = aliceStore.getLocalRegistrationId();
        int bobRegistration = bobStore.getLocalRegistrationId();
        assertNotEquals(aliceRegistration, bobRegistration);

        PulseLibsignalSessionEngine engine = new PulseLibsignalSessionEngine();
        PulseLibsignalSessionEngine.KeyMaterial bobMaterial = engine.generateKeyMaterial(
            bobStore.getIdentityKeyPair(),
            30,
            31,
            32,
            1_760_688_000_000L
        );
        engine.installKeyMaterial(bobStore, bobMaterial);
        PulseLibsignalSessionEngine.PublicBundle bobBundle = engine.publicBundle(
            bobRegistration,
            2,
            bobStore.getIdentityKeyPair().getPublicKey(),
            bobMaterial
        );
        SignalProtocolAddress aliceAddress = new SignalProtocolAddress("alice", 1);
        SignalProtocolAddress bobAddress = new SignalProtocolAddress("bob", 2);

        PulseLibsignalSessionEngine.EncryptedEnvelope first = engine.establishAndEncrypt(
            aliceStore,
            aliceAddress,
            bobAddress,
            bobBundle,
            engine.utf8("Eerste bericht")
        );
        assertArrayEquals(engine.utf8("Eerste bericht"), engine.decrypt(
            bobStore,
            bobAddress,
            aliceAddress,
            first
        ));
        assertFalse(bobStore.containsPreKey(31));

        aliceStore = PulseSignalProtocolStore.openOrCreate(storage, "alice");
        bobStore = PulseSignalProtocolStore.openOrCreate(storage, "bob");
        assertArrayEquals(aliceIdentity, aliceStore.getIdentityKeyPair().serialize());
        assertArrayEquals(bobIdentity, bobStore.getIdentityKeyPair().serialize());
        assertEquals(aliceRegistration, aliceStore.getLocalRegistrationId());
        assertEquals(bobRegistration, bobStore.getLocalRegistrationId());
        assertTrue(aliceStore.containsSession(bobAddress));
        assertTrue(bobStore.containsSession(aliceAddress));
        assertEquals(1, bobStore.loadSignedPreKeys().size());
        assertEquals(1, bobStore.loadKyberPreKeys().size());

        PulseLibsignalSessionEngine.EncryptedEnvelope reply = engine.encrypt(
            bobStore,
            bobAddress,
            aliceAddress,
            engine.utf8("Antwoord na restart")
        );
        assertEquals("message", reply.envelopeType);
        assertArrayEquals(engine.utf8("Antwoord na restart"), engine.decrypt(
            aliceStore,
            aliceAddress,
            bobAddress,
            reply
        ));
    }

    private static final class MemoryRecordStorage implements PulseE2eeRecordStorage {
        private final Map<String, byte[]> records = new HashMap<>();

        @Override
        public synchronized void put(
            String userId,
            String recordType,
            String recordId,
            byte[] plaintext
        ) throws GeneralSecurityException {
            records.put(key(userId, recordType, recordId), plaintext.clone());
        }

        @Override
        public synchronized byte[] get(
            String userId,
            String recordType,
            String recordId
        ) throws GeneralSecurityException {
            byte[] value = records.get(key(userId, recordType, recordId));
            return value == null ? null : value.clone();
        }

        @Override
        public synchronized boolean remove(String userId, String recordType, String recordId) {
            return records.remove(key(userId, recordType, recordId)) != null;
        }

        private static String key(String userId, String recordType, String recordId) {
            return userId + "\u0000" + recordType + "\u0000" + recordId;
        }
    }
}
