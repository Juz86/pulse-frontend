package com.pulsemessenger.chat.e2ee.v2;

import org.signal.libsignal.protocol.IdentityKey;
import org.signal.libsignal.protocol.IdentityKeyPair;
import org.signal.libsignal.protocol.SessionBuilder;
import org.signal.libsignal.protocol.SessionCipher;
import org.signal.libsignal.protocol.SignalProtocolAddress;
import org.signal.libsignal.protocol.ecc.ECKeyPair;
import org.signal.libsignal.protocol.ecc.ECPublicKey;
import org.signal.libsignal.protocol.kem.KEMKeyPair;
import org.signal.libsignal.protocol.kem.KEMKeyType;
import org.signal.libsignal.protocol.kem.KEMPublicKey;
import org.signal.libsignal.protocol.message.CiphertextMessage;
import org.signal.libsignal.protocol.message.PreKeySignalMessage;
import org.signal.libsignal.protocol.message.SignalMessage;
import org.signal.libsignal.protocol.state.KyberPreKeyRecord;
import org.signal.libsignal.protocol.state.PreKeyBundle;
import org.signal.libsignal.protocol.state.PreKeyRecord;
import org.signal.libsignal.protocol.state.SignalProtocolStore;
import org.signal.libsignal.protocol.state.SignedPreKeyRecord;

import java.nio.charset.StandardCharsets;

public final class PulseLibsignalSessionEngine {
    public static final int MAX_PLAINTEXT_BYTES = 256 * 1024;

    public KeyMaterial generateKeyMaterial(
        IdentityKeyPair identityKeyPair,
        int signedPreKeyId,
        int oneTimePreKeyId,
        int kyberPreKeyId,
        long timestamp
    ) {
        SignedPreKeyRecord signedPreKey = generateSignedPreKey(
            identityKeyPair,
            signedPreKeyId,
            timestamp
        );
        PreKeyRecord oneTimePreKey = generateOneTimePreKey(oneTimePreKeyId);
        KyberPreKeyRecord kyberPreKey = generateKyberPreKey(
            identityKeyPair,
            kyberPreKeyId,
            timestamp
        );
        return new KeyMaterial(signedPreKey, oneTimePreKey, kyberPreKey);
    }

    public SignedPreKeyRecord generateSignedPreKey(
        IdentityKeyPair identityKeyPair,
        int signedPreKeyId,
        long timestamp
    ) {
        ECKeyPair signedKeyPair = ECKeyPair.generate();
        byte[] signedSignature = identityKeyPair.getPrivateKey()
            .calculateSignature(signedKeyPair.getPublicKey().serialize());
        return new SignedPreKeyRecord(
            signedPreKeyId,
            timestamp,
            signedKeyPair,
            signedSignature
        );
    }

    public PreKeyRecord generateOneTimePreKey(int oneTimePreKeyId) {
        return new PreKeyRecord(oneTimePreKeyId, ECKeyPair.generate());
    }

    public KyberPreKeyRecord generateKyberPreKey(
        IdentityKeyPair identityKeyPair,
        int kyberPreKeyId,
        long timestamp
    ) {
        KEMKeyPair kyberKeyPair = KEMKeyPair.generate(KEMKeyType.KYBER_1024);
        byte[] kyberSignature = identityKeyPair.getPrivateKey()
            .calculateSignature(kyberKeyPair.getPublicKey().serialize());
        return new KyberPreKeyRecord(
            kyberPreKeyId,
            timestamp,
            kyberKeyPair,
            kyberSignature
        );
    }

    public PublicBundle publicBundle(
        int registrationId,
        int signalDeviceId,
        IdentityKey identityKey,
        KeyMaterial material
    ) throws Exception {
        return new PublicBundle(
            registrationId,
            signalDeviceId,
            identityKey.serialize(),
            material.signedPreKey.getId(),
            material.signedPreKey.getKeyPair().getPublicKey().serialize(),
            material.signedPreKey.getSignature(),
            material.oneTimePreKey.getId(),
            material.oneTimePreKey.getKeyPair().getPublicKey().serialize(),
            material.kyberPreKey.getId(),
            material.kyberPreKey.getKeyPair().getPublicKey().serialize(),
            material.kyberPreKey.getSignature()
        );
    }

    public void installKeyMaterial(SignalProtocolStore store, KeyMaterial material) {
        store.storeSignedPreKey(material.signedPreKey.getId(), material.signedPreKey);
        store.storePreKey(material.oneTimePreKey.getId(), material.oneTimePreKey);
        store.storeKyberPreKey(material.kyberPreKey.getId(), material.kyberPreKey);
    }

    public EncryptedEnvelope establishAndEncrypt(
        SignalProtocolStore store,
        SignalProtocolAddress localAddress,
        SignalProtocolAddress remoteAddress,
        PublicBundle remoteBundle,
        byte[] plaintext
    ) throws Exception {
        requirePlaintext(plaintext);
        new SessionBuilder(store, remoteAddress, localAddress).process(remoteBundle.toPreKeyBundle());
        return encrypt(store, localAddress, remoteAddress, plaintext);
    }

    public EncryptedEnvelope encrypt(
        SignalProtocolStore store,
        SignalProtocolAddress localAddress,
        SignalProtocolAddress remoteAddress,
        byte[] plaintext
    ) throws Exception {
        requirePlaintext(plaintext);
        CiphertextMessage message = new SessionCipher(store, localAddress, remoteAddress).encrypt(plaintext);
        String envelopeType = message.getType() == CiphertextMessage.PREKEY_TYPE ? "prekey" : "message";
        return new EncryptedEnvelope(envelopeType, message.serialize());
    }

    public byte[] decrypt(
        SignalProtocolStore store,
        SignalProtocolAddress localAddress,
        SignalProtocolAddress remoteAddress,
        EncryptedEnvelope envelope
    ) throws Exception {
        SessionCipher cipher = new SessionCipher(store, localAddress, remoteAddress);
        if ("prekey".equals(envelope.envelopeType)) {
            return cipher.decrypt(new PreKeySignalMessage(envelope.ciphertext));
        }
        if ("message".equals(envelope.envelopeType)) {
            return cipher.decrypt(new SignalMessage(envelope.ciphertext));
        }
        throw new IllegalArgumentException("e2ee_envelope_type_unsupported");
    }

    public byte[] utf8(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }

    private static void requirePlaintext(byte[] plaintext) {
        if (plaintext == null || plaintext.length == 0 || plaintext.length > MAX_PLAINTEXT_BYTES) {
            throw new IllegalArgumentException("e2ee_plaintext_size_invalid");
        }
    }

    public static final class KeyMaterial {
        final SignedPreKeyRecord signedPreKey;
        final PreKeyRecord oneTimePreKey;
        final KyberPreKeyRecord kyberPreKey;

        KeyMaterial(
            SignedPreKeyRecord signedPreKey,
            PreKeyRecord oneTimePreKey,
            KyberPreKeyRecord kyberPreKey
        ) {
            this.signedPreKey = signedPreKey;
            this.oneTimePreKey = oneTimePreKey;
            this.kyberPreKey = kyberPreKey;
        }
    }

    public static final class PublicBundle {
        final int registrationId;
        final int signalDeviceId;
        final byte[] identityKey;
        final int signedPreKeyId;
        final byte[] signedPreKey;
        final byte[] signedPreKeySignature;
        final int oneTimePreKeyId;
        final byte[] oneTimePreKey;
        final int kyberPreKeyId;
        final byte[] kyberPreKey;
        final byte[] kyberPreKeySignature;

        PublicBundle(
            int registrationId,
            int signalDeviceId,
            byte[] identityKey,
            int signedPreKeyId,
            byte[] signedPreKey,
            byte[] signedPreKeySignature,
            int oneTimePreKeyId,
            byte[] oneTimePreKey,
            int kyberPreKeyId,
            byte[] kyberPreKey,
            byte[] kyberPreKeySignature
        ) {
            this.registrationId = registrationId;
            this.signalDeviceId = signalDeviceId;
            this.identityKey = identityKey.clone();
            this.signedPreKeyId = signedPreKeyId;
            this.signedPreKey = signedPreKey.clone();
            this.signedPreKeySignature = signedPreKeySignature.clone();
            this.oneTimePreKeyId = oneTimePreKeyId;
            this.oneTimePreKey = oneTimePreKey.clone();
            this.kyberPreKeyId = kyberPreKeyId;
            this.kyberPreKey = kyberPreKey.clone();
            this.kyberPreKeySignature = kyberPreKeySignature.clone();
        }

        PreKeyBundle toPreKeyBundle() throws Exception {
            return new PreKeyBundle(
                registrationId,
                signalDeviceId,
                oneTimePreKeyId,
                new ECPublicKey(oneTimePreKey),
                signedPreKeyId,
                new ECPublicKey(signedPreKey),
                signedPreKeySignature,
                new IdentityKey(identityKey),
                kyberPreKeyId,
                new KEMPublicKey(kyberPreKey),
                kyberPreKeySignature
            );
        }
    }

    public static final class EncryptedEnvelope {
        final String envelopeType;
        final byte[] ciphertext;

        EncryptedEnvelope(String envelopeType, byte[] ciphertext) {
            this.envelopeType = envelopeType;
            this.ciphertext = ciphertext.clone();
        }
    }
}
