package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.Test;

public class PulseRealtimeKitSessionTest {
    @Test
    public void startInitializesAndJoinsExactlyOnce() {
        FakeBackend backend = new FakeBackend();
        RecordingListener listener = new RecordingListener();
        PulseRealtimeKitSession session = new PulseRealtimeKitSession(backend, listener);

        assertTrue(session.start(" participant-token ", true));
        assertFalse(session.start("participant-token", true));
        assertEquals("participant-token", backend.authToken);
        assertTrue(backend.videoEnabledAtStart);
        assertEquals(PulseRealtimeKitSession.State.INITIALIZING, session.state());

        backend.initializeCompletion.complete(null);
        assertEquals(PulseRealtimeKitSession.State.JOINING, session.state());

        backend.joinCompletion.complete(null);
        assertEquals(PulseRealtimeKitSession.State.ACTIVE, session.state());
        assertEquals(3, listener.states.size());
    }

    @Test
    public void lateJoinCallbackCannotReviveEndedCall() {
        FakeBackend backend = new FakeBackend();
        PulseRealtimeKitSession session = new PulseRealtimeKitSession(backend, null);

        assertTrue(session.start("token", false));
        backend.initializeCompletion.complete(null);
        assertTrue(session.end());
        assertEquals(PulseRealtimeKitSession.State.ENDED, session.state());
        assertEquals(1, backend.releaseCount);

        backend.joinCompletion.complete(null);
        assertEquals(PulseRealtimeKitSession.State.ENDED, session.state());
        assertEquals(1, backend.releaseCount);
    }

    @Test
    public void activeCallControlsAndLeavesOnce() {
        FakeBackend backend = activeBackend();
        PulseRealtimeKitSession session = backend.session;

        assertTrue(session.setMuted(true));
        assertFalse(backend.audioEnabled);
        assertTrue(session.setCameraEnabled(false));
        assertFalse(backend.videoEnabled);
        assertTrue(session.switchCamera());
        assertEquals(1, backend.switchCameraCount);

        assertTrue(session.end());
        assertFalse(session.end());
        assertEquals(PulseRealtimeKitSession.State.LEAVING, session.state());
        assertEquals(1, backend.leaveCount);

        backend.leaveCompletion.complete(null);
        assertEquals(PulseRealtimeKitSession.State.ENDED, session.state());
        assertEquals(1, backend.releaseCount);
    }

    @Test
    public void initializationFailureIsTerminalAndReported() {
        FakeBackend backend = new FakeBackend();
        RecordingListener listener = new RecordingListener();
        PulseRealtimeKitSession session = new PulseRealtimeKitSession(backend, listener);

        assertTrue(session.start("token", false));
        backend.initializeCompletion.complete("ongeldig token");

        assertEquals(PulseRealtimeKitSession.State.FAILED, session.state());
        assertEquals(1, backend.releaseCount);
        assertEquals(1, listener.errors.size());
        assertTrue(listener.errors.get(0).contains("ongeldig token"));
    }

    @Test
    public void controlsAreRejectedBeforeJoin() {
        FakeBackend backend = new FakeBackend();
        PulseRealtimeKitSession session = new PulseRealtimeKitSession(backend, null);

        assertFalse(session.setMuted(true));
        assertFalse(session.setCameraEnabled(true));
        assertFalse(session.switchCamera());
        assertFalse(session.start(" ", false));
    }

    @Test
    public void videoListenerIsAttachedAndDetachedThroughBackend() {
        FakeBackend backend = activeBackend();
        PulseRealtimeKitSession.VideoListener listener = (remote, local) -> {};

        backend.session.attachVideoListener(listener);
        assertEquals(listener, backend.videoListener);

        backend.session.detachVideoListener(listener);
        assertEquals(null, backend.videoListener);
    }

    private FakeBackend activeBackend() {
        FakeBackend backend = new FakeBackend();
        backend.session = new PulseRealtimeKitSession(backend, null);
        assertTrue(backend.session.start("token", true));
        backend.initializeCompletion.complete(null);
        backend.joinCompletion.complete(null);
        return backend;
    }

    private static final class RecordingListener implements PulseRealtimeKitSession.Listener {
        final List<PulseRealtimeKitSession.State> states = new ArrayList<>();
        final List<String> errors = new ArrayList<>();

        @Override
        public void onStateChanged(PulseRealtimeKitSession.State state) {
            states.add(state);
        }

        @Override
        public void onError(String message) {
            errors.add(message);
        }
    }

    private static final class FakeBackend implements PulseRealtimeKitSession.Backend {
        PulseRealtimeKitSession session;
        String authToken;
        boolean videoEnabledAtStart;
        boolean audioEnabled;
        boolean videoEnabled;
        int switchCameraCount;
        int leaveCount;
        int releaseCount;
        PulseRealtimeKitSession.Completion initializeCompletion;
        PulseRealtimeKitSession.Completion joinCompletion;
        PulseRealtimeKitSession.Completion leaveCompletion;
        PulseRealtimeKitSession.VideoListener videoListener;

        @Override
        public void initialize(String authToken, boolean enableVideo, PulseRealtimeKitSession.Completion completion) {
            this.authToken = authToken;
            this.videoEnabledAtStart = enableVideo;
            this.initializeCompletion = completion;
        }

        @Override
        public void join(PulseRealtimeKitSession.Completion completion) {
            joinCompletion = completion;
        }

        @Override
        public void setAudioEnabled(boolean enabled, PulseRealtimeKitSession.Completion completion) {
            audioEnabled = enabled;
            completion.complete(null);
        }

        @Override
        public void setVideoEnabled(boolean enabled, PulseRealtimeKitSession.Completion completion) {
            videoEnabled = enabled;
            completion.complete(null);
        }

        @Override
        public void switchCamera() {
            switchCameraCount++;
        }

        @Override
        public void setVideoListener(PulseRealtimeKitSession.VideoListener listener) {
            videoListener = listener;
        }

        @Override
        public void clearVideoListener(PulseRealtimeKitSession.VideoListener listener) {
            if (videoListener == listener) videoListener = null;
        }

        @Override
        public void leave(PulseRealtimeKitSession.Completion completion) {
            leaveCount++;
            leaveCompletion = completion;
        }

        @Override
        public void release(PulseRealtimeKitSession.Completion completion) {
            releaseCount++;
            completion.complete(null);
        }
    }
}
