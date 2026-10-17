package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import org.junit.Test;
import org.signal.libsignal.protocol.IdentityKeyPair;
import org.signal.libsignal.protocol.SignalProtocolAddress;
import org.signal.libsignal.protocol.state.impl.InMemorySignalProtocolStore;

public class PulseLibsignalSessionEngineTest {
    @Test
    public void exchangesPreKeyAndSessionMessagesBetweenAndroidDevices() throws Exception {
        PulseLibsignalSessionEngine engine = new PulseLibsignalSessionEngine();
        IdentityKeyPair aliceIdentity = IdentityKeyPair.generate();
        IdentityKeyPair bobIdentity = IdentityKeyPair.generate();
        int aliceRegistrationId = 11001;
        int bobRegistrationId = 22002;
        InMemorySignalProtocolStore aliceStore = new InMemorySignalProtocolStore(
            aliceIdentity,
            aliceRegistrationId
        );
        InMemorySignalProtocolStore bobStore = new InMemorySignalProtocolStore(
            bobIdentity,
            bobRegistrationId
        );

        PulseLibsignalSessionEngine.KeyMaterial bobMaterial = engine.generateKeyMaterial(
            bobIdentity,
            20,
            21,
            22,
            1_760_688_000_000L
        );
        engine.installKeyMaterial(bobStore, bobMaterial);
        PulseLibsignalSessionEngine.PublicBundle bobBundle = engine.publicBundle(
            bobRegistrationId,
            2,
            bobIdentity.getPublicKey(),
            bobMaterial
        );

        SignalProtocolAddress aliceAddress = new SignalProtocolAddress("user-alice", 1);
        SignalProtocolAddress bobAddress = new SignalProtocolAddress("user-bob", 2);
        byte[] firstPlaintext = engine.utf8("Wat doe je?");
        PulseLibsignalSessionEngine.EncryptedEnvelope first = engine.establishAndEncrypt(
            aliceStore,
            aliceAddress,
            bobAddress,
            bobBundle,
            firstPlaintext
        );

        assertEquals("prekey", first.envelopeType);
        assertArrayEquals(firstPlaintext, engine.decrypt(
            bobStore,
            bobAddress,
            aliceAddress,
            first
        ));

        byte[] replyPlaintext = engine.utf8("Ik ben onderweg.");
        PulseLibsignalSessionEngine.EncryptedEnvelope reply = engine.encrypt(
            bobStore,
            bobAddress,
            aliceAddress,
            replyPlaintext
        );

        assertEquals("message", reply.envelopeType);
        assertArrayEquals(replyPlaintext, engine.decrypt(
            aliceStore,
            aliceAddress,
            bobAddress,
            reply
        ));
    }
}
