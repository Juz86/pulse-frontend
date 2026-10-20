package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.os.Bundle;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import java.util.List;

import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class PulseE2eeMessageHistoryInstrumentedTest {
    @Test
    public void readsExistingEncryptedHistoryWhenRequested() throws Exception {
        Bundle arguments = InstrumentationRegistry.getArguments();
        String userId = arguments.getString("pulseHistoryUserId");
        String conversationId = arguments.getString("pulseHistoryConversationId");
        int expectedMinimum = Integer.parseInt(
            arguments.getString("pulseHistoryExpectedMinimum", "1")
        );
        Assume.assumeNotNull(userId, conversationId);

        Context context = ApplicationProvider.getApplicationContext();
        PulseE2eeMessageHistory history = new PulseE2eeMessageHistory(
            new PulseE2eeSecureStore(context)
        );
        List<PulseE2eeMessageHistory.TextMessage> messages = history.list(
            userId,
            conversationId,
            100,
            0
        );

        assertTrue("encrypted history was empty", messages.size() >= expectedMinimum);
    }
}
