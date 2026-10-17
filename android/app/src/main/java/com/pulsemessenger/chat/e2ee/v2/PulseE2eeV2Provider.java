package com.pulsemessenger.chat.e2ee.v2;

import org.signal.libsignal.protocol.SignalProtocolAddress;
import org.signal.libsignal.protocol.state.KyberPreKeyRecord;
import org.signal.libsignal.protocol.state.PreKeyRecord;
import org.signal.libsignal.protocol.state.SignedPreKeyRecord;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Comparator;
import java.util.List;

public final class PulseE2eeV2Provider {
    public static final int DEFAULT_PREKEY_COUNT = 20;
    public static final int MAX_PREKEY_COUNT = 100;

    private final PulseE2eeRecordStorage storage;
    private final PulseLibsignalSessionEngine engine;
    private final SecureRandom random;

    public PulseE2eeV2Provider(PulseE2eeRecordStorage storage) {
        this(storage, new PulseLibsignalSessionEngine(), new SecureRandom());
    }

    PulseE2eeV2Provider(
        PulseE2eeRecordStorage storage,
        PulseLibsignalSessionEngine engine,
        SecureRandom random
    ) {
        this.storage = storage;
        this.engine = engine;
        this.random = random;
    }

    public synchronized BootstrapResult bootstrapDevice(
        String userId,
        int signalDeviceId,
        int requestedPreKeyCount
    ) throws Exception {
        int preKeyCount = requirePreKeyCount(requestedPreKeyCount);
        PulseSignalProtocolStore store = openStore(userId, signalDeviceId);
        long now = System.currentTimeMillis();

        List<SignedPreKeyRecord> signedPreKeys = store.loadSignedPreKeys();
        if (signedPreKeys.isEmpty()) {
            int keyId = nextKeyId(store::containsSignedPreKey);
            store.storeSignedPreKey(
                keyId,
                engine.generateSignedPreKey(
                    store.getIdentityKeyPair(),
                    keyId,
                    now
                )
            );
            signedPreKeys = store.loadSignedPreKeys();
        }

        List<KyberPreKeyRecord> kyberPreKeys = store.loadKyberPreKeys();
        if (kyberPreKeys.isEmpty()) {
            int keyId = nextKeyId(store::containsKyberPreKey);
            store.storeKyberPreKey(
                keyId,
                engine.generateKyberPreKey(store.getIdentityKeyPair(), keyId, now)
            );
            kyberPreKeys = store.loadKyberPreKeys();
        }

        List<PreKeyRecord> oneTimePreKeys = store.loadPreKeys();
        while (oneTimePreKeys.size() < preKeyCount) {
            int keyId = nextKeyId(store::containsPreKey);
            store.storePreKey(keyId, engine.generateOneTimePreKey(keyId));
            oneTimePreKeys = store.loadPreKeys();
        }

        signedPreKeys.sort(Comparator.comparingInt(SignedPreKeyRecord::getId));
        kyberPreKeys.sort(Comparator.comparingInt(KyberPreKeyRecord::getId));
        oneTimePreKeys.sort(Comparator.comparingInt(PreKeyRecord::getId));
        return new BootstrapResult(
            signalDeviceId,
            store.getLocalRegistrationId(),
            store.getIdentityKeyPair().getPublicKey().serialize(),
            signedPreKeys.get(signedPreKeys.size() - 1),
            kyberPreKeys.get(kyberPreKeys.size() - 1),
            oneTimePreKeys.subList(0, preKeyCount)
        );
    }

    public synchronized PulseLibsignalSessionEngine.EncryptedEnvelope encryptText(
        String userId,
        int localSignalDeviceId,
        String remoteUserId,
        String remoteDeviceId,
        int remoteSignalDeviceId,
        String plaintext,
        PulseLibsignalSessionEngine.PublicBundle remoteBundle
    ) throws Exception {
        return encryptText(
            userId,
            localSignalDeviceId,
            remoteUserId,
            remoteDeviceId,
            remoteSignalDeviceId,
            1,
            plaintext,
            remoteBundle
        );
    }

    public synchronized PulseLibsignalSessionEngine.EncryptedEnvelope encryptText(
        String userId,
        int localSignalDeviceId,
        String remoteUserId,
        String remoteDeviceId,
        int remoteSignalDeviceId,
        int remoteIdentityVersion,
        String plaintext,
        PulseLibsignalSessionEngine.PublicBundle remoteBundle
    ) throws Exception {
        PulseSignalProtocolStore store = openStore(userId, localSignalDeviceId);
        SignalProtocolAddress local = address(userId, localSignalDeviceId);
        SignalProtocolAddress remote = address(remoteUserId, remoteSignalDeviceId);
        store.bindRemoteDevice(
            remoteUserId,
            remoteDeviceId,
            remoteSignalDeviceId,
            remoteIdentityVersion
        );
        byte[] encoded = engine.utf8(requireText(plaintext, "e2ee_plaintext_required"));
        if (store.containsSession(remote)) {
            return engine.encrypt(store, local, remote, encoded);
        }
        if (remoteBundle == null) throw new IllegalArgumentException("e2ee_remote_bundle_required");
        if (remoteBundle.signalDeviceId != remoteSignalDeviceId) {
            throw new IllegalArgumentException("e2ee_remote_device_id_mismatch");
        }
        return engine.establishAndEncrypt(store, local, remote, remoteBundle, encoded);
    }

    public synchronized String decryptText(
        String userId,
        int localSignalDeviceId,
        String remoteUserId,
        String remoteDeviceId,
        int remoteSignalDeviceId,
        PulseLibsignalSessionEngine.EncryptedEnvelope envelope
    ) throws Exception {
        return decryptText(
            userId,
            localSignalDeviceId,
            remoteUserId,
            remoteDeviceId,
            remoteSignalDeviceId,
            1,
            envelope
        );
    }

    public synchronized String decryptText(
        String userId,
        int localSignalDeviceId,
        String remoteUserId,
        String remoteDeviceId,
        int remoteSignalDeviceId,
        int remoteIdentityVersion,
        PulseLibsignalSessionEngine.EncryptedEnvelope envelope
    ) throws Exception {
        PulseSignalProtocolStore store = openStore(userId, localSignalDeviceId);
        store.bindRemoteDevice(
            remoteUserId,
            remoteDeviceId,
            remoteSignalDeviceId,
            remoteIdentityVersion
        );
        byte[] plaintext = engine.decrypt(
            store,
            address(userId, localSignalDeviceId),
            address(remoteUserId, remoteSignalDeviceId),
            envelope
        );
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(plaintext))
                .toString();
        } catch (CharacterCodingException error) {
            throw new IllegalArgumentException("e2ee_plaintext_utf8_invalid", error);
        }
    }

    public synchronized List<PulseSignalProtocolStore.RemoteDevice> listSessionDevices(
        String userId,
        int localSignalDeviceId,
        String remoteUserId
    ) {
        return openStore(userId, localSignalDeviceId).listSessionDevices(remoteUserId);
    }

    public synchronized void invalidateRemoteDevice(
        String userId,
        int localSignalDeviceId,
        String remoteUserId,
        String remoteDeviceId,
        int remoteSignalDeviceId,
        int remoteIdentityVersion,
        boolean revoked
    ) {
        openStore(userId, localSignalDeviceId).invalidateRemoteDevice(
            remoteUserId,
            remoteDeviceId,
            remoteSignalDeviceId,
            remoteIdentityVersion,
            revoked
        );
    }

    private PulseSignalProtocolStore openStore(String userId, int signalDeviceId) {
        PulseSignalProtocolStore store = PulseSignalProtocolStore.openOrCreate(
            storage,
            requireText(userId, "e2ee_user_id_required")
        );
        store.bindSignalDeviceId(signalDeviceId);
        return store;
    }

    private int nextKeyId(KeyIdLookup lookup) {
        int candidate;
        do {
            candidate = random.nextInt(Integer.MAX_VALUE - 1) + 1;
        } while (lookup.contains(candidate));
        return candidate;
    }

    private static SignalProtocolAddress address(String userId, int signalDeviceId) {
        if (signalDeviceId < 1 || signalDeviceId > 127) {
            throw new IllegalArgumentException("e2ee_signal_device_id_invalid");
        }
        return new SignalProtocolAddress(requireText(userId, "e2ee_remote_user_id_required"), signalDeviceId);
    }

    private static int requirePreKeyCount(int count) {
        if (count < 1 || count > MAX_PREKEY_COUNT) {
            throw new IllegalArgumentException("e2ee_prekey_count_invalid");
        }
        return count;
    }

    private static String requireText(String value, String code) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(code);
        return value;
    }

    private interface KeyIdLookup {
        boolean contains(int keyId);
    }

    public static final class BootstrapResult {
        final int signalDeviceId;
        final int registrationId;
        final byte[] identityKey;
        final SignedPreKeyRecord signedPreKey;
        final KyberPreKeyRecord kyberPreKey;
        final List<PreKeyRecord> oneTimePreKeys;

        BootstrapResult(
            int signalDeviceId,
            int registrationId,
            byte[] identityKey,
            SignedPreKeyRecord signedPreKey,
            KyberPreKeyRecord kyberPreKey,
            List<PreKeyRecord> oneTimePreKeys
        ) {
            this.signalDeviceId = signalDeviceId;
            this.registrationId = registrationId;
            this.identityKey = identityKey.clone();
            this.signedPreKey = signedPreKey;
            this.kyberPreKey = kyberPreKey;
            this.oneTimePreKeys = List.copyOf(oneTimePreKeys);
        }
    }
}
