package com.pulsemessenger.chat;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PulseWebUpdateManagerTest {
    @Test
    public void disablesUpdatesForE2eeQaEvenWithConfiguredKey() {
        assertFalse(PulseWebUpdateManager.isUpdateAllowed(true, false, "public-key"));
    }

    @Test
    public void disablesUpdatesForInternalPlayTests() {
        assertFalse(PulseWebUpdateManager.isUpdateAllowed(false, true, "public-key"));
    }

    @Test
    public void enablesUpdatesOnlyForNormalBuildsWithConfiguredKey() {
        assertFalse(PulseWebUpdateManager.isUpdateAllowed(false, false, null));
        assertFalse(PulseWebUpdateManager.isUpdateAllowed(false, false, "  "));
        assertTrue(PulseWebUpdateManager.isUpdateAllowed(false, false, "public-key"));
    }
}
