package com.pulsemessenger.chat.e2ee.v2;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.ProviderException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

public final class PulseE2eeSecureStore implements PulseE2eeRecordStorage {
    static final String PREFERENCES_NAME = "pulse_e2ee_v2_secure";
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "pulse_e2ee_v2_storage_key";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final byte BLOB_VERSION = 1;
    private static final int GCM_TAG_BITS = 128;
    private static final int MAX_RECORD_BYTES = 1024 * 1024;
    private static final Object KEY_LOCK = new Object();

    private final Context context;
    private final SharedPreferences preferences;

    public PulseE2eeSecureStore(Context context) {
        this.context = context.getApplicationContext();
        this.preferences = this.context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    public synchronized Capabilities capabilities() throws GeneralSecurityException {
        SecretKey key = getOrCreateKey();
        if (key.getEncoded() != null) {
            throw new GeneralSecurityException("e2ee_storage_key_exportable");
        }

        boolean hardwareBacked = false;
        boolean strongBoxBacked = false;
        try {
            SecretKeyFactory factory = SecretKeyFactory.getInstance(key.getAlgorithm(), KEYSTORE_PROVIDER);
            KeyInfo keyInfo = (KeyInfo) factory.getKeySpec(key, KeyInfo.class);
            hardwareBacked = keyInfo.isInsideSecureHardware();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                strongBoxBacked = keyInfo.getSecurityLevel() == KeyProperties.SECURITY_LEVEL_STRONGBOX;
            }
        } catch (GeneralSecurityException ignored) {
            // Opslag blijft bruikbaar, maar hardwarebescherming wordt nooit gegokt.
        }
        return new Capabilities(true, hardwareBacked, strongBoxBacked);
    }

    @Override
    public synchronized void put(
        String userId,
        String recordType,
        String recordId,
        byte[] plaintext
    ) throws GeneralSecurityException {
        if (plaintext == null || plaintext.length == 0 || plaintext.length > MAX_RECORD_BYTES) {
            throw new IllegalArgumentException("e2ee_record_size_invalid");
        }
        String preferenceKey = PulseE2eeRecordKey.preferenceKey(userId, recordType, recordId);
        byte[] aad = PulseE2eeRecordKey.associatedData(userId, recordType, recordId);
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        cipher.updateAAD(aad);
        byte[] ciphertext = cipher.doFinal(plaintext);
        byte[] iv = cipher.getIV();
        if (iv == null || iv.length < 12 || iv.length > 32) {
            throw new GeneralSecurityException("e2ee_storage_iv_invalid");
        }

        ByteBuffer blob = ByteBuffer.allocate(2 + iv.length + ciphertext.length);
        blob.put(BLOB_VERSION);
        blob.put((byte) iv.length);
        blob.put(iv);
        blob.put(ciphertext);
        String encoded = Base64.encodeToString(blob.array(), Base64.NO_WRAP);
        if (!preferences.edit().putString(preferenceKey, encoded).commit()) {
            throw new GeneralSecurityException("e2ee_storage_write_failed");
        }
    }

    @Override
    public synchronized byte[] get(
        String userId,
        String recordType,
        String recordId
    ) throws GeneralSecurityException {
        String preferenceKey = PulseE2eeRecordKey.preferenceKey(userId, recordType, recordId);
        String encoded = preferences.getString(preferenceKey, null);
        if (encoded == null) return null;

        byte[] blob;
        try {
            blob = Base64.decode(encoded, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            throw new GeneralSecurityException("e2ee_storage_blob_invalid", error);
        }
        if (blob.length < 2 + 12 + 16) {
            throw new GeneralSecurityException("e2ee_storage_blob_invalid");
        }

        ByteBuffer buffer = ByteBuffer.wrap(blob);
        byte version = buffer.get();
        int ivLength = Byte.toUnsignedInt(buffer.get());
        if (version != BLOB_VERSION || ivLength < 12 || ivLength > 32 || buffer.remaining() <= ivLength) {
            throw new GeneralSecurityException("e2ee_storage_blob_invalid");
        }
        byte[] iv = new byte[ivLength];
        buffer.get(iv);
        byte[] ciphertext = new byte[buffer.remaining()];
        buffer.get(ciphertext);

        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
        cipher.updateAAD(PulseE2eeRecordKey.associatedData(userId, recordType, recordId));
        return cipher.doFinal(ciphertext);
    }

    @Override
    public synchronized boolean remove(String userId, String recordType, String recordId) {
        String preferenceKey = PulseE2eeRecordKey.preferenceKey(userId, recordType, recordId);
        if (!preferences.contains(preferenceKey)) return false;
        return preferences.edit().remove(preferenceKey).commit();
    }

    public synchronized int clearUser(String userId) {
        String prefix = PulseE2eeRecordKey.userPrefix(userId);
        Map<String, ?> records = preferences.getAll();
        List<String> matches = new ArrayList<>();
        for (String key : records.keySet()) {
            if (key.startsWith(prefix)) matches.add(key);
        }
        SharedPreferences.Editor editor = preferences.edit();
        matches.forEach(editor::remove);
        if (!editor.commit()) {
            throw new IllegalStateException("e2ee_storage_clear_failed");
        }
        return matches.size();
    }

    private SecretKey getOrCreateKey() throws GeneralSecurityException {
        synchronized (KEY_LOCK) {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
            try {
                keyStore.load(null);
            } catch (IOException error) {
                throw new GeneralSecurityException("e2ee_keystore_load_failed", error);
            }
            SecretKey existing = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
            if (existing != null) return existing;

            boolean requestStrongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                && context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE);
            if (requestStrongBox) {
                try {
                    return generateKey(true);
                } catch (ProviderException error) {
                    // Het apparaat adverteert StrongBox maar kan tijdelijk geen key maken.
                }
            }
            return generateKey(false);
        }
    }

    private SecretKey generateKey(boolean strongBox) throws GeneralSecurityException {
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setKeySize(256)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setIsStrongBoxBacked(strongBox);
        }
        generator.init(builder.build());
        return generator.generateKey();
    }

    static final class Capabilities {
        final boolean secureStorage;
        final boolean hardwareBacked;
        final boolean strongBoxBacked;

        Capabilities(boolean secureStorage, boolean hardwareBacked, boolean strongBoxBacked) {
            this.secureStorage = secureStorage;
            this.hardwareBacked = hardwareBacked;
            this.strongBoxBacked = strongBoxBacked;
        }
    }
}
