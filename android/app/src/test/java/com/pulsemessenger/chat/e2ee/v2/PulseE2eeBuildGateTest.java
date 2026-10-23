package com.pulsemessenger.chat.e2ee.v2;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PulseE2eeBuildGateTest {
    @Test
    public void exposesQaProviderOnlyInDebugBuilds() {
        assertTrue(PulseE2eeBuildGate.isProviderAvailable(true, true, false));
        assertFalse(PulseE2eeBuildGate.isProviderAvailable(false, true, false));
    }

    @Test
    public void exposesPilotProviderOnlyInReleaseBuilds() {
        assertTrue(PulseE2eeBuildGate.isProviderAvailable(false, false, true));
        assertFalse(PulseE2eeBuildGate.isProviderAvailable(true, false, true));
    }

    @Test
    public void keepsOrdinaryBuildsDisabled() {
        assertFalse(PulseE2eeBuildGate.isProviderAvailable(true, false, false));
        assertFalse(PulseE2eeBuildGate.isProviderAvailable(false, false, false));
    }
}
