package com.pulsemessenger.chat.e2ee.v2;

import org.signal.libsignal.protocol.SignalProtocolAddress;
import org.signal.libsignal.protocol.IdentityKey;
import org.signal.libsignal.protocol.state.KyberPreKeyRecord;
import org.signal.libsignal.protocol.state.PreKeyRecord;
import org.signal.libsignal.protocol.state.SignedPreKeyRecord;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.json.JSONException;
import org.json.JSONObject;

public final class PulseE2eeV2Provider {
    public static final int DEFAULT_PREKEY_COUNT = 20;
    public static final int MAX_PREKEY_COUNT = 100;
    private static final String TYPE_GROUP_SENDER_CONTEXT = "group_sender_context";
    private static final String TYPE_LOCAL_DEVICE_BINDING = "local_device_binding";
    private static final String LOCAL_DEVICE_BINDING_ID = "current";

    private final PulseE2eeRecordStorage storage;
    private final PulseLibsignalSessionEngine engine;
    private final PulseLibsignalGroupEngine groupEngine;
    private final SecureRandom random;

    public PulseE2eeV2Provider(PulseE2eeRecordStorage storage) {
        this(
            storage,
            new PulseLibsignalSessionEngine(),
            new PulseLibsignalGroupEngine(),
            new SecureRandom()
        );
    }

    PulseE2eeV2Provider(
        PulseE2eeRecordStorage storage,
        PulseLibsignalSessionEngine engine,
        SecureRandom random
    ) {
        this(storage, engine, new PulseLibsignalGroupEngine(), random);
    }

    PulseE2eeV2Provider(
        PulseE2eeRecordStorage storage,
        PulseLibsignalSessionEngine engine,
        PulseLibsignalGroupEngine groupEngine,
        SecureRandom random
    ) {
        this.storage = storage;
        this.engine = engine;
        this.groupEngine = groupEngine;
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

    public synchronized byte[] createGroupSenderKeyDistribution(
        String userId,
        int localSignalDeviceId,
        String groupId,
        int epoch,
        String distributionId
    ) throws Exception {
        requireGroupContext(groupId, epoch);
        PulseSignalProtocolStore store = openStore(userId, localSignalDeviceId);
        UUID parsedDistributionId = requireDistributionId(distributionId);
        bindGroupSenderContext(
            userId,
            groupId,
            epoch,
            parsedDistributionId,
            userId,
            localSignalDeviceId
        );
        return groupEngine.createDistribution(
            store,
            address(userId, localSignalDeviceId),
            parsedDistributionId
        );
    }

    public synchronized void processGroupSenderKeyDistribution(
        String userId,
        int localSignalDeviceId,
        String senderUserId,
        int senderSignalDeviceId,
        String groupId,
        int epoch,
        String distributionId,
        byte[] distribution
    ) throws Exception {
        requireGroupContext(groupId, epoch);
        PulseSignalProtocolStore store = openStore(userId, localSignalDeviceId);
        UUID parsedDistributionId = requireDistributionId(distributionId);
        bindGroupSenderContext(
            userId,
            groupId,
            epoch,
            parsedDistributionId,
            senderUserId,
            senderSignalDeviceId
        );
        groupEngine.processDistribution(
            store,
            address(senderUserId, senderSignalDeviceId),
            parsedDistributionId,
            distribution
        );
    }

    public synchronized GroupCiphertext encryptGroupText(
        String userId,
        int localSignalDeviceId,
        String groupId,
        int epoch,
        String distributionId,
        String plaintext
    ) throws Exception {
        requireGroupContext(groupId, epoch);
        String text = requireText(plaintext, "e2ee_plaintext_required");
        PulseSignalProtocolStore store = openStore(userId, localSignalDeviceId);
        UUID parsedDistributionId = requireDistributionId(distributionId);
        requireGroupSenderContext(
            userId,
            groupId,
            epoch,
            parsedDistributionId,
            userId,
            localSignalDeviceId
        );
        byte[] ciphertext = groupEngine.encrypt(
            store,
            address(userId, localSignalDeviceId),
            parsedDistributionId,
            encodeGroupPayload(groupId, epoch, text)
        );
        return new GroupCiphertext(distributionId, epoch, ciphertext);
    }

    public synchronized String decryptGroupText(
        String userId,
        int localSignalDeviceId,
        String senderUserId,
        int senderSignalDeviceId,
        String groupId,
        int epoch,
        String distributionId,
        byte[] ciphertext
    ) throws Exception {
        requireGroupContext(groupId, epoch);
        PulseSignalProtocolStore store = openStore(userId, localSignalDeviceId);
        UUID parsedDistributionId = requireDistributionId(distributionId);
        requireGroupSenderContext(
            userId,
            groupId,
            epoch,
            parsedDistributionId,
            senderUserId,
            senderSignalDeviceId
        );
        byte[] plaintext = groupEngine.decrypt(
            store,
            address(senderUserId, senderSignalDeviceId),
            parsedDistributionId,
            ciphertext
        );
        return decodeGroupPayload(groupId, epoch, plaintext);
    }

    public synchronized void invalidateGroupSenderKey(
        String userId,
        int localSignalDeviceId,
        String senderUserId,
        int senderSignalDeviceId,
        String distributionId
    ) throws Exception {
        UUID parsedDistributionId = requireDistributionId(distributionId);
        openStore(userId, localSignalDeviceId).deleteSenderKey(
            address(senderUserId, senderSignalDeviceId),
            parsedDistributionId
        );
        storage.remove(userId, TYPE_GROUP_SENDER_CONTEXT, parsedDistributionId.toString());
    }

    public synchronized byte[] signCallIdentityBinding(
        String userId,
        int localSignalDeviceId,
        PulseCallIdentityBinding binding
    ) {
        PulseSignalProtocolStore store = openStore(userId, localSignalDeviceId);
        if (!userId.equals(binding.callerUserId) && !userId.equals(binding.calleeUserId)) {
            throw new IllegalArgumentException("e2ee_call_signer_not_participant");
        }
        if (localSignalDeviceId != binding.senderSignalDeviceId) {
            throw new IllegalArgumentException("e2ee_call_signer_device_mismatch");
        }
        return store.getIdentityKeyPair().getPrivateKey()
            .calculateSignature(binding.canonicalBytes());
    }

    public synchronized LocalDeviceBinding bindLocalDeviceRegistration(
        String userId,
        String deviceId,
        int signalDeviceId,
        int identityVersion
    ) throws Exception {
        requireText(deviceId, "e2ee_device_id_required");
        if (identityVersion < 1) {
            throw new IllegalArgumentException("e2ee_identity_version_invalid");
        }
        openStore(userId, signalDeviceId);
        JSONObject value = new JSONObject();
        value.put("deviceId", deviceId);
        value.put("signalDeviceId", signalDeviceId);
        value.put("identityVersion", identityVersion);
        storage.put(
            userId,
            TYPE_LOCAL_DEVICE_BINDING,
            LOCAL_DEVICE_BINDING_ID,
            value.toString().getBytes(StandardCharsets.UTF_8)
        );
        return new LocalDeviceBinding(deviceId, signalDeviceId, identityVersion);
    }

    public synchronized LocalDeviceBinding getLocalDeviceBinding(String userId) throws Exception {
        byte[] encoded = storage.get(
            requireText(userId, "e2ee_user_id_required"),
            TYPE_LOCAL_DEVICE_BINDING,
            LOCAL_DEVICE_BINDING_ID
        );
        if (encoded == null) throw new IllegalStateException("e2ee_local_device_binding_missing");
        JSONObject value = new JSONObject(decodeUtf8(encoded, "e2ee_local_device_binding_invalid"));
        LocalDeviceBinding binding = new LocalDeviceBinding(
            requireText(value.optString("deviceId"), "e2ee_device_id_required"),
            value.optInt("signalDeviceId", 0),
            value.optInt("identityVersion", 0)
        );
        openStore(userId, binding.signalDeviceId);
        return binding;
    }

    public synchronized byte[] getLocalIdentityKey(String userId, int signalDeviceId) {
        return openStore(userId, signalDeviceId)
            .getIdentityKeyPair()
            .getPublicKey()
            .serialize();
    }

    public synchronized void verifyCallIdentityBinding(
        String userId,
        int localSignalDeviceId,
        String remoteUserId,
        String remoteDeviceId,
        int remoteSignalDeviceId,
        int remoteIdentityVersion,
        byte[] remoteIdentityKey,
        PulseCallIdentityBinding binding,
        byte[] signature
    ) throws Exception {
        PulseSignalProtocolStore store = openStore(userId, localSignalDeviceId);
        if (!remoteUserId.equals(binding.callerUserId) && !remoteUserId.equals(binding.calleeUserId)) {
            throw new IllegalArgumentException("e2ee_call_signer_not_participant");
        }
        if (remoteSignalDeviceId != binding.senderSignalDeviceId) {
            throw new IllegalArgumentException("e2ee_call_signer_device_mismatch");
        }
        if (!remoteDeviceId.equals(binding.senderDeviceId)) {
            throw new IllegalArgumentException("e2ee_call_signer_device_mismatch");
        }
        if (remoteIdentityVersion != binding.senderIdentityVersion) {
            throw new IllegalArgumentException("e2ee_call_identity_version_mismatch");
        }
        store.bindRemoteDevice(
            remoteUserId,
            remoteDeviceId,
            remoteSignalDeviceId,
            remoteIdentityVersion
        );
        SignalProtocolAddress remoteAddress = address(remoteUserId, remoteSignalDeviceId);
        IdentityKey trustedIdentity = store.getIdentity(remoteAddress);
        if (trustedIdentity == null) {
            throw new IllegalStateException("e2ee_call_identity_untrusted");
        }
        IdentityKey suppliedIdentity = new IdentityKey(remoteIdentityKey);
        if (!MessageDigest.isEqual(trustedIdentity.serialize(), suppliedIdentity.serialize())) {
            throw new IllegalStateException("e2ee_call_identity_mismatch");
        }
        if (!suppliedIdentity.getPublicKey().verifySignature(binding.canonicalBytes(), signature)) {
            throw new IllegalArgumentException("e2ee_call_signature_invalid");
        }
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

    private static void requireGroupContext(String groupId, int epoch) {
        requireText(groupId, "e2ee_group_id_required");
        if (epoch < 1) throw new IllegalArgumentException("e2ee_group_epoch_invalid");
    }

    private static UUID requireDistributionId(String value) {
        try {
            return UUID.fromString(requireText(value, "e2ee_group_distribution_id_required"));
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("e2ee_group_distribution_id_invalid", error);
        }
    }

    private static byte[] encodeGroupPayload(String groupId, int epoch, String plaintext) {
        try {
            JSONObject value = new JSONObject();
            value.put("version", 1);
            value.put("groupId", groupId);
            value.put("epoch", epoch);
            value.put("messageType", "text");
            value.put("text", plaintext);
            return value.toString().getBytes(StandardCharsets.UTF_8);
        } catch (JSONException error) {
            throw new IllegalArgumentException("e2ee_group_payload_invalid", error);
        }
    }

    private void bindGroupSenderContext(
        String userId,
        String groupId,
        int epoch,
        UUID distributionId,
        String senderUserId,
        int senderSignalDeviceId
    ) throws Exception {
        JSONObject expected = groupSenderContext(
            groupId,
            epoch,
            senderUserId,
            senderSignalDeviceId
        );
        byte[] stored = storage.get(
            userId,
            TYPE_GROUP_SENDER_CONTEXT,
            distributionId.toString()
        );
        if (stored != null) {
            requireMatchingGroupSenderContext(expected, stored);
            return;
        }
        storage.put(
            userId,
            TYPE_GROUP_SENDER_CONTEXT,
            distributionId.toString(),
            expected.toString().getBytes(StandardCharsets.UTF_8)
        );
    }

    private void requireGroupSenderContext(
        String userId,
        String groupId,
        int epoch,
        UUID distributionId,
        String senderUserId,
        int senderSignalDeviceId
    ) throws Exception {
        byte[] stored = storage.get(
            userId,
            TYPE_GROUP_SENDER_CONTEXT,
            distributionId.toString()
        );
        if (stored == null) {
            throw new IllegalStateException("e2ee_group_sender_context_missing");
        }
        requireMatchingGroupSenderContext(
            groupSenderContext(groupId, epoch, senderUserId, senderSignalDeviceId),
            stored
        );
    }

    private static JSONObject groupSenderContext(
        String groupId,
        int epoch,
        String senderUserId,
        int senderSignalDeviceId
    ) throws JSONException {
        JSONObject value = new JSONObject();
        value.put("groupId", groupId);
        value.put("epoch", epoch);
        value.put("senderUserId", requireText(senderUserId, "e2ee_sender_user_id_required"));
        value.put("senderSignalDeviceId", senderSignalDeviceId);
        return value;
    }

    private static void requireMatchingGroupSenderContext(JSONObject expected, byte[] stored) {
        try {
            JSONObject actual = new JSONObject(new String(stored, StandardCharsets.UTF_8));
            if (
                !expected.getString("groupId").equals(actual.getString("groupId"))
                || expected.getInt("epoch") != actual.getInt("epoch")
                || !expected.getString("senderUserId").equals(actual.getString("senderUserId"))
                || expected.getInt("senderSignalDeviceId")
                    != actual.getInt("senderSignalDeviceId")
            ) {
                throw new IllegalStateException("e2ee_group_sender_context_mismatch");
            }
        } catch (JSONException error) {
            throw new IllegalStateException("e2ee_group_sender_context_invalid", error);
        }
    }

    private static String decodeGroupPayload(
        String expectedGroupId,
        int expectedEpoch,
        byte[] encoded
    ) {
        try {
            String json = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(encoded))
                .toString();
            JSONObject value = new JSONObject(json);
            if (value.getInt("version") != 1) {
                throw new IllegalArgumentException("e2ee_group_payload_version_invalid");
            }
            if (!expectedGroupId.equals(value.getString("groupId"))) {
                throw new IllegalArgumentException("e2ee_group_id_mismatch");
            }
            if (expectedEpoch != value.getInt("epoch")) {
                throw new IllegalArgumentException("e2ee_group_epoch_mismatch");
            }
            if (!"text".equals(value.getString("messageType"))) {
                throw new IllegalArgumentException("e2ee_group_message_type_invalid");
            }
            return requireText(value.getString("text"), "e2ee_plaintext_required");
        } catch (CharacterCodingException | JSONException error) {
            throw new IllegalArgumentException("e2ee_group_payload_invalid", error);
        }
    }

    private static String decodeUtf8(byte[] encoded, String code) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(encoded))
                .toString();
        } catch (CharacterCodingException error) {
            throw new IllegalStateException(code, error);
        }
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

    public static final class GroupCiphertext {
        final String distributionId;
        final int epoch;
        final byte[] ciphertext;

        GroupCiphertext(String distributionId, int epoch, byte[] ciphertext) {
            this.distributionId = distributionId;
            this.epoch = epoch;
            this.ciphertext = ciphertext.clone();
        }
    }

    public static final class LocalDeviceBinding {
        public final String deviceId;
        public final int signalDeviceId;
        public final int identityVersion;

        LocalDeviceBinding(String deviceId, int signalDeviceId, int identityVersion) {
            this.deviceId = requireText(deviceId, "e2ee_device_id_required");
            if (signalDeviceId < 1 || signalDeviceId > 127) {
                throw new IllegalArgumentException("e2ee_signal_device_id_invalid");
            }
            if (identityVersion < 1) {
                throw new IllegalArgumentException("e2ee_identity_version_invalid");
            }
            this.signalDeviceId = signalDeviceId;
            this.identityVersion = identityVersion;
        }
    }
}
