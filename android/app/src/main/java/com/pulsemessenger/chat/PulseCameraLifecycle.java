package com.pulsemessenger.chat;

final class PulseCameraLifecycle {
    private boolean enabledByUser;
    private boolean captureActive;
    private boolean videoUiVisible;
    private boolean pictureInPictureVisible;
    private boolean screenInteractive = true;

    PulseCameraLifecycle(boolean enabledByUser) {
        this.enabledByUser = enabledByUser;
    }

    synchronized void setEnabledByUser(boolean enabled) {
        enabledByUser = enabled;
    }

    synchronized boolean isEnabledByUser() {
        return enabledByUser;
    }

    synchronized void setCaptureActive(boolean active) {
        captureActive = active;
    }

    synchronized boolean isCaptureActive() {
        return captureActive;
    }

    synchronized void setPresentation(boolean visible, boolean inPictureInPicture) {
        videoUiVisible = visible;
        pictureInPictureVisible = inPictureInPicture;
    }

    synchronized void setScreenInteractive(boolean interactive) {
        screenInteractive = interactive;
    }

    synchronized boolean shouldCapture() {
        return enabledByUser
            && screenInteractive
            && (videoUiVisible || pictureInPictureVisible);
    }
}
