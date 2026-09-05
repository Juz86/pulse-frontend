package com.pulsemessenger.chat;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.os.Build;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class PulseTelecomManagerInstrumentedTest {
    @Test
    public void registeredPhoneAccountSupportsPulseUriScheme() {
        Assume.assumeTrue(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        TelecomManager telecom = context.getSystemService(TelecomManager.class);
        assertNotNull(telecom);

        PhoneAccountHandle handle = PulseTelecomManager.phoneAccountHandle(context);
        try {
            PulseTelecomManager.registerPhoneAccount(context);
            PhoneAccount account = telecom.getPhoneAccount(handle);

            assertNotNull(account);
            assertTrue(account.hasCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED));
            assertTrue(account.supportsUriScheme(PulseTelecomManager.URI_SCHEME));
            assertTrue(PulseTelecomManager.callAddress("contact-uid").toString().startsWith("pulse:"));
        } finally {
            telecom.unregisterPhoneAccount(handle);
        }
    }
}
