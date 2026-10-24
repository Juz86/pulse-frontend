package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

import org.junit.Test;

public class PulseE2eeV2ProviderTest {
    @Test
    public void bootstrapsAndExchangesTextAcrossProviderRestarts() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeV2Provider alice = provider(storage, 11L);
        PulseE2eeV2Provider bob = provider(storage, 22L);
        PulseE2eeV2Provider.BootstrapResult aliceBootstrap = alice.bootstrapDevice("alice", 1, 3);
        PulseE2eeV2Provider.BootstrapResult bobBootstrap = bob.bootstrapDevice("bob", 2, 3);

        assertEquals(1, aliceBootstrap.signalDeviceId);
        assertEquals(3, aliceBootstrap.oneTimePreKeys.size());
        assertFalse(aliceBootstrap.identityKey.length == 0);

        PulseLibsignalSessionEngine.PublicBundle bobBundle = publicBundle(bobBootstrap);
        PulseLibsignalSessionEngine.EncryptedEnvelope first = alice.encryptText(
            "alice",
            1,
            "bob",
            "bob-device",
            2,
            "Wat doe je?",
            bobBundle
        );
        assertEquals("prekey", first.envelopeType);
        assertEquals("Wat doe je?", bob.decryptText(
            "bob",
            2,
            "alice",
            "alice-device",
            1,
            first
        ));
        assertEquals(
            "bob-device",
            alice.listSessionDevices("alice", 1, "bob").get(0).remoteDeviceId
        );
        assertEquals(
            "alice-device",
            bob.listSessionDevices("bob", 2, "alice").get(0).remoteDeviceId
        );

        alice = provider(storage, 33L);
        bob = provider(storage, 44L);
        PulseLibsignalSessionEngine.EncryptedEnvelope reply = bob.encryptText(
            "bob",
            2,
            "alice",
            "alice-device",
            1,
            "Ik ben onderweg.",
            null
        );
        assertEquals("message", reply.envelopeType);
        assertEquals("Ik ben onderweg.", alice.decryptText(
            "alice",
            1,
            "bob",
            "bob-device",
            2,
            reply
        ));
    }

    @Test
    public void keepsSignalDeviceIdBoundToThePersistedIdentity() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeV2Provider provider = provider(storage, 55L);
        PulseE2eeV2Provider.BootstrapResult first = provider.bootstrapDevice("alice", 7, 1);
        PulseE2eeV2Provider.BootstrapResult repeated = provider.bootstrapDevice("alice", 7, 1);

        assertEquals(first.registrationId, repeated.registrationId);
        assertThrows(
            IllegalStateException.class,
            () -> provider.bootstrapDevice("alice", 8, 1)
        );
    }

    @Test
    public void persistsTheBackendConfirmedLocalDeviceBinding() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeV2Provider provider = provider(storage, 57L);
        provider.bootstrapDevice("alice", 7, 1);

        PulseE2eeV2Provider.LocalDeviceBinding stored = provider.bindLocalDeviceRegistration(
            "alice", "device-a1", 7, 3
        );
        assertEquals("device-a1", stored.deviceId);
        assertEquals(7, stored.signalDeviceId);
        assertEquals(3, stored.identityVersion);

        PulseE2eeV2Provider.LocalDeviceBinding restored = provider(storage, 58L)
            .getLocalDeviceBinding("alice");
        assertEquals("device-a1", restored.deviceId);
        assertEquals(7, restored.signalDeviceId);
        assertEquals(3, restored.identityVersion);
        assertThrows(
            IllegalStateException.class,
            () -> provider.bindLocalDeviceRegistration("alice", "device-a1", 8, 3)
        );
    }

    @Test
    public void replacesAStaleSessionAfterRemoteIdentityRotationAndBlocksRevocation()
        throws Exception {
        MemoryRecordStorage aliceStorage = new MemoryRecordStorage();
        PulseE2eeV2Provider alice = provider(aliceStorage, 61L);
        PulseE2eeV2Provider bob = provider(new MemoryRecordStorage(), 62L);
        PulseE2eeV2Provider.BootstrapResult aliceBootstrap = alice.bootstrapDevice("alice", 1, 2);
        PulseE2eeV2Provider.BootstrapResult bobBootstrap = bob.bootstrapDevice("bob", 2, 2);

        PulseLibsignalSessionEngine.EncryptedEnvelope first = alice.encryptText(
            "alice", 1, "bob", "bob-device", 2, 1, "Eerste identity", publicBundle(bobBootstrap)
        );
        assertEquals("Eerste identity", bob.decryptText(
            "bob", 2, "alice", "alice-device", 1, 1, first
        ));
        assertEquals(
            1,
            alice.listSessionDevices("alice", 1, "bob").get(0).identityVersion
        );

        PulseE2eeV2Provider rotatedBob = provider(new MemoryRecordStorage(), 63L);
        PulseE2eeV2Provider.BootstrapResult rotatedBootstrap = rotatedBob.bootstrapDevice("bob", 2, 2);
        PulseLibsignalSessionEngine.EncryptedEnvelope afterRotation = alice.encryptText(
            "alice",
            1,
            "bob",
            "bob-device",
            2,
            2,
            "Nieuwe identity",
            publicBundle(rotatedBootstrap)
        );

        assertEquals("prekey", afterRotation.envelopeType);
        assertEquals("Nieuwe identity", rotatedBob.decryptText(
            "bob", 2, "alice", "alice-device", 1, 1, afterRotation
        ));
        assertEquals(
            2,
            alice.listSessionDevices("alice", 1, "bob").get(0).identityVersion
        );
        assertThrows(
            IllegalStateException.class,
            () -> alice.encryptText(
                "alice", 1, "bob", "bob-device", 2, 1, "Oud", publicBundle(bobBootstrap)
            )
        );

        alice.invalidateRemoteDevice("alice", 1, "bob", "bob-device", 2, 2, true);
        assertTrue(alice.listSessionDevices("alice", 1, "bob").isEmpty());
        assertThrows(
            IllegalStateException.class,
            () -> alice.encryptText(
                "alice", 1, "bob", "bob-device", 2, 2, "Na revoke", publicBundle(rotatedBootstrap)
            )
        );
    }

    @Test
    public void exchangesGroupTextAcrossRestartsAndRejectsReplay() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeV2Provider alice = provider(storage, 71L);
        PulseE2eeV2Provider bob = provider(storage, 72L);
        alice.bootstrapDevice("alice", 1, 1);
        bob.bootstrapDevice("bob", 2, 1);
        String distributionId = "9b3553e9-bbe6-4938-beb5-5cb740412fd0";

        byte[] distribution = alice.createGroupSenderKeyDistribution(
            "alice",
            1,
            "group-1",
            1,
            distributionId
        );
        bob.processGroupSenderKeyDistribution(
            "bob",
            2,
            "alice",
            1,
            "group-1",
            1,
            distributionId,
            distribution
        );
        PulseE2eeV2Provider.GroupCiphertext encrypted = alice.encryptGroupText(
            "alice",
            1,
            "group-1",
            1,
            distributionId,
            "Hallo groep"
        );

        bob = provider(storage, 73L);
        assertEquals("Hallo groep", bob.decryptGroupText(
            "bob",
            2,
            "alice",
            1,
            "group-1",
            1,
            distributionId,
            encrypted.ciphertext
        ));
        PulseE2eeV2Provider restartedBob = provider(storage, 74L);
        assertThrows(
            Exception.class,
            () -> restartedBob.decryptGroupText(
                "bob",
                2,
                "alice",
                1,
                "group-1",
                1,
                distributionId,
                encrypted.ciphertext
            )
        );
    }

    @Test
    public void rejectsGroupOrEpochSwapBeforeConsumingCiphertext() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeV2Provider alice = provider(storage, 81L);
        PulseE2eeV2Provider bob = provider(storage, 82L);
        alice.bootstrapDevice("alice", 1, 1);
        bob.bootstrapDevice("bob", 2, 1);
        String distributionId = "ad112b29-684d-445f-9d66-6ea3da87876d";
        byte[] distribution = alice.createGroupSenderKeyDistribution(
            "alice", 1, "group-1", 4, distributionId
        );
        bob.processGroupSenderKeyDistribution(
            "bob", 2, "alice", 1, "group-1", 4, distributionId, distribution
        );
        PulseE2eeV2Provider.GroupCiphertext encrypted = alice.encryptGroupText(
            "alice", 1, "group-1", 4, distributionId, "Gebonden bericht"
        );

        assertThrows(
            IllegalStateException.class,
            () -> bob.decryptGroupText(
                "bob", 2, "alice", 1, "group-2", 4, distributionId, encrypted.ciphertext
            )
        );
        assertThrows(
            IllegalStateException.class,
            () -> bob.decryptGroupText(
                "bob", 2, "alice", 1, "group-1", 5, distributionId, encrypted.ciphertext
            )
        );
        assertEquals("Gebonden bericht", bob.decryptGroupText(
            "bob", 2, "alice", 1, "group-1", 4, distributionId, encrypted.ciphertext
        ));
    }

    @Test
    public void invalidatesGroupSenderKeyOnMembershipRotation() throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeV2Provider alice = provider(storage, 91L);
        PulseE2eeV2Provider bob = provider(storage, 92L);
        alice.bootstrapDevice("alice", 1, 1);
        bob.bootstrapDevice("bob", 2, 1);
        String distributionId = "aa187757-86a8-4e4b-ab5f-df539e653f4b";
        byte[] distribution = alice.createGroupSenderKeyDistribution(
            "alice", 1, "group-1", 1, distributionId
        );
        bob.processGroupSenderKeyDistribution(
            "bob", 2, "alice", 1, "group-1", 1, distributionId, distribution
        );
        bob.invalidateGroupSenderKey("bob", 2, "alice", 1, distributionId);
        PulseE2eeV2Provider.GroupCiphertext encrypted = alice.encryptGroupText(
            "alice", 1, "group-1", 1, distributionId, "Na ledenwijziging"
        );

        assertThrows(
            IllegalStateException.class,
            () -> bob.decryptGroupText(
                "bob", 2, "alice", 1, "group-1", 1, distributionId, encrypted.ciphertext
            )
        );
    }

    @Test
    public void signsAndVerifiesTheNegotiatedCallFingerprintWithATrustedIdentity()
        throws Exception {
        MemoryRecordStorage storage = new MemoryRecordStorage();
        PulseE2eeV2Provider alice = provider(storage, 101L);
        PulseE2eeV2Provider bob = provider(storage, 102L);
        PulseE2eeV2Provider.BootstrapResult aliceBootstrap = alice.bootstrapDevice("alice", 1, 1);
        PulseE2eeV2Provider.BootstrapResult bobBootstrap = bob.bootstrapDevice("bob", 2, 1);
        PulseLibsignalSessionEngine.EncryptedEnvelope trustEnvelope = alice.encryptText(
            "alice", 1, "bob", "bob-device", 2, 1, "Trust setup", publicBundle(bobBootstrap)
        );
        assertEquals("Trust setup", bob.decryptText(
            "bob", 2, "alice", "alice-device", 1, 1, trustEnvelope
        ));

        PulseCallIdentityBinding offer = callBinding(
            "call-1",
            "alice-device",
            1,
            "offer",
            repeat('a', 64),
            null
        );
        byte[] signature = alice.signCallIdentityBinding("alice", 1, offer);

        bob.verifyCallIdentityBinding(
            "bob",
            2,
            "alice",
            "alice-device",
            1,
            1,
            aliceBootstrap.identityKey,
            offer,
            signature
        );

        PulseCallIdentityBinding changedFingerprint = callBinding(
            "call-1",
            "alice-device",
            1,
            "offer",
            repeat('b', 64),
            null
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> bob.verifyCallIdentityBinding(
                "bob", 2, "alice", "alice-device", 1, 1,
                aliceBootstrap.identityKey, changedFingerprint, signature
            )
        );

        PulseCallIdentityBinding changedSession = callBinding(
            "call-2",
            "alice-device",
            1,
            "offer",
            repeat('a', 64),
            null
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> bob.verifyCallIdentityBinding(
                "bob", 2, "alice", "alice-device", 1, 1,
                aliceBootstrap.identityKey, changedSession, signature
            )
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> bob.verifyCallIdentityBinding(
                "bob", 2, "alice", "other-device", 1, 1,
                aliceBootstrap.identityKey, offer, signature
            )
        );
    }

    @Test
    public void rejectsCallIdentityThatHasNoExistingTrustedSignalSession() throws Exception {
        PulseE2eeV2Provider alice = provider(new MemoryRecordStorage(), 111L);
        PulseE2eeV2Provider bob = provider(new MemoryRecordStorage(), 112L);
        PulseE2eeV2Provider.BootstrapResult aliceBootstrap = alice.bootstrapDevice("alice", 1, 1);
        bob.bootstrapDevice("bob", 2, 1);
        PulseCallIdentityBinding offer = callBinding(
            "call-untrusted",
            "alice-device",
            1,
            "offer",
            repeat('c', 64),
            null
        );
        byte[] signature = alice.signCallIdentityBinding("alice", 1, offer);

        IllegalStateException error = assertThrows(
            IllegalStateException.class,
            () -> bob.verifyCallIdentityBinding(
                "bob", 2, "alice", "alice-device", 1, 1,
                aliceBootstrap.identityKey, offer, signature
            )
        );
        assertEquals("e2ee_call_identity_untrusted", error.getMessage());
    }

    @Test
    public void requiresAnswersToBindTheSignedOffer() {
        assertThrows(
            IllegalArgumentException.class,
            () -> callBinding(
                "call-1", "bob-device", 2, "answer", repeat('d', 64), null
            )
        );
        PulseCallIdentityBinding answer = callBinding(
            "call-1",
            "bob-device",
            2,
            "answer",
            repeat('d', 64),
            repeat('e', 64)
        );
        assertEquals("answer", answer.descriptionType);
    }

    private static PulseCallIdentityBinding callBinding(
        String sessionId,
        String senderDeviceId,
        int senderSignalDeviceId,
        String descriptionType,
        String fingerprint,
        String peerBindingHash
    ) {
        return new PulseCallIdentityBinding(
            sessionId,
            "alice",
            "bob",
            senderDeviceId,
            senderSignalDeviceId,
            1,
            "video",
            descriptionType,
            fingerprint,
            0,
            "nonce-1",
            peerBindingHash
        );
    }

    private static String repeat(char value, int count) {
        return String.valueOf(value).repeat(count);
    }

    private static PulseE2eeV2Provider provider(MemoryRecordStorage storage, long seed) {
        SecureRandom random = new SecureRandom();
        random.setSeed(seed);
        return new PulseE2eeV2Provider(storage, new PulseLibsignalSessionEngine(), random);
    }

    private static PulseLibsignalSessionEngine.PublicBundle publicBundle(
        PulseE2eeV2Provider.BootstrapResult value
    ) throws Exception {
        return new PulseLibsignalSessionEngine.PublicBundle(
            value.registrationId,
            value.signalDeviceId,
            value.identityKey,
            value.signedPreKey.getId(),
            value.signedPreKey.getKeyPair().getPublicKey().serialize(),
            value.signedPreKey.getSignature(),
            value.oneTimePreKeys.get(0).getId(),
            value.oneTimePreKeys.get(0).getKeyPair().getPublicKey().serialize(),
            value.kyberPreKey.getId(),
            value.kyberPreKey.getKeyPair().getPublicKey().serialize(),
            value.kyberPreKey.getSignature()
        );
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
