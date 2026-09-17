package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PulseCallEngineTest {
    @Test
    public void onlyExplicitRealtimeKitValueSelectsV2() {
        assertTrue(PulseCallEngine.isRealtimeKit("realtimekit-v2"));
        assertFalse(PulseCallEngine.isRealtimeKit(null));
        assertFalse(PulseCallEngine.isRealtimeKit(""));
        assertFalse(PulseCallEngine.isRealtimeKit("realtimekit-v3"));
    }

    @Test
    public void unknownValuesFallBackToLegacyEngine() {
        assertEquals("webrtc-v1", PulseCallEngine.normalize(null));
        assertEquals("webrtc-v1", PulseCallEngine.normalize("unknown"));
        assertEquals("realtimekit-v2", PulseCallEngine.normalize("realtimekit-v2"));
    }

    @Test
    public void debugOverrideSelectsRealtimeKitWithoutChangingReleaseSelection() {
        assertEquals("realtimekit-v2", PulseCallEngine.selectOutgoing("webrtc-v1", true));
        assertEquals("webrtc-v1", PulseCallEngine.selectOutgoing("webrtc-v1", false));
        assertEquals("realtimekit-v2", PulseCallEngine.selectOutgoing("realtimekit-v2", false));
        assertEquals("webrtc-v1", PulseCallEngine.selectOutgoing("unknown", false));
    }
}
