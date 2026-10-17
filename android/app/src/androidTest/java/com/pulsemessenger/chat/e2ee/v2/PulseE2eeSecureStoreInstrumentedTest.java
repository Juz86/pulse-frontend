package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.util.Base64;
import android.util.Log;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import java.nio.charset.StandardCharsets;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class PulseE2eeSecureStoreInstrumentedTest {
    private static final String LOG_TAG = "PulseE2eeTest";
    private static final String USER_ID = "instrumented-user";
    private PulseE2eeSecureStore store;

    @Before
    public void setUp() {
        Context context = ApplicationProvider.getApplicationContext();
        store = new PulseE2eeSecureStore(context);
        store.clearUser(USER_ID);
    }

    @After
    public void tearDown() {
        store.clearUser(USER_ID);
    }

    @Test
    public void encryptsAndSeparatesPrivateRecords() throws Exception {
        byte[] identity = "identity-private-record".getBytes(StandardCharsets.UTF_8);
        byte[] session = "session-private-record".getBytes(StandardCharsets.UTF_8);

        store.put(USER_ID, "identity", "device-a1", identity);
        store.put(USER_ID, "session", "device-b1", session);

        assertArrayEquals(identity, store.get(USER_ID, "identity", "device-a1"));
        assertArrayEquals(session, store.get(USER_ID, "session", "device-b1"));

        Context context = ApplicationProvider.getApplicationContext();
        for (Object storedValue : context
            .getSharedPreferences(PulseE2eeSecureStore.PREFERENCES_NAME, Context.MODE_PRIVATE)
            .getAll()
            .values()) {
            String serialized = String.valueOf(storedValue);
            byte[] encryptedBlob = Base64.decode(serialized, Base64.NO_WRAP);
            assertFalse(contains(encryptedBlob, identity));
            assertFalse(contains(encryptedBlob, session));
        }

        assertNull(store.get(USER_ID, "session", "missing-device"));
        assertFalse(store.remove(USER_ID, "session", "missing-device"));
        assertTrue(store.remove(USER_ID, "session", "device-b1"));
        assertNull(store.get(USER_ID, "session", "device-b1"));
    }

    @Test
    public void reportsANonExportableKeystoreCapability() throws Exception {
        PulseE2eeSecureStore.Capabilities capabilities = store.capabilities();
        assertTrue(capabilities.secureStorage);
        assertFalse(capabilities.strongBoxBacked && !capabilities.hardwareBacked);
        Log.i(
            LOG_TAG,
            "secureStorage=" + capabilities.secureStorage
                + " hardwareBacked=" + capabilities.hardwareBacked
                + " strongBoxBacked=" + capabilities.strongBoxBacked
        );
    }

    @Test
    public void restoresTheLibsignalIdentityFromEncryptedAndroidStorage() {
        PulseSignalProtocolStore first = PulseSignalProtocolStore.openOrCreate(store, USER_ID);
        byte[] identity = first.getIdentityKeyPair().serialize();
        int registrationId = first.getLocalRegistrationId();

        PulseSignalProtocolStore reopened = PulseSignalProtocolStore.openOrCreate(
            new PulseE2eeSecureStore(ApplicationProvider.getApplicationContext()),
            USER_ID
        );

        assertArrayEquals(identity, reopened.getIdentityKeyPair().serialize());
        assertTrue(registrationId == reopened.getLocalRegistrationId());
    }

    private static boolean contains(byte[] haystack, byte[] needle) {
        for (int start = 0; start <= haystack.length - needle.length; start++) {
            int offset = 0;
            while (offset < needle.length && haystack[start + offset] == needle[offset]) {
                offset++;
            }
            if (offset == needle.length) return true;
        }
        return false;
    }
}
