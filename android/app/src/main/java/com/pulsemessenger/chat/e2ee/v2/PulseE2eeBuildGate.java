package com.pulsemessenger.chat.e2ee.v2;

final class PulseE2eeBuildGate {
    private PulseE2eeBuildGate() {}

    static boolean isProviderAvailable(boolean debug, boolean qaEnabled, boolean pilotEnabled) {
        return (debug && qaEnabled) || (!debug && pilotEnabled);
    }
}
