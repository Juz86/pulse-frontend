package com.pulsemessenger.chat;

import android.app.Activity;

import com.cloudflare.realtimekit.RealtimeKitClient;
import com.cloudflare.realtimekit.RealtimeKitMeetingBuilder;
import com.cloudflare.realtimekit.models.RtkMeetingInfo;

import kotlin.Unit;

final class PulseRealtimeKitSession {
    enum State {
        IDLE,
        INITIALIZING,
        JOINING,
        ACTIVE,
        LEAVING,
        ENDED,
        FAILED
    }

    interface Listener {
        void onStateChanged(State state);

        void onError(String message);
    }

    interface Completion {
        void complete(String error);
    }

    interface Backend {
        void initialize(String authToken, boolean enableVideo, Completion completion);

        void join(Completion completion);

        void setAudioEnabled(boolean enabled, Completion completion);

        void setVideoEnabled(boolean enabled, Completion completion);

        void switchCamera();

        void leave(Completion completion);

        void release(Completion completion);
    }

    private final Backend backend;
    private final Listener listener;
    private State state = State.IDLE;
    private boolean releaseStarted;

    static PulseRealtimeKitSession create(Activity activity, Listener listener) {
        if (activity == null) throw new IllegalArgumentException("activity is required");
        return new PulseRealtimeKitSession(new CloudflareBackend(activity), listener);
    }

    PulseRealtimeKitSession(Backend backend, Listener listener) {
        if (backend == null) throw new IllegalArgumentException("backend is required");
        this.backend = backend;
        this.listener = listener;
    }

    synchronized boolean start(String authToken, boolean enableVideo) {
        if (state != State.IDLE || authToken == null || authToken.trim().isEmpty()) return false;
        transition(State.INITIALIZING);
        backend.initialize(authToken.trim(), enableVideo, error -> onInitialized(error));
        return true;
    }

    synchronized boolean setMuted(boolean muted) {
        if (state != State.ACTIVE) return false;
        backend.setAudioEnabled(!muted, error -> reportControlError("Microfoon wijzigen mislukt", error));
        return true;
    }

    synchronized boolean setCameraEnabled(boolean enabled) {
        if (state != State.ACTIVE) return false;
        backend.setVideoEnabled(enabled, error -> reportControlError("Camera wijzigen mislukt", error));
        return true;
    }

    synchronized boolean switchCamera() {
        if (state != State.ACTIVE) return false;
        backend.switchCamera();
        return true;
    }

    synchronized boolean end() {
        if (state == State.ENDED || state == State.LEAVING) return false;
        if (state == State.IDLE || state == State.FAILED) {
            transition(State.ENDED);
            releaseOnce();
            return true;
        }

        State previous = state;
        transition(State.LEAVING);
        if (previous == State.ACTIVE) {
            backend.leave(error -> {
                if (error != null) reportControlError("Gesprek verlaten mislukt", error);
                finishEnded();
            });
        } else {
            finishEnded();
        }
        return true;
    }

    synchronized State state() {
        return state;
    }

    private synchronized void onInitialized(String error) {
        if (state != State.INITIALIZING) return;
        if (error != null) {
            fail("RealtimeKit initialiseren mislukt", error);
            return;
        }
        transition(State.JOINING);
        backend.join(this::onJoined);
    }

    private synchronized void onJoined(String error) {
        if (state != State.JOINING) return;
        if (error != null) {
            fail("RealtimeKit-gesprek verbinden mislukt", error);
            return;
        }
        transition(State.ACTIVE);
    }

    private synchronized void fail(String prefix, String error) {
        transition(State.FAILED);
        notifyError(prefix + ": " + error);
        releaseOnce();
    }

    private synchronized void finishEnded() {
        if (state != State.ENDED) transition(State.ENDED);
        releaseOnce();
    }

    private synchronized void releaseOnce() {
        if (releaseStarted) return;
        releaseStarted = true;
        backend.release(error -> {
            if (error != null) reportControlError("RealtimeKit vrijgeven mislukt", error);
        });
    }

    private synchronized void transition(State next) {
        state = next;
        if (listener != null) listener.onStateChanged(next);
    }

    private void reportControlError(String prefix, String error) {
        if (error != null) notifyError(prefix + ": " + error);
    }

    private void notifyError(String message) {
        if (listener != null) listener.onError(message);
    }

    private static final class CloudflareBackend implements Backend {
        private final RealtimeKitClient client;

        CloudflareBackend(Activity activity) {
            client = RealtimeKitMeetingBuilder.INSTANCE.build(activity);
        }

        @Override
        public void initialize(String authToken, boolean enableVideo, Completion completion) {
            RtkMeetingInfo meetingInfo = new RtkMeetingInfo(authToken, true, enableVideo);
            client.init(
                meetingInfo,
                () -> completeSuccess(completion),
                error -> completeFailure(completion, error)
            );
        }

        @Override
        public void join(Completion completion) {
            client.joinRoom(
                () -> completeSuccess(completion),
                error -> completeFailure(completion, error)
            );
        }

        @Override
        public void setAudioEnabled(boolean enabled, Completion completion) {
            if (enabled) {
                client.getLocalUser().enableAudio(error -> completeNullableError(completion, error));
            } else {
                client.getLocalUser().disableAudio(error -> completeNullableError(completion, error));
            }
        }

        @Override
        public void setVideoEnabled(boolean enabled, Completion completion) {
            if (enabled) {
                client.getLocalUser().enableVideo(error -> completeNullableError(completion, error));
            } else {
                client.getLocalUser().disableVideo(error -> completeNullableError(completion, error));
            }
        }

        @Override
        public void switchCamera() {
            client.getLocalUser().switchCamera();
        }

        @Override
        public void leave(Completion completion) {
            client.leaveRoom(
                () -> completeSuccess(completion),
                error -> completeFailure(completion, error)
            );
        }

        @Override
        public void release(Completion completion) {
            client.release(
                () -> completeSuccess(completion),
                error -> completeFailure(completion, error)
            );
        }

        private static Unit completeSuccess(Completion completion) {
            completion.complete(null);
            return Unit.INSTANCE;
        }

        private static Unit completeFailure(Completion completion, Object error) {
            completion.complete(error == null ? "Onbekende fout" : error.toString());
            return Unit.INSTANCE;
        }

        private static Unit completeNullableError(Completion completion, Object error) {
            completion.complete(error == null ? null : error.toString());
            return Unit.INSTANCE;
        }
    }
}
