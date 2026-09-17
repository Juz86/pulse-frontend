package com.pulsemessenger.chat;

import android.app.Activity;

import com.cloudflare.realtimekit.RealtimeKitClient;
import com.cloudflare.realtimekit.RealtimeKitMeetingBuilder;
import com.cloudflare.realtimekit.RtkParticipant;
import com.cloudflare.realtimekit.models.RtkMeetingInfo;
import com.cloudflare.realtimekit.participants.RtkParticipants;
import com.cloudflare.realtimekit.participants.RtkParticipantsEventListener;
import com.cloudflare.realtimekit.participants.RtkRemoteParticipant;
import com.cloudflare.realtimekit.platform.VideoView;

import java.util.List;
import java.util.Map;

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

    interface VideoListener {
        void onVideoViewsChanged(VideoView remoteView, VideoView localView);
    }

    interface Backend {
        void initialize(String authToken, boolean enableVideo, Completion completion);

        void join(Completion completion);

        void setAudioEnabled(boolean enabled, Completion completion);

        void setVideoEnabled(boolean enabled, Completion completion);

        void switchCamera();

        void setVideoListener(VideoListener listener);

        void clearVideoListener(VideoListener listener);

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

    synchronized void attachVideoListener(VideoListener videoListener) {
        backend.setVideoListener(videoListener);
    }

    synchronized void detachVideoListener(VideoListener videoListener) {
        backend.clearVideoListener(videoListener);
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
        private final Activity activity;
        private final RealtimeKitClient client;
        private VideoListener videoListener;
        private VideoView localVideoView;
        private VideoView remoteVideoView;
        private String remoteParticipantId;
        private boolean participantListenerRegistered;
        private boolean roomJoined;
        private boolean released;

        private final RtkParticipantsEventListener participantsEventListener = new RtkParticipantsEventListener() {
            @Override
            public void onParticipantJoin(RtkRemoteParticipant participant) {
                refreshVideoViews();
            }

            @Override
            public void onParticipantLeave(RtkRemoteParticipant participant) {
                refreshVideoViews();
            }

            @Override
            public void onAudioUpdate(RtkRemoteParticipant participant, boolean enabled) {}

            @Override
            public void onVideoUpdate(RtkRemoteParticipant participant, boolean enabled) {
                refreshVideoViews();
            }

            @Override
            public void onScreenShareUpdate(RtkRemoteParticipant participant, boolean enabled) {}

            @Override
            public void onParticipantPinned(RtkRemoteParticipant participant) {}

            @Override
            public void onParticipantUnpinned(RtkRemoteParticipant participant) {}

            @Override
            public void onActiveParticipantsChanged(List<RtkRemoteParticipant> participants) {
                refreshVideoViews();
            }

            @Override
            public void onActiveSpeakerChanged(RtkRemoteParticipant participant) {}

            @Override
            public void onAllParticipantsUpdated(List<RtkParticipant> participants) {
                refreshVideoViews();
            }

            @Override
            public void onNewBroadcastMessage(String type, Map<String, ?> payload) {}

            @Override
            public void onUpdate(RtkParticipants participants) {
                refreshVideoViews();
            }
        };

        CloudflareBackend(Activity activity) {
            this.activity = activity;
            client = RealtimeKitMeetingBuilder.INSTANCE.build(activity);
        }

        @Override
        public void initialize(String authToken, boolean enableVideo, Completion completion) {
            RtkMeetingInfo meetingInfo = new RtkMeetingInfo(authToken, true, enableVideo);
            client.init(
                meetingInfo,
                () -> {
                    registerParticipantListener();
                    return completeSuccess(completion);
                },
                error -> completeFailure(completion, error)
            );
        }

        @Override
        public void join(Completion completion) {
            client.joinRoom(
                () -> {
                    roomJoined = true;
                    refreshVideoViews();
                    return completeSuccess(completion);
                },
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
        public void setVideoListener(VideoListener listener) {
            videoListener = listener;
            refreshVideoViews();
        }

        @Override
        public void clearVideoListener(VideoListener listener) {
            if (videoListener == listener) videoListener = null;
        }

        @Override
        public void leave(Completion completion) {
            roomJoined = false;
            client.leaveRoom(
                () -> completeSuccess(completion),
                error -> completeFailure(completion, error)
            );
        }

        @Override
        public void release(Completion completion) {
            released = true;
            roomJoined = false;
            if (participantListenerRegistered) {
                client.removeParticipantsEventListener(participantsEventListener);
                participantListenerRegistered = false;
            }
            activity.runOnUiThread(() -> {
                releaseVideoViews();
                client.release(
                    () -> completeSuccess(completion),
                    error -> completeFailure(completion, error)
                );
            });
        }

        private void registerParticipantListener() {
            if (participantListenerRegistered || released) return;
            client.addParticipantsEventListener(participantsEventListener);
            participantListenerRegistered = true;
        }

        private void refreshVideoViews() {
            VideoListener listener = videoListener;
            if (listener == null || released || !roomJoined) return;
            activity.runOnUiThread(() -> {
                if (released || !roomJoined || videoListener == null) return;
                if (localVideoView == null) localVideoView = client.getLocalUser().getSelfPreview();

                RtkRemoteParticipant participant = selectRemoteParticipant();
                String participantId = participant == null ? null : participant.getId();
                VideoView previousRemoteView = null;
                if (!sameValue(remoteParticipantId, participantId)) {
                    previousRemoteView = remoteVideoView;
                    remoteVideoView = null;
                    remoteParticipantId = participantId;
                    if (participant != null) remoteVideoView = participant.getVideoView();
                }
                videoListener.onVideoViewsChanged(remoteVideoView, localVideoView);
                releaseDetachedVideoView(previousRemoteView);
            });
        }

        private RtkRemoteParticipant selectRemoteParticipant() {
            List<RtkRemoteParticipant> joined = client.getParticipants().getJoined();
            if (joined == null || joined.isEmpty()) return null;
            for (RtkRemoteParticipant participant : joined) {
                if (participant != null && participant.getVideoEnabled()) return participant;
            }
            return joined.get(0);
        }

        private void releaseVideoViews() {
            VideoListener listener = videoListener;
            if (listener != null) listener.onVideoViewsChanged(null, null);
            releaseRemoteVideoView();
            if (localVideoView != null) {
                localVideoView.stopVideoRender();
                localVideoView.release();
                localVideoView = null;
            }
            videoListener = null;
        }

        private void releaseRemoteVideoView() {
            if (remoteVideoView != null) {
                remoteVideoView.stopVideoRender();
                remoteVideoView.release();
                remoteVideoView = null;
            }
            remoteParticipantId = null;
        }

        private void releaseDetachedVideoView(VideoView videoView) {
            if (videoView == null) return;
            videoView.stopVideoRender();
            videoView.release();
        }

        private static boolean sameValue(String first, String second) {
            return first == null ? second == null : first.equals(second);
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
