package com.pulsemessenger.chat;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.telecom.DisconnectCause;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

import org.json.JSONArray;
import org.json.JSONObject;
import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.Camera2Enumerator;
import org.webrtc.Camera1Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.CameraVideoCapturer;
import org.webrtc.DataChannel;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpReceiver;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoCapturer;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import io.socket.client.IO;
import io.socket.client.Socket;

public class PulseNativeCallService extends Service {
    private static final String ACTION_ANSWER = "com.pulsemessenger.chat.NATIVE_CALL_ANSWER";
    private static final String ACTION_OUTGOING = "com.pulsemessenger.chat.NATIVE_CALL_OUTGOING";
    private static final String API_URL = "https://api.pulse-messenger.com";
    private static final String CHANNEL_ID = "pulse_active_calls";
    static final String ACTION_NATIVE_CALL_FINISHED = "com.pulsemessenger.chat.NATIVE_CALL_FINISHED";
    static final String ACTION_NATIVE_CALL_CONNECTED = "com.pulsemessenger.chat.NATIVE_CALL_CONNECTED";
    static final String ACTION_NATIVE_CALL_RECONNECTING = "com.pulsemessenger.chat.NATIVE_CALL_RECONNECTING";
    static final String ACTION_AUDIO_ROUTES_CHANGED = "com.pulsemessenger.chat.AUDIO_ROUTES_CHANGED";
    static final String EXTRA_AUDIO_ROUTE_LABEL = "audioRouteLabel";
    private static final int NOTIFICATION_ID = 42_101;
    private static final long NETWORK_RECOVERY_TIMEOUT_MS = 20_000L;
    private static final long CONNECTION_TIMEOUT_MS = 30_000L;
    private static final long CALL_HEARTBEAT_INTERVAL_MS = 15_000L;
    private static final int MAX_PENDING_REMOTE_CANDIDATES = 64;
    private static volatile String activeSessionId;
    private static volatile PulseNativeCallService activeService;
    private static EglBase sharedEglBase;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Socket socket;
    private PeerConnectionFactory peerFactory;
    private PeerConnection peerConnection;
    private AudioSource audioSource;
    private AudioTrack localAudioTrack;
    private PulseAudioRouteController audioRouteController;
    private VideoSource videoSource;
    private VideoTrack localVideoTrack;
    private VideoTrack remoteVideoTrack;
    private VideoCapturer videoCapturer;
    private volatile boolean currentCameraFront;
    private volatile int availableCameraCount;
    private SurfaceTextureHelper surfaceTextureHelper;
    private SurfaceViewRenderer localRenderer;
    private SurfaceViewRenderer remoteRenderer;
    private String sessionId;
    private String fromUid;
    private String localCallerName;
    private String conversationId;
    private String callerName;
    private boolean isVideo;
    private boolean outgoing;
    private boolean peerStarted;
    private final PulseCallLifecycle callLifecycle = new PulseCallLifecycle();
    private final PulseIceCandidateBuffer<IceCandidate> remoteCandidateBuffer =
        new PulseIceCandidateBuffer<>(MAX_PENDING_REMOTE_CANDIDATES);
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private final Runnable networkRecoveryTimeout = () -> {
        if (callLifecycle.isRecoveryTimedOut(SystemClock.elapsedRealtime())) {
            failCall("Netwerkverbinding kon niet worden hersteld");
        }
    };
    private final Runnable connectionTimeout = () -> {
        if (callLifecycle.isConnectionTimedOut(SystemClock.elapsedRealtime())) {
            failCall(outgoing ? "Geen antwoord" : "Oproep verbinden duurde te lang");
        }
    };
    private final Runnable callHeartbeat = new Runnable() {
        @Override
        public void run() {
            if (callLifecycle.isStopped()) return;
            if (callLifecycle.isConnected() && socket != null && socket.connected()) {
                socket.emit("call:heartbeat", signalTarget());
            }
            mainHandler.postDelayed(this, CALL_HEARTBEAT_INTERVAL_MS);
        }
    };
    private boolean microphoneEnabled = true;
    private final PulseCameraLifecycle cameraLifecycle = new PulseCameraLifecycle(true);
    private boolean cameraCaptureStarting;
    private BroadcastReceiver screenReceiver;
    private String notificationStatus = "Verbinden...";
    private long connectedAtElapsedMs;

    static boolean isActive(String sessionId) {
        return sessionId != null && sessionId.equals(activeSessionId);
    }

    static boolean hasActiveCall() {
        return activeService != null && activeSessionId != null && !activeService.callLifecycle.isStopped();
    }

    static boolean clearStaleCallIfNeeded(Runnable onCleared) {
        PulseNativeCallService service = activeService;
        if (service == null || !hasActiveCall() || !service.isStaleForAdmission(SystemClock.elapsedRealtime())) {
            return false;
        }
        android.util.Log.w(
            "PulseNativeCall",
            "Achtergebleven oproepsessie opruimen voor nieuw gesprek: " + activeSessionId
        );
        service.mainHandler.post(() -> {
            service.endCall(true, DisconnectCause.ERROR);
            if (onCleared != null) service.mainHandler.postDelayed(onCleared, 250L);
        });
        return true;
    }

    static void reopenActiveCallUi() {
        PulseNativeCallService service = activeService;
        if (service != null && hasActiveCall()) service.showActiveCallUi();
    }

    private synchronized boolean isStaleForAdmission(long nowMs) {
        PulseCallLifecycle.State state = callLifecycle.state();
        if (state == PulseCallLifecycle.State.IDLE || state == PulseCallLifecycle.State.STOPPED) return true;
        if (sessionId == null || sessionId.trim().isEmpty() || fromUid == null || fromUid.trim().isEmpty()) return true;
        if (callLifecycle.isExpired(nowMs)) return true;
        if (state == PulseCallLifecycle.State.CONNECTED) {
            return !peerStarted || peerConnection == null || connectedAtElapsedMs <= 0L;
        }
        if (state == PulseCallLifecycle.State.RECONNECTING) {
            return !peerStarted || peerConnection == null;
        }
        return false;
    }

    static synchronized EglBase.Context sharedEglContext() {
        if (sharedEglBase == null) sharedEglBase = EglBase.create();
        return sharedEglBase.getEglBaseContext();
    }

    static boolean attachVideoRenderers(String sessionId, SurfaceViewRenderer remote, SurfaceViewRenderer local) {
        PulseNativeCallService service = activeService;
        if (service == null || !isActive(sessionId)) return false;
        service.attachRenderers(remote, local);
        return true;
    }

    static void detachVideoRenderers(String sessionId, SurfaceViewRenderer remote, SurfaceViewRenderer local) {
        PulseNativeCallService service = activeService;
        if (service != null && isActive(sessionId)) service.detachRenderers(remote, local);
    }

    static boolean toggleMicrophone(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.toggleMicrophoneInternal();
    }

    static boolean isMicrophoneEnabled(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.microphoneEnabled;
    }

    static List<PulseAudioRoute> getAudioRoutes(String sessionId) {
        PulseNativeCallService service = activeService;
        if (service == null || !isActive(sessionId) || service.audioRouteController == null) {
            return Collections.emptyList();
        }
        return service.audioRouteController.getRoutes();
    }

    static String getSelectedAudioRouteLabel(String sessionId) {
        PulseNativeCallService service = activeService;
        return service == null || !isActive(sessionId) || service.audioRouteController == null
            ? "Automatisch"
            : service.audioRouteController.getSelectedLabel();
    }

    static boolean selectAudioRoute(String sessionId, int routeId) {
        PulseNativeCallService service = activeService;
        return service != null
            && isActive(sessionId)
            && service.audioRouteController != null
            && service.audioRouteController.selectRoute(routeId);
    }

    static void useAutomaticAudioRoute(String sessionId) {
        PulseNativeCallService service = activeService;
        if (service != null && isActive(sessionId) && service.audioRouteController != null) {
            service.audioRouteController.useAutomaticRoute();
        }
    }

    static boolean isAudioRouteAutomatic(String sessionId) {
        PulseNativeCallService service = activeService;
        return service == null
            || !isActive(sessionId)
            || service.audioRouteController == null
            || service.audioRouteController.isAutomatic();
    }

    static boolean toggleCamera(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.toggleCameraInternal();
    }

    static boolean isCameraEnabledByUser(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.cameraLifecycle.isEnabledByUser();
    }

    static boolean isCameraCaptureActive(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.cameraLifecycle.isCaptureActive();
    }

    static void updateVideoPresentation(String sessionId, boolean visible, boolean pictureInPicture) {
        PulseNativeCallService service = activeService;
        if (service == null || !isActive(sessionId)) return;
        service.cameraLifecycle.setPresentation(visible, pictureInPicture);
        service.reconcileCameraCapture();
    }

    static boolean switchCamera(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.switchCameraInternal();
    }

    static boolean canSwitchCamera(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.canSwitchCameraInternal();
    }

    static boolean isCurrentCameraFront(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.currentCameraFront;
    }

    static boolean isConnected(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.callLifecycle.isConnected();
    }

    static boolean startAnswer(Context context, Bundle extras) {
        return start(context, ACTION_ANSWER, extras);
    }

    static boolean startOutgoing(Context context, Bundle extras) {
        return start(context, ACTION_OUTGOING, extras);
    }

    static void stop(Context context, String sessionId, boolean notifyPeer) {
        PulseNativeCallService service = activeService;
        if (context == null || service == null || !isActive(sessionId)) return;
        service.mainHandler.post(() -> service.endCall(notifyPeer, DisconnectCause.LOCAL));
    }

    private static boolean start(Context context, String action, Bundle extras) {
        if (context == null) return false;
        Intent intent = new Intent(context, PulseNativeCallService.class).setAction(action);
        if (extras != null) intent.putExtras(extras);
        try {
            ContextCompat.startForegroundService(context, intent);
            return true;
        } catch (RuntimeException error) {
            android.util.Log.e("PulseNativeCall", "Foreground service kon niet starten", error);
            return false;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureNotificationChannel();
        registerNetworkCallback();
        registerScreenReceiver();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (ACTION_ANSWER.equals(action) || ACTION_OUTGOING.equals(action)) {
            if (!callLifecycle.beginAnswer(SystemClock.elapsedRealtime(), CONNECTION_TIMEOUT_MS)) {
                return START_NOT_STICKY;
            }
        }
        sessionId = valueOrExisting(intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID), sessionId);
        fromUid = valueOrExisting(intent.getStringExtra(PulseTelecomManager.EXTRA_FROM_UID), fromUid);
        localCallerName = valueOrExisting(intent.getStringExtra(PulseTelecomManager.EXTRA_LOCAL_CALLER_NAME), localCallerName);
        conversationId = valueOrExisting(intent.getStringExtra(PulseTelecomManager.EXTRA_CONVERSATION_ID), conversationId);
        callerName = valueOrExisting(intent.getStringExtra(PulseTelecomManager.EXTRA_CALLER_NAME), callerName);
        isVideo = intent.hasExtra(PulseTelecomManager.EXTRA_IS_VIDEO)
            ? intent.getBooleanExtra(PulseTelecomManager.EXTRA_IS_VIDEO, false)
            : isVideo;

        if (ACTION_ANSWER.equals(action) || ACTION_OUTGOING.equals(action)) {
            outgoing = ACTION_OUTGOING.equals(action);
            activeSessionId = sessionId;
            activeService = this;
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                failBeforeForeground("Microfoontoegang ontbreekt");
                return START_NOT_STICKY;
            }
            if (isVideo) {
                boolean cameraGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED;
                cameraLifecycle.setEnabledByUser(cameraGranted);
            }
            if (!startForegroundCompat(buildNotification(notificationStatus))) return START_NOT_STICKY;
            armInitialConnectionTimeout();
            startAudioRouting();
            showActiveCallUi();
            authenticateAndRun(outgoing ? this::startNativeOutgoing : this::startNativeAnswer);
        }
        return START_NOT_STICKY;
    }

    private void authenticateAndRun(TokenConsumer consumer) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            failCall("Native oproepsessie is niet aangemeld");
            return;
        }
        user.getIdToken(false)
            .addOnSuccessListener(result -> consumer.accept(result.getToken()))
            .addOnFailureListener(error -> failCall("Oproepauthenticatie mislukt"));
    }

    private void startAudioRouting() {
        if (audioRouteController != null) return;
        audioRouteController = new PulseAudioRouteController(this, isVideo, (routes, selectedLabel) ->
            sendBroadcast(new Intent(ACTION_AUDIO_ROUTES_CHANGED)
                .setPackage(getPackageName())
                .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId)
                .putExtra(EXTRA_AUDIO_ROUTE_LABEL, selectedLabel))
        );
        audioRouteController.start();
    }

    private void startNativeAnswer(String token) {
        executor.execute(() -> {
            try {
                JSONObject pending = getJson(
                    API_URL + "/calls/pending/" + urlEncode(sessionId) + "?fromUid=" + urlEncode(fromUid),
                    token
                ).getJSONObject("call");
                JSONObject offer = pending.getJSONObject("offer");
                JSONArray storedCandidates = pending.optJSONArray("callerCandidates");
                List<PeerConnection.IceServer> iceServers = fetchIceServers(token);
                connectSocket(token, () -> createIncomingPeer(offer, storedCandidates, iceServers));
            } catch (Exception error) {
                android.util.Log.e("PulseNativeCall", "Oproep herstellen mislukt", error);
                failCall("Oproep kon niet worden verbonden");
            }
        });
    }

    private void startNativeOutgoing(String token) {
        executor.execute(() -> {
            try {
                List<PeerConnection.IceServer> iceServers = fetchIceServers(token);
                connectSocket(token, () -> createOutgoingPeer(iceServers));
            } catch (Exception error) {
                android.util.Log.e("PulseNativeCall", "Uitgaande oproep starten mislukt", error);
                failCall("Oproep kon niet worden gestart");
            }
        });
    }

    private void connectSocket(String token, Runnable onConnected) throws Exception {
        IO.Options options = IO.Options.builder()
            .setAuth(Collections.singletonMap("token", token))
            .setReconnection(true)
            .setForceNew(true)
            .build();
        socket = IO.socket(URI.create(API_URL), options);
        socket.on(Socket.EVENT_CONNECT, args -> {
            socket.emit("user:online");
            if (peerStarted) {
                requestNativeRecovery("socket_reconnect");
            } else {
                onConnected.run();
            }
        });
        socket.on(Socket.EVENT_CONNECT_ERROR, args -> {
            if (peerStarted) beginNetworkRecovery("socket_connect_error");
            else failCall("Signaleringsverbinding mislukt");
        });
        socket.on("call:ice-candidate", this::onRemoteCandidate);
        socket.on("call:renegotiate", this::onRenegotiate);
        socket.on("call:peer-resumed", this::onPeerResumed);
        socket.on("call:answer", this::onAnswer);
        socket.on("call:heartbeat:ack", this::onHeartbeatAck);
        socket.on("call:ended", args -> endIfCurrent(args, DisconnectCause.REMOTE));
        socket.on("call:declined", args -> endIfCurrent(args, DisconnectCause.REJECTED));
        socket.on("call:unavailable", args -> endIfCurrent(args, DisconnectCause.ERROR));
        socket.on("call:busy", args -> endIfCurrent(args, DisconnectCause.BUSY));
        socket.connect();
    }

    private boolean createPeerConnection(List<PeerConnection.IceServer> iceServers) {
        synchronized (this) {
            if (peerStarted || callLifecycle.isStopped()) return false;
            peerStarted = true;
        }
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(getApplicationContext()).createInitializationOptions()
        );
        PeerConnectionFactory.Builder factoryBuilder = PeerConnectionFactory.builder();
        if (isVideo) {
            EglBase.Context eglContext = sharedEglContext();
            factoryBuilder.setVideoEncoderFactory(new DefaultVideoEncoderFactory(eglContext, true, true));
            factoryBuilder.setVideoDecoderFactory(new DefaultVideoDecoderFactory(eglContext));
        }
        peerFactory = factoryBuilder.createPeerConnectionFactory();
        PeerConnection.RTCConfiguration configuration = new PeerConnection.RTCConfiguration(iceServers);
        configuration.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        peerConnection = peerFactory.createPeerConnection(configuration, new PeerObserver() {
            @Override
            public void onIceCandidate(IceCandidate candidate) {
                if (socket == null) return;
                JSONObject payload = signalTarget();
                JSONObject jsonCandidate = new JSONObject();
                try {
                    jsonCandidate.put("candidate", candidate.sdp);
                    jsonCandidate.put("sdpMid", candidate.sdpMid);
                    jsonCandidate.put("sdpMLineIndex", candidate.sdpMLineIndex);
                    payload.put("candidate", jsonCandidate);
                    socket.emit("call:ice-candidate", payload);
                } catch (Exception error) {
                    android.util.Log.w("PulseNativeCall", "ICE-candidate verzenden mislukt", error);
                }
            }

            @Override
            public void onConnectionChange(PeerConnection.PeerConnectionState state) {
                if (state == PeerConnection.PeerConnectionState.CONNECTED) {
                    markNativeNetworkRecovered();
                } else if (state == PeerConnection.PeerConnectionState.FAILED) {
                    requestNativeRecovery("peer_failed");
                } else if (state == PeerConnection.PeerConnectionState.DISCONNECTED) {
                    requestNativeRecovery("peer_disconnected");
                } else if (state == PeerConnection.PeerConnectionState.CLOSED) {
                    endCall(false, DisconnectCause.REMOTE);
                }
            }

            @Override
            public void onIceConnectionChange(PeerConnection.IceConnectionState state) {
                if (state == PeerConnection.IceConnectionState.CONNECTED
                    || state == PeerConnection.IceConnectionState.COMPLETED) {
                    markNativeNetworkRecovered();
                } else if (state == PeerConnection.IceConnectionState.FAILED) {
                    requestNativeRecovery("ice_failed");
                } else if (state == PeerConnection.IceConnectionState.DISCONNECTED) {
                    requestNativeRecovery("ice_disconnected");
                }
            }

            @Override
            public void onAddTrack(RtpReceiver receiver, MediaStream[] mediaStreams) {
                if (receiver.track() instanceof VideoTrack) {
                    remoteVideoTrack = (VideoTrack) receiver.track();
                    attachRemoteRenderer();
                }
            }
        });
        if (peerConnection == null) {
            failCall("WebRTC initialiseren mislukt");
            return false;
        }

        audioSource = peerFactory.createAudioSource(new MediaConstraints());
        localAudioTrack = peerFactory.createAudioTrack("pulse-audio", audioSource);
        localAudioTrack.setEnabled(microphoneEnabled);
        peerConnection.addTrack(localAudioTrack, Collections.singletonList("pulse-stream"));
        if (audioRouteController != null) mainHandler.post(audioRouteController::refresh);

        if (isVideo && !prepareLocalVideo()) return false;
        return true;
    }

    private void createIncomingPeer(JSONObject offer, JSONArray storedCandidates, List<PeerConnection.IceServer> iceServers) {
        if (!createPeerConnection(iceServers)) return;

        SessionDescription remoteOffer = new SessionDescription(SessionDescription.Type.OFFER, offer.optString("sdp"));
        peerConnection.setRemoteDescription(new SdpAdapter() {
            @Override
            public void onSetSuccess() {
                addStoredCandidates(storedCandidates);
                flushPendingRemoteCandidates();
                peerConnection.createAnswer(new SdpAdapter() {
                    @Override
                    public void onCreateSuccess(SessionDescription answer) {
                        peerConnection.setLocalDescription(new SdpAdapter() {
                            @Override
                            public void onSetSuccess() {
                                emitAnswer(answer);
                            }
                        }, answer);
                    }
                }, new MediaConstraints());
            }
        }, remoteOffer);
    }

    private void createOutgoingPeer(List<PeerConnection.IceServer> iceServers) {
        if (!createPeerConnection(iceServers)) return;
        peerConnection.createOffer(new SdpAdapter() {
            @Override
            public void onCreateSuccess(SessionDescription offer) {
                peerConnection.setLocalDescription(new SdpAdapter() {
                    @Override
                    public void onSetSuccess() {
                        emitOffer(offer);
                    }
                }, offer);
            }
        }, new MediaConstraints());
    }

    private boolean prepareLocalVideo() {
        videoCapturer = createCameraCapturer();
        videoSource = peerFactory.createVideoSource(false);
        if (videoCapturer != null) {
            surfaceTextureHelper = SurfaceTextureHelper.create("PulseCameraCapture", sharedEglContext());
            videoCapturer.initialize(surfaceTextureHelper, getApplicationContext(), videoSource.getCapturerObserver());
        } else {
            cameraLifecycle.setEnabledByUser(false);
            android.util.Log.w("PulseNativeCall", "Geen lokale camera beschikbaar; videogesprek gaat door zonder camerabeeld");
        }
        localVideoTrack = peerFactory.createVideoTrack("pulse-video", videoSource);
        localVideoTrack.setEnabled(false);
        peerConnection.addTrack(localVideoTrack, Collections.singletonList("pulse-stream"));
        attachLocalRenderer();
        reconcileCameraCapture();
        return true;
    }

    private VideoCapturer createCameraCapturer() {
        CameraEnumerator enumerator;
        try {
            enumerator = Camera2Enumerator.isSupported(this)
                ? new Camera2Enumerator(this)
                : new Camera1Enumerator(true);
        } catch (RuntimeException error) {
            android.util.Log.w("PulseNativeCall", "Camera-enumerator initialiseren mislukt", error);
            return null;
        }
        String[] deviceNames;
        try {
            deviceNames = enumerator.getDeviceNames();
        } catch (RuntimeException error) {
            android.util.Log.w("PulseNativeCall", "Cameralijst ophalen mislukt", error);
            return null;
        }
        if (deviceNames == null) deviceNames = new String[0];
        List<String> candidates = new ArrayList<>();
        for (String deviceName : deviceNames) {
            if (deviceName != null && isFrontFacing(enumerator, deviceName)) candidates.add(deviceName);
        }
        for (String deviceName : deviceNames) {
            if (deviceName != null && !candidates.contains(deviceName)) candidates.add(deviceName);
        }
        availableCameraCount = candidates.size();
        for (String deviceName : candidates) {
            try {
                VideoCapturer capturer = enumerator.createCapturer(deviceName, null);
                if (capturer != null) {
                    currentCameraFront = isFrontFacing(enumerator, deviceName);
                    return capturer;
                }
            } catch (RuntimeException error) {
                android.util.Log.w("PulseNativeCall", "Camera niet beschikbaar: " + deviceName, error);
            }
        }
        return null;
    }

    private boolean isFrontFacing(CameraEnumerator enumerator, String deviceName) {
        try {
            return enumerator.isFrontFacing(deviceName);
        } catch (RuntimeException error) {
            return false;
        }
    }

    private synchronized void attachRenderers(SurfaceViewRenderer remote, SurfaceViewRenderer local) {
        detachRenderers(remoteRenderer, localRenderer);
        remoteRenderer = remote;
        localRenderer = local;
        attachRemoteRenderer();
        attachLocalRenderer();
    }

    private synchronized void detachRenderers(SurfaceViewRenderer remote, SurfaceViewRenderer local) {
        if (remoteVideoTrack != null && remote != null) remoteVideoTrack.removeSink(remote);
        if (localVideoTrack != null && local != null) localVideoTrack.removeSink(local);
        if (remoteRenderer == remote) remoteRenderer = null;
        if (localRenderer == local) localRenderer = null;
    }

    private synchronized void attachRemoteRenderer() {
        if (remoteVideoTrack != null && remoteRenderer != null) remoteVideoTrack.addSink(remoteRenderer);
    }

    private synchronized void attachLocalRenderer() {
        if (localVideoTrack != null && localRenderer != null) {
            localRenderer.setMirror(currentCameraFront);
            localVideoTrack.addSink(localRenderer);
        }
    }

    private synchronized boolean toggleMicrophoneInternal() {
        microphoneEnabled = !microphoneEnabled;
        if (localAudioTrack != null) localAudioTrack.setEnabled(microphoneEnabled);
        return microphoneEnabled;
    }

    private synchronized boolean toggleCameraInternal() {
        boolean enabled = !cameraLifecycle.isEnabledByUser();
        if (enabled && videoCapturer == null) return false;
        if (enabled && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        cameraLifecycle.setEnabledByUser(enabled);
        reconcileCameraCapture();
        return enabled;
    }

    private synchronized boolean canSwitchCameraInternal() {
        return availableCameraCount > 1 && videoCapturer instanceof CameraVideoCapturer;
    }

    private synchronized boolean switchCameraInternal() {
        if (cameraLifecycle.isCaptureActive() && canSwitchCameraInternal()) {
            ((CameraVideoCapturer) videoCapturer).switchCamera(new CameraVideoCapturer.CameraSwitchHandler() {
                @Override
                public void onCameraSwitchDone(boolean isFrontCamera) {
                    currentCameraFront = isFrontCamera;
                    SurfaceViewRenderer renderer = localRenderer;
                    if (renderer != null) renderer.post(() -> renderer.setMirror(isFrontCamera));
                }

                @Override
                public void onCameraSwitchError(String errorDescription) {
                    android.util.Log.w("PulseNativeCall", "Camera wisselen mislukt: " + errorDescription);
                }
            });
            return true;
        }
        return false;
    }

    private synchronized void reconcileCameraCapture() {
        if (!isVideo || videoCapturer == null || localVideoTrack == null || callLifecycle.isStopped()) return;
        boolean shouldCapture = cameraLifecycle.shouldCapture();
        if (shouldCapture == cameraLifecycle.isCaptureActive()) {
            localVideoTrack.setEnabled(shouldCapture);
            updateForegroundTypes();
            return;
        }
        if (shouldCapture) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                cameraLifecycle.setEnabledByUser(false);
                localVideoTrack.setEnabled(false);
                updateForegroundTypes();
                return;
            }
            cameraCaptureStarting = true;
            if (!updateForegroundTypes()) {
                cameraCaptureStarting = false;
                return;
            }
            try {
                videoCapturer.startCapture(1280, 720, 30);
                cameraLifecycle.setCaptureActive(true);
                localVideoTrack.setEnabled(true);
            } catch (Exception error) {
                android.util.Log.e("PulseNativeCall", "Camera starten mislukt", error);
                cameraLifecycle.setCaptureActive(false);
                localVideoTrack.setEnabled(false);
            } finally {
                cameraCaptureStarting = false;
            }
        } else {
            localVideoTrack.setEnabled(false);
            try {
                videoCapturer.stopCapture();
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            } catch (RuntimeException error) {
                android.util.Log.w("PulseNativeCall", "Camera stoppen mislukt", error);
            }
            cameraLifecycle.setCaptureActive(false);
        }
        updateForegroundTypes();
    }

    private void emitOffer(SessionDescription offer) {
        if (socket == null) return;
        try {
            JSONObject signal = new JSONObject();
            signal.put("type", "offer");
            signal.put("sdp", offer.description);
            JSONObject payload = signalTarget();
            FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
            payload.put("from", user == null ? JSONObject.NULL : user.getUid());
            payload.put("offer", signal);
            payload.put("isVideo", isVideo);
            payload.put("callerName", localCallerName == null ? "Pulse-gebruiker" : localCallerName);
            socket.emit("call:offer", payload);
            armConnectionTimeout();
        } catch (Exception error) {
            failCall("Oproepaanbod versturen mislukt");
        }
    }

    private void onAnswer(Object... args) {
        if (!outgoing || peerConnection == null || args.length == 0 || !(args[0] instanceof JSONObject)) return;
        JSONObject payload = (JSONObject) args[0];
        if (!isCurrentSession(payload)) return;
        JSONObject answer = payload.optJSONObject("answer");
        if (answer == null) return;
        SessionDescription remoteAnswer = new SessionDescription(SessionDescription.Type.ANSWER, answer.optString("sdp"));
        peerConnection.setRemoteDescription(new SdpAdapter() {
            @Override
            public void onSetSuccess() {
                flushPendingRemoteCandidates();
            }
        }, remoteAnswer);
    }

    private void onHeartbeatAck(Object... args) {
        if (args.length == 0 || !(args[0] instanceof JSONObject)) return;
        JSONObject payload = (JSONObject) args[0];
        if (!isCurrentSession(payload) || payload.optBoolean("active", true)) return;
        android.util.Log.w("PulseNativeCall", "Oproepsessie is niet meer actief op de server: " + sessionId);
        endCall(false, DisconnectCause.REMOTE);
    }

    private void endIfCurrent(Object[] args, int disconnectCode) {
        if (args.length > 0 && args[0] instanceof JSONObject && !isCurrentSession((JSONObject) args[0])) return;
        endCall(false, disconnectCode);
    }

    private boolean isCurrentSession(JSONObject payload) {
        String incomingSessionId = payload == null ? null : payload.optString("sessionId", null);
        return incomingSessionId == null || incomingSessionId.isEmpty() || incomingSessionId.equals(sessionId);
    }

    private void emitAnswer(SessionDescription answer) {
        if (socket == null) return;
        try {
            JSONObject signal = new JSONObject();
            signal.put("type", "answer");
            signal.put("sdp", answer.description);
            JSONObject payload = signalTarget();
            payload.put("answer", signal);
            socket.emit("call:answer", payload);
            armConnectionTimeout();
        } catch (Exception error) {
            failCall("Antwoord versturen mislukt");
        }
    }

    private void onRenegotiate(Object... args) {
        if (peerConnection == null || args.length == 0 || !(args[0] instanceof JSONObject)) return;
        JSONObject payload = (JSONObject) args[0];
        if (!sessionId.equals(payload.optString("sessionId"))) return;
        JSONObject signal = payload.optJSONObject("signal");
        if (signal == null) return;
        SessionDescription.Type type = "offer".equals(signal.optString("type"))
            ? SessionDescription.Type.OFFER
            : SessionDescription.Type.ANSWER;
        SessionDescription description = new SessionDescription(type, signal.optString("sdp"));
        peerConnection.setRemoteDescription(new SdpAdapter() {
            @Override
            public void onSetSuccess() {
                if (type != SessionDescription.Type.OFFER) return;
                peerConnection.createAnswer(new SdpAdapter() {
                    @Override
                    public void onCreateSuccess(SessionDescription answer) {
                        peerConnection.setLocalDescription(new SdpAdapter() {
                            @Override
                            public void onSetSuccess() {
                                emitRenegotiationSignal(answer);
                            }
                        }, answer);
                    }
                }, new MediaConstraints());
            }
        }, description);
    }

    private void emitRenegotiationSignal(SessionDescription description) {
        if (socket == null) return;
        try {
            JSONObject signal = new JSONObject();
            signal.put("type", description.type.canonicalForm());
            signal.put("sdp", description.description);
            JSONObject payload = signalTarget();
            payload.put("signal", signal);
            socket.emit("call:renegotiate", payload);
        } catch (Exception error) {
            android.util.Log.w("PulseNativeCall", "Heronderhandeling versturen mislukt", error);
        }
    }

    private synchronized void beginNetworkRecovery(String source) {
        boolean recoveryStarted = callLifecycle.beginRecovery(
            peerStarted,
            SystemClock.elapsedRealtime(),
            NETWORK_RECOVERY_TIMEOUT_MS
        );
        if (recoveryStarted) {
            notificationStatus = "Opnieuw verbinden...";
            updateNotification(notificationStatus);
            sendBroadcast(new Intent(ACTION_NATIVE_CALL_RECONNECTING)
                .setPackage(getPackageName())
                .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId));
            armConnectionTimeout();
        }
        android.util.Log.i("PulseNativeCall", "Netwerkherstel gestart: " + source);
    }

    private synchronized void armConnectionTimeout() {
        mainHandler.removeCallbacks(networkRecoveryTimeout);
        if (callLifecycle.state() == PulseCallLifecycle.State.RECONNECTING) {
            mainHandler.removeCallbacks(connectionTimeout);
            mainHandler.postDelayed(networkRecoveryTimeout, NETWORK_RECOVERY_TIMEOUT_MS);
        }
    }

    private synchronized void armInitialConnectionTimeout() {
        mainHandler.removeCallbacks(connectionTimeout);
        mainHandler.postDelayed(connectionTimeout, CONNECTION_TIMEOUT_MS);
    }

    private synchronized void requestNativeRecovery(String source) {
        if (callLifecycle.isStopped() || peerConnection == null) return;
        beginNetworkRecovery(source);
        if (socket != null && socket.connected()) socket.emit("call:resume", signalTarget());
    }

    private void onPeerResumed(Object... args) {
        if (args.length == 0 || !(args[0] instanceof JSONObject)) return;
        JSONObject payload = (JSONObject) args[0];
        if (!sessionId.equals(payload.optString("sessionId"))) return;
        beginNetworkRecovery("remote_peer_resumed");
    }

    private synchronized void markNativeNetworkRecovered() {
        if (!callLifecycle.markConnected()) return;
        if (connectedAtElapsedMs == 0L) connectedAtElapsedMs = SystemClock.elapsedRealtime();
        mainHandler.removeCallbacks(networkRecoveryTimeout);
        mainHandler.removeCallbacks(connectionTimeout);
        mainHandler.removeCallbacks(callHeartbeat);
        mainHandler.post(callHeartbeat);
        notificationStatus = "Verbonden";
        updateNotification(notificationStatus);
        PulseTelecomManager.markActive(sessionId);
        if (audioRouteController != null) audioRouteController.refresh();
        sendBroadcast(new Intent(ACTION_NATIVE_CALL_CONNECTED)
            .setPackage(getPackageName())
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId));
    }

    private void registerNetworkCallback() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        connectivityManager = getSystemService(ConnectivityManager.class);
        if (connectivityManager == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onLost(Network network) {
                beginNetworkRecovery("network_lost");
            }

            @Override
            public void onAvailable(Network network) {
                if (peerStarted && !callLifecycle.isConnected()) requestNativeRecovery("network_available");
            }
        };
        try {
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
        } catch (RuntimeException error) {
            android.util.Log.w("PulseNativeCall", "Netwerkcallback registreren mislukt", error);
        }
    }

    private void addStoredCandidates(JSONArray candidates) {
        if (candidates == null || peerConnection == null) return;
        for (int index = 0; index < candidates.length(); index++) {
            JSONObject candidate = candidates.optJSONObject(index);
            IceCandidate parsed = parseCandidate(candidate);
            if (parsed != null) peerConnection.addIceCandidate(parsed);
        }
    }

    private synchronized void addOrQueueRemoteCandidate(IceCandidate candidate) {
        for (IceCandidate readyCandidate : remoteCandidateBuffer.add(candidate)) {
            if (peerConnection != null) peerConnection.addIceCandidate(readyCandidate);
        }
    }

    private synchronized void flushPendingRemoteCandidates() {
        if (peerConnection == null) return;
        List<IceCandidate> pendingCandidates = remoteCandidateBuffer.markReadyAndDrain();
        for (IceCandidate candidate : pendingCandidates) {
            peerConnection.addIceCandidate(candidate);
        }
        if (!pendingCandidates.isEmpty()) {
            android.util.Log.i(
                "PulseNativeCall",
                "Gebufferde ICE-kandidaten toegepast: " + pendingCandidates.size()
            );
        }
    }

    private void onRemoteCandidate(Object... args) {
        if (args.length == 0 || !(args[0] instanceof JSONObject)) return;
        JSONObject payload = (JSONObject) args[0];
        if (!sessionId.equals(payload.optString("sessionId"))) return;
        IceCandidate candidate = parseCandidate(payload.optJSONObject("candidate"));
        addOrQueueRemoteCandidate(candidate);
    }

    private IceCandidate parseCandidate(JSONObject candidate) {
        if (candidate == null || candidate.optString("candidate").isEmpty()) return null;
        return new IceCandidate(
            candidate.optString("sdpMid", "0"),
            candidate.optInt("sdpMLineIndex", 0),
            candidate.optString("candidate")
        );
    }

    private List<PeerConnection.IceServer> fetchIceServers(String token) {
        List<PeerConnection.IceServer> result = new ArrayList<>();
        try {
            JSONArray servers = getJson(API_URL + "/api/turn-credentials", token).optJSONArray("iceServers");
            if (servers != null) {
                for (int index = 0; index < servers.length(); index++) {
                    JSONObject server = servers.optJSONObject(index);
                    if (server == null) continue;
                    List<String> urls = new ArrayList<>();
                    Object rawUrls = server.opt("urls");
                    if (rawUrls instanceof JSONArray) {
                        JSONArray array = (JSONArray) rawUrls;
                        for (int urlIndex = 0; urlIndex < array.length(); urlIndex++) urls.add(array.optString(urlIndex));
                    } else if (rawUrls != null) {
                        urls.add(String.valueOf(rawUrls));
                    }
                    if (urls.isEmpty()) continue;
                    PeerConnection.IceServer.Builder builder = PeerConnection.IceServer.builder(urls);
                    builder.setUsername(server.optString("username", ""));
                    builder.setPassword(server.optString("credential", ""));
                    result.add(builder.createIceServer());
                }
            }
        } catch (Exception error) {
            android.util.Log.w("PulseNativeCall", "TURN-config ophalen mislukt; STUN fallback actief", error);
        }
        if (result.isEmpty()) {
            result.add(PeerConnection.IceServer.builder("stun:stun.cloudflare.com:3478").createIceServer());
            result.add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer());
        }
        return result;
    }

    private JSONObject getJson(String url, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(5_000);
        connection.setReadTimeout(7_000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
        } finally {
            connection.disconnect();
        }
        if (status < 200 || status >= 300) throw new IllegalStateException("HTTP " + status);
        return new JSONObject(body.toString());
    }

    private JSONObject signalTarget() {
        JSONObject payload = new JSONObject();
        try {
            payload.put("to", fromUid);
            payload.put("sessionId", sessionId);
        } catch (Exception ignored) {}
        return payload;
    }

    private void failCall(String message) {
        android.util.Log.e("PulseNativeCall", message);
        notificationStatus = message;
        updateNotification(notificationStatus);
        executor.execute(() -> {
            try { Thread.sleep(1_500L); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            endCall(true, DisconnectCause.ERROR);
        });
    }

    private void failBeforeForeground(String message) {
        android.util.Log.e("PulseNativeCall", message);
        callLifecycle.stop();
        if (sessionId != null && sessionId.equals(activeSessionId)) activeSessionId = null;
        if (activeService == this) activeService = null;
        sendBroadcast(new Intent(ACTION_NATIVE_CALL_FINISHED)
            .setPackage(getPackageName())
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId)
            .putExtra("error", message));
        PulseTelecomManager.finishNativeCall(sessionId, DisconnectCause.ERROR);
        stopSelf();
    }

    private synchronized void endCall(boolean notifyPeer, int disconnectCode) {
        if (!callLifecycle.stop()) return;
        mainHandler.removeCallbacks(networkRecoveryTimeout);
        mainHandler.removeCallbacks(connectionTimeout);
        mainHandler.removeCallbacks(callHeartbeat);
        if (notifyPeer && socket != null && socket.connected() && fromUid != null) {
            socket.emit("call:end", signalTarget());
        }
        emitOutgoingCallLog(disconnectCode);
        if (socket != null) {
            socket.off();
            socket.disconnect();
            socket.close();
            socket = null;
        }
        detachRenderers(remoteRenderer, localRenderer);
        if (peerConnection != null) {
            peerConnection.close();
            peerConnection.dispose();
            peerConnection = null;
        }
        remoteCandidateBuffer.reset();
        if (videoCapturer != null) {
            if (cameraLifecycle.isCaptureActive()) {
                try { videoCapturer.stopCapture(); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            }
            cameraLifecycle.setCaptureActive(false);
            videoCapturer.dispose();
            videoCapturer = null;
        }
        if (localVideoTrack != null) {
            localVideoTrack.dispose();
            localVideoTrack = null;
        }
        remoteVideoTrack = null;
        if (videoSource != null) {
            videoSource.dispose();
            videoSource = null;
        }
        if (surfaceTextureHelper != null) {
            surfaceTextureHelper.dispose();
            surfaceTextureHelper = null;
        }
        if (localAudioTrack != null) {
            localAudioTrack.dispose();
            localAudioTrack = null;
        }
        if (audioSource != null) {
            audioSource.dispose();
            audioSource = null;
        }
        if (peerFactory != null) {
            peerFactory.dispose();
            peerFactory = null;
        }
        if (audioRouteController != null) {
            audioRouteController.stop();
            audioRouteController = null;
        }
        PulseTelecomManager.finishNativeCall(sessionId, disconnectCode);
        if (sessionId != null && sessionId.equals(activeSessionId)) activeSessionId = null;
        if (activeService == this) activeService = null;
        sendBroadcast(new Intent(ACTION_NATIVE_CALL_FINISHED)
            .setPackage(getPackageName())
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private void emitOutgoingCallLog(int disconnectCode) {
        if (!outgoing || socket == null || !socket.connected() || conversationId == null) return;
        long durationSeconds = connectedAtElapsedMs == 0L
            ? 0L
            : Math.max(0L, (SystemClock.elapsedRealtime() - connectedAtElapsedMs) / 1_000L);
        String direction = connectedAtElapsedMs > 0L
            ? "completed"
            : disconnectCode == DisconnectCause.REJECTED ? "declined" : "no-answer";
        JSONObject payload = new JSONObject();
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        try {
            payload.put("convId", conversationId);
            payload.put("isVideo", isVideo);
            payload.put("direction", direction);
            payload.put("duration", durationSeconds);
            payload.put("senderId", user == null ? JSONObject.NULL : user.getUid());
            payload.put("senderName", localCallerName == null ? "Pulse-gebruiker" : localCallerName);
            socket.emit("call:log", payload);
        } catch (Exception error) {
            android.util.Log.w("PulseNativeCall", "Oproeplog versturen mislukt", error);
        }
    }

    private boolean startForegroundCompat(Notification notification) {
        int type = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            if (cameraCaptureStarting || cameraLifecycle.isCaptureActive()) {
                type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            }
        }
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
            return true;
        } catch (RuntimeException error) {
            android.util.Log.e("PulseNativeCall", "Foreground service promotie geweigerd", error);
            failBeforeForeground("Oproep kon niet op de achtergrond worden gestart");
            return false;
        }
    }

    private boolean updateForegroundTypes() {
        if (activeService == this && !callLifecycle.isStopped()) {
            return startForegroundCompat(buildNotification(notificationStatus));
        }
        return false;
    }

    private void updateNotification(String status) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(status));
    }

    private Notification buildNotification(String status) {
        Intent open = new Intent(this, isVideo ? PulseNativeVideoCallActivity.class : PulseNativeAudioCallActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId);
        open.putExtra(PulseTelecomManager.EXTRA_CALLER_NAME, callerName);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, NOTIFICATION_ID + 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent end = new Intent(this, PulseCallActionReceiver.class)
            .setAction(PulseCallActionReceiver.ACTION_END_ACTIVE)
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId)
            .putExtra("notifyPeer", true);
        PendingIntent endIntent = PendingIntent.getBroadcast(
            this, NOTIFICATION_ID + 2, end, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Person person = new Person.Builder()
            .setName(callerName == null ? "Pulse-oproep" : callerName)
            .setImportant(true)
            .build();
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_pulse_call)
            .setContentTitle(callerName == null ? "Pulse-oproep" : callerName)
            .setContentText(status)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, endIntent))
            .build();
    }

    private void showActiveCallUi() {
        if (sessionId == null) return;
        if (isVideo) {
            PulseNativeVideoCallActivity.show(this, sessionId, callerName);
        } else {
            PulseNativeAudioCallActivity.show(this, sessionId, callerName);
        }
    }

    private void registerScreenReceiver() {
        PowerManager powerManager = getSystemService(PowerManager.class);
        cameraLifecycle.setScreenInteractive(powerManager == null || powerManager.isInteractive());
        screenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    cameraLifecycle.setScreenInteractive(false);
                    reconcileCameraCapture();
                } else if (Intent.ACTION_USER_PRESENT.equals(intent.getAction())) {
                    cameraLifecycle.setScreenInteractive(true);
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        ContextCompat.registerReceiver(this, screenReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Actieve Pulse-oproepen", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Actieve beveiligde spraakoproepen");
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    private String urlEncode(String value) {
        try {
            return java.net.URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8.name());
        } catch (Exception ignored) {
            return "";
        }
    }

    private String valueOrExisting(String value, String existing) {
        return value == null || value.trim().isEmpty() ? existing : value;
    }

    @Override
    public void onDestroy() {
        if (!callLifecycle.isStopped()) endCall(false, DisconnectCause.ERROR);
        if (connectivityManager != null && networkCallback != null) {
            try { connectivityManager.unregisterNetworkCallback(networkCallback); } catch (RuntimeException ignored) {}
        }
        if (screenReceiver != null) {
            try { unregisterReceiver(screenReceiver); } catch (RuntimeException ignored) {}
            screenReceiver = null;
        }
        executor.shutdownNow();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private interface TokenConsumer {
        void accept(String token);
    }

    private abstract static class SdpAdapter implements SdpObserver {
        @Override public void onCreateSuccess(SessionDescription sessionDescription) {}
        @Override public void onSetSuccess() {}
        @Override public void onCreateFailure(String error) { android.util.Log.e("PulseNativeCall", error); }
        @Override public void onSetFailure(String error) { android.util.Log.e("PulseNativeCall", error); }
    }

    private abstract static class PeerObserver implements PeerConnection.Observer {
        @Override public void onSignalingChange(PeerConnection.SignalingState state) {}
        @Override public void onIceConnectionChange(PeerConnection.IceConnectionState state) {}
        @Override public void onIceConnectionReceivingChange(boolean receiving) {}
        @Override public void onIceGatheringChange(PeerConnection.IceGatheringState state) {}
        @Override public void onIceCandidatesRemoved(IceCandidate[] candidates) {}
        @Override public void onAddStream(MediaStream stream) {}
        @Override public void onRemoveStream(MediaStream stream) {}
        @Override public void onDataChannel(DataChannel dataChannel) {}
        @Override public void onRenegotiationNeeded() {}
        @Override public void onAddTrack(RtpReceiver receiver, MediaStream[] mediaStreams) {}
        @Override public void onIceCandidate(IceCandidate candidate) {}
    }
}
