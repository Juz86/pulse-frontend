package com.pulsemessenger.chat.e2ee.v2;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.signal.libsignal.protocol.IdentityKey;
import org.signal.libsignal.protocol.IdentityKeyPair;
import org.signal.libsignal.protocol.InvalidKeyIdException;
import org.signal.libsignal.protocol.InvalidMessageException;
import org.signal.libsignal.protocol.NoSessionException;
import org.signal.libsignal.protocol.ReusedBaseKeyException;
import org.signal.libsignal.protocol.SignalProtocolAddress;
import org.signal.libsignal.protocol.ecc.ECPublicKey;
import org.signal.libsignal.protocol.groups.state.SenderKeyRecord;
import org.signal.libsignal.protocol.state.IdentityKeyStore;
import org.signal.libsignal.protocol.state.KyberPreKeyRecord;
import org.signal.libsignal.protocol.state.PreKeyRecord;
import org.signal.libsignal.protocol.state.SessionRecord;
import org.signal.libsignal.protocol.state.SignalProtocolStore;
import org.signal.libsignal.protocol.state.SignedPreKeyRecord;
import org.signal.libsignal.protocol.util.KeyHelper;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class PulseSignalProtocolStore implements SignalProtocolStore {
    private static final String TYPE_IDENTITY = "signal_identity";
    private static final String TYPE_REMOTE_IDENTITY = "signal_remote_identity";
    private static final String TYPE_REMOTE_DEVICE = "signal_remote_device";
    private static final String TYPE_PREKEY = "signal_prekey";
    private static final String TYPE_SIGNED_PREKEY = "signal_signed_prekey";
    private static final String TYPE_KYBER_PREKEY = "signal_kyber_prekey";
    private static final String TYPE_KYBER_USE = "signal_kyber_use";
    private static final String TYPE_SESSION = "signal_session";
    private static final String TYPE_SENDER_KEY = "signal_sender_key";
    private static final String TYPE_INDEX = "signal_index";
    private static final String TYPE_METADATA = "signal_metadata";
    private static final String LOCAL_STATE = "local_state";
    private static final String SIGNAL_DEVICE_ID = "signal_device_id";
    private static final byte LOCAL_STATE_VERSION = 1;
    private static final String PREKEY_INDEX = "prekeys";
    private static final String SIGNED_INDEX = "signed_prekeys";
    private static final String KYBER_INDEX = "kyber_prekeys";
    private static final String SESSION_INDEX = "sessions";
    private static final String REMOTE_DEVICE_INDEX = "remote_devices";

    private final PulseE2eeRecordStorage storage;
    private final String userId;
    private final IdentityKeyPair identityKeyPair;
    private final int registrationId;

    private PulseSignalProtocolStore(
        PulseE2eeRecordStorage storage,
        String userId,
        IdentityKeyPair identityKeyPair,
        int registrationId
    ) {
        this.storage = storage;
        this.userId = requireText(userId, "e2ee_user_id_required");
        this.identityKeyPair = identityKeyPair;
        this.registrationId = registrationId;
    }

    public static synchronized PulseSignalProtocolStore openOrCreate(
        PulseE2eeRecordStorage storage,
        String userId
    ) {
        try {
            byte[] localState = storage.get(userId, TYPE_IDENTITY, LOCAL_STATE);
            if (localState != null) {
                if (localState.length <= 1 + Integer.BYTES) {
                    throw new PulseE2eeStoreException("e2ee_local_identity_invalid");
                }
                ByteBuffer buffer = ByteBuffer.wrap(localState);
                if (buffer.get() != LOCAL_STATE_VERSION) {
                    throw new PulseE2eeStoreException("e2ee_local_identity_version_unsupported");
                }
                int registrationId = buffer.getInt();
                byte[] identityBytes = new byte[buffer.remaining()];
                buffer.get(identityBytes);
                return new PulseSignalProtocolStore(
                    storage,
                    userId,
                    new IdentityKeyPair(identityBytes),
                    registrationId
                );
            }

            IdentityKeyPair identity = IdentityKeyPair.generate();
            int registrationId = KeyHelper.generateRegistrationId(false);
            byte[] identityBytes = identity.serialize();
            ByteBuffer buffer = ByteBuffer.allocate(1 + Integer.BYTES + identityBytes.length);
            buffer.put(LOCAL_STATE_VERSION);
            buffer.putInt(registrationId);
            buffer.put(identityBytes);
            storage.put(userId, TYPE_IDENTITY, LOCAL_STATE, buffer.array());
            return new PulseSignalProtocolStore(storage, userId, identity, registrationId);
        } catch (GeneralSecurityException | org.signal.libsignal.protocol.InvalidKeyException error) {
            throw failure("e2ee_local_identity_load_failed", error);
        }
    }

    @Override
    public IdentityKeyPair getIdentityKeyPair() {
        return identityKeyPair;
    }

    @Override
    public int getLocalRegistrationId() {
        return registrationId;
    }

    public synchronized int bindSignalDeviceId(int signalDeviceId) {
        if (signalDeviceId < 1 || signalDeviceId > 127) {
            throw new IllegalArgumentException("e2ee_signal_device_id_invalid");
        }
        byte[] stored = get(TYPE_METADATA, SIGNAL_DEVICE_ID);
        if (stored == null) {
            put(TYPE_METADATA, SIGNAL_DEVICE_ID, ByteBuffer.allocate(Integer.BYTES)
                .putInt(signalDeviceId)
                .array());
            return signalDeviceId;
        }
        if (stored.length != Integer.BYTES) {
            throw new PulseE2eeStoreException("e2ee_signal_device_id_corrupt");
        }
        int existing = ByteBuffer.wrap(stored).getInt();
        if (existing != signalDeviceId) {
            throw new IllegalStateException("e2ee_signal_device_id_mismatch");
        }
        return existing;
    }

    public synchronized void bindRemoteDevice(
        String remoteUserId,
        String remoteDeviceId,
        int signalDeviceId
    ) {
        bindRemoteDevice(remoteUserId, remoteDeviceId, signalDeviceId, 1);
    }

    public synchronized void bindRemoteDevice(
        String remoteUserId,
        String remoteDeviceId,
        int signalDeviceId,
        int identityVersion
    ) {
        String user = requireOpaqueId(remoteUserId, "e2ee_remote_user_id_invalid");
        String device = requireOpaqueId(remoteDeviceId, "e2ee_remote_device_id_invalid");
        requireSignalDeviceId(signalDeviceId);
        requireIdentityVersion(identityVersion);

        List<RemoteDevice> devices = loadRemoteDeviceIndex();
        for (int index = 0; index < devices.size(); index++) {
            RemoteDevice current = devices.get(index);
            if (!current.remoteUserId.equals(user)) continue;
            if (current.remoteDeviceId.equals(device)) {
                if (current.revoked) {
                    throw new IllegalStateException("e2ee_remote_device_revoked");
                }
                if (identityVersion < current.identityVersion) {
                    throw new IllegalStateException("e2ee_remote_identity_version_stale");
                }
                if (
                    identityVersion == current.identityVersion
                    && current.signalDeviceId != signalDeviceId
                ) {
                    throw new IllegalStateException("e2ee_remote_device_mapping_mismatch");
                }
                if (identityVersion > current.identityVersion) {
                    assertSignalDeviceIdAvailable(devices, user, device, signalDeviceId);
                    clearRemoteSignalState(user, current.signalDeviceId);
                    devices.set(index, new RemoteDevice(
                        user,
                        device,
                        signalDeviceId,
                        identityVersion,
                        false
                    ));
                    saveRemoteDeviceIndex(devices);
                }
                return;
            }
        }

        assertSignalDeviceIdAvailable(devices, user, device, signalDeviceId);
        devices.add(new RemoteDevice(user, device, signalDeviceId, identityVersion, false));
        saveRemoteDeviceIndex(devices);
    }

    public synchronized void invalidateRemoteDevice(
        String remoteUserId,
        String remoteDeviceId,
        int signalDeviceId,
        int identityVersion,
        boolean revoked
    ) {
        String user = requireOpaqueId(remoteUserId, "e2ee_remote_user_id_invalid");
        String device = requireOpaqueId(remoteDeviceId, "e2ee_remote_device_id_invalid");
        requireSignalDeviceId(signalDeviceId);
        requireIdentityVersion(identityVersion);

        List<RemoteDevice> devices = loadRemoteDeviceIndex();
        for (int index = 0; index < devices.size(); index++) {
            RemoteDevice current = devices.get(index);
            if (!current.remoteUserId.equals(user) || !current.remoteDeviceId.equals(device)) {
                continue;
            }
            if (identityVersion < current.identityVersion) {
                throw new IllegalStateException("e2ee_remote_identity_version_stale");
            }
            if (
                identityVersion == current.identityVersion
                && current.signalDeviceId != signalDeviceId
            ) {
                throw new IllegalStateException("e2ee_remote_device_mapping_mismatch");
            }
            assertSignalDeviceIdAvailable(devices, user, device, signalDeviceId);
            clearRemoteSignalState(user, current.signalDeviceId);
            if (current.signalDeviceId != signalDeviceId) {
                clearRemoteSignalState(user, signalDeviceId);
            }
            devices.set(index, new RemoteDevice(
                user,
                device,
                signalDeviceId,
                identityVersion,
                revoked || current.revoked
            ));
            saveRemoteDeviceIndex(devices);
            return;
        }

        assertSignalDeviceIdAvailable(devices, user, device, signalDeviceId);
        clearRemoteSignalState(user, signalDeviceId);
        devices.add(new RemoteDevice(user, device, signalDeviceId, identityVersion, revoked));
        saveRemoteDeviceIndex(devices);
    }

    public synchronized List<RemoteDevice> listSessionDevices(String remoteUserId) {
        String user = requireOpaqueId(remoteUserId, "e2ee_remote_user_id_invalid");
        List<RemoteDevice> active = new ArrayList<>();
        for (RemoteDevice device : loadRemoteDeviceIndex()) {
            if (
                device.remoteUserId.equals(user)
                && !device.revoked
                && containsSession(new SignalProtocolAddress(user, device.signalDeviceId))
            ) {
                active.add(device);
            }
        }
        active.sort((left, right) -> left.remoteDeviceId.compareTo(right.remoteDeviceId));
        return active;
    }

    @Override
    public synchronized IdentityChange saveIdentity(
        SignalProtocolAddress address,
        IdentityKey identityKey
    ) {
        IdentityKey current = getIdentity(address);
        put(TYPE_REMOTE_IDENTITY, addressId(address), identityKey.serialize());
        return current == null || current.equals(identityKey)
            ? IdentityChange.NEW_OR_UNCHANGED
            : IdentityChange.REPLACED_EXISTING;
    }

    @Override
    public synchronized boolean isTrustedIdentity(
        SignalProtocolAddress address,
        IdentityKey identityKey,
        IdentityKeyStore.Direction direction
    ) {
        IdentityKey current = getIdentity(address);
        return current == null || current.equals(identityKey);
    }

    @Override
    public synchronized IdentityKey getIdentity(SignalProtocolAddress address) {
        byte[] serialized = get(TYPE_REMOTE_IDENTITY, addressId(address));
        if (serialized == null) return null;
        try {
            return new IdentityKey(serialized);
        } catch (org.signal.libsignal.protocol.InvalidKeyException error) {
            throw failure("e2ee_remote_identity_invalid", error);
        }
    }

    @Override
    public synchronized PreKeyRecord loadPreKey(int preKeyId) throws InvalidKeyIdException {
        byte[] serialized = get(TYPE_PREKEY, intId(preKeyId));
        if (serialized == null) throw new InvalidKeyIdException("Missing prekey " + preKeyId);
        try {
            return new PreKeyRecord(serialized);
        } catch (InvalidMessageException error) {
            throw new InvalidKeyIdException(error);
        }
    }

    @Override
    public synchronized void storePreKey(int preKeyId, PreKeyRecord record) {
        put(TYPE_PREKEY, intId(preKeyId), record.serialize());
        addIntegerIndex(PREKEY_INDEX, preKeyId);
    }

    @Override
    public synchronized boolean containsPreKey(int preKeyId) {
        return get(TYPE_PREKEY, intId(preKeyId)) != null;
    }

    @Override
    public synchronized void removePreKey(int preKeyId) {
        storage.remove(userId, TYPE_PREKEY, intId(preKeyId));
        removeIntegerIndex(PREKEY_INDEX, preKeyId);
    }

    synchronized List<PreKeyRecord> loadPreKeys() {
        List<PreKeyRecord> records = new ArrayList<>();
        for (int keyId : loadIntegerIndex(PREKEY_INDEX)) {
            try {
                records.add(loadPreKey(keyId));
            } catch (InvalidKeyIdException error) {
                throw failure("e2ee_prekey_index_invalid", error);
            }
        }
        return records;
    }

    @Override
    public synchronized SignedPreKeyRecord loadSignedPreKey(int signedPreKeyId)
        throws InvalidKeyIdException {
        byte[] serialized = get(TYPE_SIGNED_PREKEY, intId(signedPreKeyId));
        if (serialized == null) {
            throw new InvalidKeyIdException("Missing signed prekey " + signedPreKeyId);
        }
        try {
            return new SignedPreKeyRecord(serialized);
        } catch (InvalidMessageException error) {
            throw new InvalidKeyIdException(error);
        }
    }

    @Override
    public synchronized List<SignedPreKeyRecord> loadSignedPreKeys() {
        List<SignedPreKeyRecord> records = new ArrayList<>();
        for (int keyId : loadIntegerIndex(SIGNED_INDEX)) {
            try {
                records.add(loadSignedPreKey(keyId));
            } catch (InvalidKeyIdException error) {
                throw failure("e2ee_signed_prekey_index_invalid", error);
            }
        }
        return records;
    }

    @Override
    public synchronized void storeSignedPreKey(int signedPreKeyId, SignedPreKeyRecord record) {
        put(TYPE_SIGNED_PREKEY, intId(signedPreKeyId), record.serialize());
        addIntegerIndex(SIGNED_INDEX, signedPreKeyId);
    }

    @Override
    public synchronized boolean containsSignedPreKey(int signedPreKeyId) {
        return get(TYPE_SIGNED_PREKEY, intId(signedPreKeyId)) != null;
    }

    @Override
    public synchronized void removeSignedPreKey(int signedPreKeyId) {
        storage.remove(userId, TYPE_SIGNED_PREKEY, intId(signedPreKeyId));
        removeIntegerIndex(SIGNED_INDEX, signedPreKeyId);
    }

    @Override
    public synchronized KyberPreKeyRecord loadKyberPreKey(int kyberPreKeyId)
        throws InvalidKeyIdException {
        byte[] serialized = get(TYPE_KYBER_PREKEY, intId(kyberPreKeyId));
        if (serialized == null) {
            throw new InvalidKeyIdException("Missing Kyber prekey " + kyberPreKeyId);
        }
        try {
            return new KyberPreKeyRecord(serialized);
        } catch (InvalidMessageException error) {
            throw new InvalidKeyIdException(error);
        }
    }

    @Override
    public synchronized List<KyberPreKeyRecord> loadKyberPreKeys() {
        List<KyberPreKeyRecord> records = new ArrayList<>();
        for (int keyId : loadIntegerIndex(KYBER_INDEX)) {
            try {
                records.add(loadKyberPreKey(keyId));
            } catch (InvalidKeyIdException error) {
                throw failure("e2ee_kyber_prekey_index_invalid", error);
            }
        }
        return records;
    }

    @Override
    public synchronized void storeKyberPreKey(int kyberPreKeyId, KyberPreKeyRecord record) {
        put(TYPE_KYBER_PREKEY, intId(kyberPreKeyId), record.serialize());
        addIntegerIndex(KYBER_INDEX, kyberPreKeyId);
    }

    @Override
    public synchronized boolean containsKyberPreKey(int kyberPreKeyId) {
        return get(TYPE_KYBER_PREKEY, intId(kyberPreKeyId)) != null;
    }

    @Override
    public synchronized void markKyberPreKeyUsed(
        int kyberPreKeyId,
        int signedPreKeyId,
        ECPublicKey baseKey
    ) throws ReusedBaseKeyException {
        String useId = kyberPreKeyId + ":" + signedPreKeyId + ":" + sha256(baseKey.serialize());
        if (get(TYPE_KYBER_USE, useId) != null) throw new ReusedBaseKeyException();
        put(TYPE_KYBER_USE, useId, new byte[] { 1 });
    }

    @Override
    public synchronized SessionRecord loadSession(SignalProtocolAddress address) {
        byte[] serialized = get(TYPE_SESSION, addressId(address));
        if (serialized == null) return null;
        try {
            return new SessionRecord(serialized);
        } catch (InvalidMessageException error) {
            throw failure("e2ee_session_record_invalid", error);
        }
    }

    @Override
    public synchronized List<SessionRecord> loadExistingSessions(
        List<SignalProtocolAddress> addresses
    ) throws NoSessionException {
        List<SessionRecord> records = new ArrayList<>();
        for (SignalProtocolAddress address : addresses) {
            SessionRecord record = loadSession(address);
            if (record == null) throw new NoSessionException(address, "Session not found");
            records.add(record);
        }
        return records;
    }

    @Override
    public synchronized List<Integer> getSubDeviceSessions(String name) {
        List<Integer> deviceIds = new ArrayList<>();
        for (SignalProtocolAddress address : loadSessionIndex()) {
            if (name.equals(address.getName()) && address.getDeviceId() != 1) {
                deviceIds.add(address.getDeviceId());
            }
        }
        return deviceIds;
    }

    @Override
    public synchronized void storeSession(SignalProtocolAddress address, SessionRecord record) {
        put(TYPE_SESSION, addressId(address), record.serialize());
        List<SignalProtocolAddress> addresses = loadSessionIndex();
        if (!addresses.contains(address)) {
            addresses.add(address);
            saveSessionIndex(addresses);
        }
    }

    @Override
    public synchronized boolean containsSession(SignalProtocolAddress address) {
        return get(TYPE_SESSION, addressId(address)) != null;
    }

    @Override
    public synchronized void deleteSession(SignalProtocolAddress address) {
        storage.remove(userId, TYPE_SESSION, addressId(address));
        List<SignalProtocolAddress> addresses = loadSessionIndex();
        if (addresses.remove(address)) saveSessionIndex(addresses);
    }

    @Override
    public synchronized void deleteAllSessions(String name) {
        List<SignalProtocolAddress> addresses = loadSessionIndex();
        List<SignalProtocolAddress> remaining = new ArrayList<>();
        for (SignalProtocolAddress address : addresses) {
            if (name.equals(address.getName())) {
                storage.remove(userId, TYPE_SESSION, addressId(address));
            } else {
                remaining.add(address);
            }
        }
        saveSessionIndex(remaining);
    }

    @Override
    public synchronized void storeSenderKey(
        SignalProtocolAddress sender,
        UUID distributionId,
        SenderKeyRecord record
    ) {
        put(TYPE_SENDER_KEY, addressId(sender) + ":" + distributionId, record.serialize());
    }

    @Override
    public synchronized SenderKeyRecord loadSenderKey(
        SignalProtocolAddress sender,
        UUID distributionId
    ) {
        byte[] serialized = get(TYPE_SENDER_KEY, addressId(sender) + ":" + distributionId);
        if (serialized == null) return null;
        try {
            return new SenderKeyRecord(serialized);
        } catch (InvalidMessageException error) {
            throw failure("e2ee_sender_key_invalid", error);
        }
    }

    public synchronized void deleteSenderKey(
        SignalProtocolAddress sender,
        UUID distributionId
    ) {
        storage.remove(userId, TYPE_SENDER_KEY, addressId(sender) + ":" + distributionId);
    }

    private Set<Integer> loadIntegerIndex(String indexId) {
        byte[] serialized = get(TYPE_INDEX, indexId);
        Set<Integer> ids = new HashSet<>();
        if (serialized == null) return ids;
        try {
            JSONArray array = new JSONArray(new String(serialized, StandardCharsets.UTF_8));
            for (int index = 0; index < array.length(); index++) ids.add(array.getInt(index));
            return ids;
        } catch (JSONException error) {
            throw failure("e2ee_index_invalid", error);
        }
    }

    private void addIntegerIndex(String indexId, int keyId) {
        Set<Integer> ids = loadIntegerIndex(indexId);
        if (ids.add(keyId)) saveIntegerIndex(indexId, ids);
    }

    private void removeIntegerIndex(String indexId, int keyId) {
        Set<Integer> ids = loadIntegerIndex(indexId);
        if (ids.remove(keyId)) saveIntegerIndex(indexId, ids);
    }

    private void saveIntegerIndex(String indexId, Set<Integer> ids) {
        JSONArray array = new JSONArray();
        ids.stream().sorted().forEach(array::put);
        put(TYPE_INDEX, indexId, array.toString().getBytes(StandardCharsets.UTF_8));
    }

    private List<SignalProtocolAddress> loadSessionIndex() {
        byte[] serialized = get(TYPE_INDEX, SESSION_INDEX);
        List<SignalProtocolAddress> addresses = new ArrayList<>();
        if (serialized == null) return addresses;
        try {
            JSONArray array = new JSONArray(new String(serialized, StandardCharsets.UTF_8));
            for (int index = 0; index < array.length(); index++) {
                JSONObject value = array.getJSONObject(index);
                addresses.add(new SignalProtocolAddress(value.getString("name"), value.getInt("deviceId")));
            }
            return addresses;
        } catch (JSONException error) {
            throw failure("e2ee_session_index_invalid", error);
        }
    }

    private void saveSessionIndex(List<SignalProtocolAddress> addresses) {
        JSONArray array = new JSONArray();
        addresses.stream()
            .sorted((left, right) -> addressId(left).compareTo(addressId(right)))
            .forEach((address) -> {
                JSONObject value = new JSONObject();
                try {
                    value.put("name", address.getName());
                    value.put("deviceId", address.getDeviceId());
                } catch (JSONException error) {
                    throw failure("e2ee_session_index_write_failed", error);
                }
                array.put(value);
            });
        put(TYPE_INDEX, SESSION_INDEX, array.toString().getBytes(StandardCharsets.UTF_8));
    }

    private List<RemoteDevice> loadRemoteDeviceIndex() {
        byte[] serialized = get(TYPE_INDEX, REMOTE_DEVICE_INDEX);
        List<RemoteDevice> devices = new ArrayList<>();
        if (serialized == null) return devices;
        try {
            JSONArray array = new JSONArray(new String(serialized, StandardCharsets.UTF_8));
            for (int index = 0; index < array.length(); index++) {
                JSONObject value = array.getJSONObject(index);
                devices.add(new RemoteDevice(
                    value.getString("remoteUserId"),
                    value.getString("remoteDeviceId"),
                    value.getInt("signalDeviceId"),
                    value.optInt("identityVersion", 1),
                    value.optBoolean("revoked", false)
                ));
            }
            return devices;
        } catch (JSONException | IllegalArgumentException error) {
            throw failure("e2ee_remote_device_index_invalid", error);
        }
    }

    private void saveRemoteDeviceIndex(List<RemoteDevice> devices) {
        JSONArray array = new JSONArray();
        devices.stream()
            .sorted((left, right) -> (
                left.remoteUserId + "\u0000" + left.remoteDeviceId
            ).compareTo(right.remoteUserId + "\u0000" + right.remoteDeviceId))
            .forEach((device) -> {
                JSONObject value = new JSONObject();
                try {
                    value.put("remoteUserId", device.remoteUserId);
                    value.put("remoteDeviceId", device.remoteDeviceId);
                    value.put("signalDeviceId", device.signalDeviceId);
                    value.put("identityVersion", device.identityVersion);
                    value.put("revoked", device.revoked);
                } catch (JSONException error) {
                    throw failure("e2ee_remote_device_index_write_failed", error);
                }
                array.put(value);
            });
        put(TYPE_INDEX, REMOTE_DEVICE_INDEX, array.toString().getBytes(StandardCharsets.UTF_8));
    }

    private byte[] get(String type, String id) {
        try {
            return storage.get(userId, type, id);
        } catch (GeneralSecurityException error) {
            throw failure("e2ee_store_read_failed", error);
        }
    }

    private void put(String type, String id, byte[] value) {
        try {
            storage.put(userId, type, id, value);
        } catch (GeneralSecurityException error) {
            throw failure("e2ee_store_write_failed", error);
        }
    }

    private static String intId(int value) {
        return Integer.toString(value);
    }

    private static String addressId(SignalProtocolAddress address) {
        return address.getName() + ":" + address.getDeviceId();
    }

    private static String sha256(byte[] value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value);
            StringBuilder encoded = new StringBuilder(digest.length * 2);
            for (byte item : digest) encoded.append(String.format("%02x", item));
            return encoded.toString();
        } catch (GeneralSecurityException error) {
            throw failure("e2ee_hash_unavailable", error);
        }
    }

    private static String requireText(String value, String code) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(code);
        return value;
    }

    private static String requireOpaqueId(String value, String code) {
        String normalized = requireText(value, code);
        if (
            normalized.length() > 128
            || !normalized.matches("[A-Za-z0-9][A-Za-z0-9._:-]*")
        ) {
            throw new IllegalArgumentException(code);
        }
        return normalized;
    }

    private static void requireSignalDeviceId(int signalDeviceId) {
        if (signalDeviceId < 1 || signalDeviceId > 127) {
            throw new IllegalArgumentException("e2ee_remote_signal_device_id_invalid");
        }
    }

    private static void requireIdentityVersion(int identityVersion) {
        if (identityVersion < 1) {
            throw new IllegalArgumentException("e2ee_remote_identity_version_invalid");
        }
    }

    private static void assertSignalDeviceIdAvailable(
        List<RemoteDevice> devices,
        String remoteUserId,
        String remoteDeviceId,
        int signalDeviceId
    ) {
        for (RemoteDevice current : devices) {
            if (
                current.remoteUserId.equals(remoteUserId)
                && !current.remoteDeviceId.equals(remoteDeviceId)
                && current.signalDeviceId == signalDeviceId
            ) {
                throw new IllegalStateException("e2ee_remote_signal_device_id_conflict");
            }
        }
    }

    private void clearRemoteSignalState(String remoteUserId, int signalDeviceId) {
        SignalProtocolAddress address = new SignalProtocolAddress(remoteUserId, signalDeviceId);
        deleteSession(address);
        storage.remove(userId, TYPE_REMOTE_IDENTITY, addressId(address));
    }

    private static PulseE2eeStoreException failure(String code, Throwable error) {
        return new PulseE2eeStoreException(code, error);
    }

    static final class PulseE2eeStoreException extends IllegalStateException {
        PulseE2eeStoreException(String message) {
            super(message);
        }

        PulseE2eeStoreException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public static final class RemoteDevice {
        public final String remoteUserId;
        public final String remoteDeviceId;
        public final int signalDeviceId;
        public final int identityVersion;
        public final boolean revoked;

        RemoteDevice(String remoteUserId, String remoteDeviceId, int signalDeviceId) {
            this(remoteUserId, remoteDeviceId, signalDeviceId, 1, false);
        }

        RemoteDevice(
            String remoteUserId,
            String remoteDeviceId,
            int signalDeviceId,
            int identityVersion,
            boolean revoked
        ) {
            this.remoteUserId = requireOpaqueId(remoteUserId, "e2ee_remote_user_id_invalid");
            this.remoteDeviceId = requireOpaqueId(remoteDeviceId, "e2ee_remote_device_id_invalid");
            requireSignalDeviceId(signalDeviceId);
            requireIdentityVersion(identityVersion);
            this.signalDeviceId = signalDeviceId;
            this.identityVersion = identityVersion;
            this.revoked = revoked;
        }
    }
}
