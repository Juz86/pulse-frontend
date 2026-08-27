package com.pulsemessenger.chat;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PulseCameraLifecycleTest {
    @Test
    public void pictureInPictureKeepsUserEnabledCameraEligible() {
        PulseCameraLifecycle lifecycle = new PulseCameraLifecycle(true);
        lifecycle.setPresentation(false, true);

        assertTrue(lifecycle.shouldCapture());
    }

    @Test
    public void hiddenVideoUiStopsCaptureWithoutForgettingUserIntent() {
        PulseCameraLifecycle lifecycle = new PulseCameraLifecycle(true);
        lifecycle.setPresentation(false, false);

        assertFalse(lifecycle.shouldCapture());
        assertTrue(lifecycle.isEnabledByUser());
    }

    @Test
    public void screenLockStopsCaptureUntilVisibleAfterUnlock() {
        PulseCameraLifecycle lifecycle = new PulseCameraLifecycle(true);
        lifecycle.setPresentation(true, false);
        lifecycle.setScreenInteractive(false);
        assertFalse(lifecycle.shouldCapture());

        lifecycle.setScreenInteractive(true);
        lifecycle.setPresentation(false, false);
        assertFalse(lifecycle.shouldCapture());

        lifecycle.setPresentation(true, false);
        assertTrue(lifecycle.shouldCapture());
    }

    @Test
    public void cameraOffPersistsAcrossPipAndForeground() {
        PulseCameraLifecycle lifecycle = new PulseCameraLifecycle(true);
        lifecycle.setPresentation(false, true);
        lifecycle.setEnabledByUser(false);
        assertFalse(lifecycle.shouldCapture());

        lifecycle.setPresentation(true, false);
        assertFalse(lifecycle.shouldCapture());
    }
}
