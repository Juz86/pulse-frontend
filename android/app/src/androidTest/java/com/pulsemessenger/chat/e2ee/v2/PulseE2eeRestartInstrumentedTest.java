package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Base64;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class PulseE2eeRestartInstrumentedTest {
    private static final String USER_ID = "instrumented-restart-user";
    private static final String PHASE_ARGUMENT = "pulseRestartPhase";
    private static final String EXPECTED_STATE = "pulse_e2ee_v2_restart_expected";
    private static final String PUBLIC_IDENTITY = "public_identity";
    private static final String REGISTRATION_ID = "registration_id";

    @Test
    public void preparePersistentIdentityBeforeDeviceRestart() {
        requirePhase("prepare");
        Context context = ApplicationProvider.getApplicationContext();
        PulseE2eeSecureStore secureStore = new PulseE2eeSecureStore(context);
        secureStore.clearUser(USER_ID);
        expectedState(context).edit().clear().commit();

        PulseSignalProtocolStore signalStore = PulseSignalProtocolStore.openOrCreate(
            secureStore,
            USER_ID
        );
        byte[] publicIdentity = signalStore.getIdentityKeyPair().getPublicKey().serialize();
        boolean saved = expectedState(context).edit()
            .putString(PUBLIC_IDENTITY, Base64.encodeToString(publicIdentity, Base64.NO_WRAP))
            .putInt(REGISTRATION_ID, signalStore.getLocalRegistrationId())
            .commit();
        if (!saved) throw new AssertionError("e2ee_restart_expected_state_write_failed");
    }

    @Test
    public void restoresPersistentIdentityAfterDeviceRestart() {
        requirePhase("verify");
        Context context = ApplicationProvider.getApplicationContext();
        SharedPreferences expected = expectedState(context);
        String encodedIdentity = expected.getString(PUBLIC_IDENTITY, null);
        Assume.assumeNotNull(encodedIdentity);

        PulseE2eeSecureStore secureStore = new PulseE2eeSecureStore(context);
        PulseSignalProtocolStore signalStore = PulseSignalProtocolStore.openOrCreate(
            secureStore,
            USER_ID
        );
        assertArrayEquals(
            Base64.decode(encodedIdentity, Base64.NO_WRAP),
            signalStore.getIdentityKeyPair().getPublicKey().serialize()
        );
        assertEquals(
            expected.getInt(REGISTRATION_ID, -1),
            signalStore.getLocalRegistrationId()
        );

        secureStore.clearUser(USER_ID);
        expected.edit().clear().commit();
    }

    private static SharedPreferences expectedState(Context context) {
        return context.getSharedPreferences(EXPECTED_STATE, Context.MODE_PRIVATE);
    }

    private static void requirePhase(String expected) {
        Bundle arguments = InstrumentationRegistry.getArguments();
        Assume.assumeTrue(expected.equals(arguments.getString(PHASE_ARGUMENT)));
    }
}
