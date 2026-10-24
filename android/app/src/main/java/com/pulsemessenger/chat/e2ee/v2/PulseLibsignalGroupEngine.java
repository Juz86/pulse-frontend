package com.pulsemessenger.chat.e2ee.v2;

import org.signal.libsignal.protocol.SignalProtocolAddress;
import org.signal.libsignal.protocol.groups.GroupCipher;
import org.signal.libsignal.protocol.groups.GroupSessionBuilder;
import org.signal.libsignal.protocol.groups.state.SenderKeyStore;
import org.signal.libsignal.protocol.message.CiphertextMessage;
import org.signal.libsignal.protocol.message.SenderKeyDistributionMessage;
import org.signal.libsignal.protocol.message.SenderKeyMessage;

import java.util.UUID;

public final class PulseLibsignalGroupEngine {
    public byte[] createDistribution(
        SenderKeyStore store,
        SignalProtocolAddress localAddress,
        UUID distributionId
    ) {
        return new GroupSessionBuilder(store).create(localAddress, distributionId).serialize();
    }

    public void processDistribution(
        SenderKeyStore store,
        SignalProtocolAddress senderAddress,
        UUID expectedDistributionId,
        byte[] serialized
    ) throws Exception {
        requireCiphertext(serialized);
        SenderKeyDistributionMessage message = new SenderKeyDistributionMessage(serialized);
        if (!expectedDistributionId.equals(message.getDistributionId())) {
            throw new IllegalArgumentException("e2ee_group_distribution_id_mismatch");
        }
        new GroupSessionBuilder(store).process(senderAddress, message);
    }

    public byte[] encrypt(
        SenderKeyStore store,
        SignalProtocolAddress localAddress,
        UUID distributionId,
        byte[] plaintext
    ) throws Exception {
        requirePlaintext(plaintext);
        CiphertextMessage message = new GroupCipher(store, localAddress)
            .encrypt(distributionId, plaintext);
        if (message.getType() != CiphertextMessage.SENDERKEY_TYPE) {
            throw new IllegalStateException("e2ee_group_ciphertext_type_invalid");
        }
        return message.serialize();
    }

    public byte[] decrypt(
        SenderKeyStore store,
        SignalProtocolAddress senderAddress,
        UUID expectedDistributionId,
        byte[] ciphertext
    ) throws Exception {
        requireCiphertext(ciphertext);
        SenderKeyMessage message = new SenderKeyMessage(ciphertext);
        if (!expectedDistributionId.equals(message.getDistributionId())) {
            throw new IllegalArgumentException("e2ee_group_distribution_id_mismatch");
        }
        return new GroupCipher(store, senderAddress).decrypt(ciphertext);
    }

    private static void requirePlaintext(byte[] plaintext) {
        if (
            plaintext == null
            || plaintext.length == 0
            || plaintext.length > PulseLibsignalSessionEngine.MAX_PLAINTEXT_BYTES
        ) {
            throw new IllegalArgumentException("e2ee_group_plaintext_size_invalid");
        }
    }

    private static void requireCiphertext(byte[] ciphertext) {
        if (
            ciphertext == null
            || ciphertext.length == 0
            || ciphertext.length > PulseLibsignalSessionEngine.MAX_PLAINTEXT_BYTES * 2
        ) {
            throw new IllegalArgumentException("e2ee_group_ciphertext_size_invalid");
        }
    }
}
