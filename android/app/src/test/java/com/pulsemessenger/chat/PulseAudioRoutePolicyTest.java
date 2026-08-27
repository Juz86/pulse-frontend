package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.List;

import org.junit.Test;

public class PulseAudioRoutePolicyTest {
    private final PulseAudioRoute earpiece = route(1, PulseAudioRoute.Kind.EARPIECE, "Telefoon");
    private final PulseAudioRoute speaker = route(2, PulseAudioRoute.Kind.SPEAKER, "Luidspreker");
    private final PulseAudioRoute bluetooth = route(3, PulseAudioRoute.Kind.BLUETOOTH, "Bluetooth-headset");
    private final PulseAudioRoute wired = route(4, PulseAudioRoute.Kind.WIRED, "Bekabelde headset");
    private final PulseAudioRoute usb = route(5, PulseAudioRoute.Kind.USB, "USB-headset");

    @Test
    public void audioUsesEarpieceButTabletFallsBackToSpeaker() {
        assertEquals(1, PulseAudioRoutePolicy.choose(routes(earpiece, speaker), null, null, null, false));
        assertEquals(2, PulseAudioRoutePolicy.choose(routes(speaker), null, null, null, false));
    }

    @Test
    public void videoUsesSpeakerWithoutExternalDevice() {
        assertEquals(2, PulseAudioRoutePolicy.choose(routes(earpiece, speaker), null, null, null, true));
    }

    @Test
    public void newlyConnectedHeadsetBecomesAutomaticRoute() {
        assertEquals(4, PulseAudioRoutePolicy.choose(routes(earpiece, speaker, bluetooth, wired), 3, null, 4, false));
    }

    @Test
    public void userOverrideWinsWhenAnotherDeviceConnects() {
        assertEquals(2, PulseAudioRoutePolicy.choose(routes(speaker, bluetooth, usb), 3, 2, 5, true));
    }

    @Test
    public void disappearingSelectionFailsOverWithoutEarpieceAssumption() {
        assertEquals(5, PulseAudioRoutePolicy.choose(routes(speaker, usb), 3, null, null, false));
        assertEquals(2, PulseAudioRoutePolicy.choose(routes(speaker), 3, null, null, false));
    }

    private PulseAudioRoute route(int id, PulseAudioRoute.Kind kind, String label) {
        return new PulseAudioRoute(id, kind, label, false);
    }

    private List<PulseAudioRoute> routes(PulseAudioRoute... routes) {
        return Arrays.asList(routes);
    }
}
