package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PulseCallWindowProfileTest {
    @Test
    public void phonePortraitIsCompactSinglePane() {
        PulseCallWindowProfile profile = PulseCallWindowProfile.from(412, 915);
        assertEquals(PulseCallWindowProfile.SizeClass.COMPACT, profile.sizeClass);
        assertFalse(profile.landscape);
        assertFalse(profile.useTwoPaneAudioLayout());
        assertFalse(profile.fitRemoteVideo());
    }

    @Test
    public void sevenInchTabletUsesMediumLayout() {
        PulseCallWindowProfile profile = PulseCallWindowProfile.from(700, 1024);
        assertEquals(PulseCallWindowProfile.SizeClass.MEDIUM, profile.sizeClass);
        assertTrue(profile.fitRemoteVideo());
        assertTrue(profile.previewWidthDp > 160);
    }

    @Test
    public void landscapeTabletUsesTwoPaneLayout() {
        PulseCallWindowProfile profile = PulseCallWindowProfile.from(1280, 720);
        assertEquals(PulseCallWindowProfile.SizeClass.EXPANDED, profile.sizeClass);
        assertTrue(profile.landscape);
        assertTrue(profile.useTwoPaneAudioLayout());
        assertTrue(profile.useTwoPaneIncomingLayout());
    }

    @Test
    public void smallChromeOsWindowFallsBackToCompactSafely() {
        PulseCallWindowProfile profile = PulseCallWindowProfile.from(480, 540);
        assertEquals(PulseCallWindowProfile.SizeClass.COMPACT, profile.sizeClass);
        assertTrue(profile.contentWidthDp <= 448);
        assertTrue(profile.previewHeightDp < profile.previewWidthDp);
    }
}
