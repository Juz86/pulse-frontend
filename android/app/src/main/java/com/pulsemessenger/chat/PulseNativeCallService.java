package com.pulsemessenger.chat;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.telecom.DisconnectCause;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
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
    private static final String ACTION_DECLINE = "com.pulsemessenger.chat.NATIVE_CALL_DECLINE";
    private static final String ACTION_END = "com.pulsemessenger.chat.NATIVE_CALL_END";
    private static final String API_URL = "https://api.pulse-messenger.com";
    private static final String CHANNEL_ID = "pulse_active_calls";
    static final String ACTION_NATIVE_CALL_FINISHED = "com.pulsemessenger.chat.NATIVE_CALL_FINISHED";
    static final String ACTION_NATIVE_CALL_CONNECTED = "com.pulsemessenger.chat.NATIVE_CALL_CONNECTED";
    static final String ACTION_NATIVE_CALL_RECONNECTING = "com.pulsemessenger.chat.NATIVE_CALL_RECONNECTING";
    private static final int NOTIFICATION_ID = 42_101;
    private static final long NETWORK_RECOVERY_TIMEOUT_MS = 20_000L;
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
    private VideoSource videoSource;
    private VideoTrack localVideoTrack;
    private VideoTrack remoteVideoTrack;
    private VideoCapturer videoCapturer;
    private SurfaceTextureHelper surfaceTextureHelper;
    private SurfaceViewRenderer localRenderer;
    private SurfaceViewRenderer remoteRenderer;
    private String sessionId;
    private String fromUid;
    private String callerName;
    private boolean isVideo;
    private boolean stopping;
    private boolean peerStarted;
    private boolean answerStarted;
    private volatile boolean peerConnected;
    private boolean networkRecoveryActive;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private final Runnable networkRecoveryTimeout = () -> failCall("Netwerkverbinding kon niet worden hersteld");
    private boolean microphoneEnabled = true;
    private boolean cameraEnabled = true;

    static boolean isActive(String sessionId) {
        return sessionId != null && sessionId.equals(activeSessionId);
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

    static boolean toggleCamera(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.toggleCameraInternal();
    }

    static void switchCamera(String sessionId) {
        PulseNativeCallService service = activeService;
        if (service != null && isActive(sessionId)) service.switchCameraInternal();
    }

    static boolean isConnected(String sessionId) {
        PulseNativeCallService service = activeService;
        return service != null && isActive(sessionId) && service.peerConnected;
    }

    static void startAnswer(Context context, Bundle extras) {
        start(context, ACTION_ANSWER, extras);
    }

    static void startDecline(Context context, Bundle extras) {
        start(context, ACTION_DECLINE, extras);
    }

    static void stop(Context context, String sessionId, boolean notifyPeer) {
        if (context == null || !isActive(sessionId)) return;
        Intent intent = new Intent(context, PulseNativeCallService.class)
            .setAction(ACTION_END)
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId)
            .putExtra("notifyPeer", notifyPeer);
        ContextCompat.startForegroundService(context, intent);
    }

    private static void start(Context context, String action, Bundle extras) {
        if (context == null) return;
        Intent intent = new Intent(context, PulseNativeCallService.class).setAction(action);
        if (extras != null) intent.putExtras(extras);
        ContextCompat.startForegroundService(context, intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureNotificationChannel();
        registerNetworkCallback();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        sessionId = valueOrExisting(intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID), sessionId);
        fromUid = valueOrExisting(intent.getStringExtra(PulseTelecomManager.EXTRA_FROM_UID), fromUid);
        callerName = valueOrExisting(intent.getStringExtra(PulseTelecomManager.EXTRA_CALLER_NAME), callerName);
        isVideo = intent.hasExtra(PulseTelecomManager.EXTRA_IS_VIDEO)
            ? intent.getBooleanExtra(PulseTelecomManager.EXTRA_IS_VIDEO, false)
            : isVideo;
        String action = intent.getAction();

        if (ACTION_END.equals(action)) {
            startForegroundCompat(buildNotification("Oproep beëindigen..."), false, false);
            endCall(intent.getBooleanExtra("notifyPeer", true), DisconnectCause.LOCAL);
            return START_NOT_STICKY;
        }

        if (ACTION_DECLINE.equals(action)) {
            startForegroundCompat(buildNotification("Oproep weigeren..."), false, false);
            authenticateAndRun(token -> connectForTerminalSignal(token, "call:decline"));
            return START_NOT_STICKY;
        }

        if (ACTION_ANSWER.equals(action)) {
            if (answerStarted) return START_NOT_STICKY;
            answerStarted = true;
            activeSessionId = sessionId;
            activeService = this;
            startForegroundCompat(buildNotification("Verbinden..."), true, isVideo);
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                failCall("Microfoontoegang ontbreekt");
                return START_NOT_STICKY;
            }
            if (isVideo && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                failCall("Cameratoegang ontbreekt");
                return START_NOT_STICKY;
            }
            if (isVideo) PulseNativeVideoCallActivity.show(this, sessionId, callerName);
            authenticateAndRun(this::startNativeAnswer);
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
                connectSocket(token, () -> createPeer(offer, storedCandidates, iceServers));
            } catch (Exception error) {
                android.util.Log.e("PulseNativeCall", "Oproep herstellen mislukt", error);
                failCall("Oproep kon niet worden verbonden");
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
        socket.on("call:ended", args -> endCall(false, DisconnectCause.REMOTE));
        socket.on("call:declined", args -> endCall(false, DisconnectCause.REMOTE));
        socket.connect();
    }

    private void connectForTerminalSignal(String token, String event) {
        try {
            IO.Options options = IO.Options.builder()
                .setAuth(Collections.singletonMap("token", token))
                .setForceNew(true)
                .build();
            socket = IO.socket(URI.create(API_URL), options);
            socket.on(Socket.EVENT_CONNECT, args -> {
                socket.emit("user:online");
                socket.emit(event, signalTarget());
                executor.execute(() -> {
                    try { Thread.sleep(250L); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                    endCall(false, DisconnectCause.REJECTED);
                });
            });
            socket.on(Socket.EVENT_CONNECT_ERROR, args -> endCall(false, DisconnectCause.ERROR));
            socket.connect();
        } catch (Exception error) {
            endCall(false, DisconnectCause.ERROR);
        }
    }

    private void createPeer(JSONObject offer, JSONArray storedCandidates, List<PeerConnection.IceServer> iceServers) {
        synchronized (this) {
            if (peerStarted || stopping) return;
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
            return;
        }

        audioSource = peerFactory.createAudioSource(new MediaConstraints());
        localAudioTrack = peerFactory.createAudioTrack("pulse-audio", audioSource);
        localAudioTrack.setEnabled(microphoneEnabled);
        peerConnection.addTrack(localAudioTrack, Collections.singletonList("pulse-stream"));

        if (isVideo && !startLocalVideo()) return;

        SessionDescription remoteOffer = new SessionDescription(SessionDescription.Type.OFFER, offer.optString("sdp"));
        peerConnection.setRemoteDescription(new SdpAdapter() {
            @Override
            public void onSetSuccess() {
                addStoredCandidates(storedCandidates);
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

    private boolean startLocalVideo() {
        videoCapturer = createCameraCapturer();
        if (videoCapturer == null) {
            failCall("Geen camera beschikbaar");
            return false;
        }
        surfaceTextureHelper = SurfaceTextureHelper.create("PulseCameraCapture", sharedEglContext());
        videoSource = peerFactory.createVideoSource(false);
        videoCapturer.initialize(surfaceTextureHelper, getApplicationContext(), videoSource.getCapturerObserver());
        try {
            videoCapturer.startCapture(1280, 720, 30);
        } catch (Exception error) {
            android.util.Log.e("PulseNativeCall", "Camera starten mislukt", error);
            failCall("Camera starten mislukt");
            return false;
        }
        localVideoTrack = peerFactory.createVideoTrack("pulse-video", videoSource);
        localVideoTrack.setEnabled(cameraEnabled);
        peerConnection.addTrack(localVideoTrack, Collections.singletonList("pulse-stream"));
        attachLocalRenderer();
        return true;
    }

    private VideoCapturer createCameraCapturer() {
        CameraEnumerator enumerator = Camera2Enumerator.isSupported(this)
            ? new Camera2Enumerator(this)
            : new Camera1Enumerator(true);
        String[] deviceNames = enumerator.getDeviceNames();
        for (String deviceName : deviceNames) {
            if (!enumerator.isFrontFacing(deviceName)) continue;
            VideoCapturer capturer = enumerator.createCapturer(deviceName, null);
            if (capturer != null) return capturer;
        }
        for (String deviceName : deviceNames) {
            VideoCapturer capturer = enumerator.createCapturer(deviceName, null);
            if (capturer != null) return capturer;
        }
        return null;
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
        if (localVideoTrack != null && localRenderer != null) localVideoTrack.addSink(localRenderer);
    }

    private synchronized boolean toggleMicrophoneInternal() {
        microphoneEnabled = !microphoneEnabled;
        if (localAudioTrack != null) localAudioTrack.setEnabled(microphoneEnabled);
        return microphoneEnabled;
    }

    private synchronized boolean toggleCameraInternal() {
        cameraEnabled = !cameraEnabled;
        if (localVideoTrack != null) localVideoTrack.setEnabled(cameraEnabled);
        return cameraEnabled;
    }

    private synchronized void switchCameraInternal() {
        if (videoCapturer instanceof CameraVideoCapturer) {
            ((CameraVideoCapturer) videoCapturer).switchCamera(new CameraVideoCapturer.CameraSwitchHandler() {
                @Override
                public void onCameraSwitchDone(boolean isFrontCamera) {
                    SurfaceViewRenderer renderer = localRenderer;
                    if (renderer != null) renderer.post(() -> renderer.setMirror(isFrontCamera));
                }

                @Override
                public void onCameraSwitchError(String errorDescription) {
                    android.util.Log.w("PulseNativeCall", "Camera wisselen mislukt: " + errorDescription);
                }
            });
        }
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
        if (stopping || !peerStarted) return;
        peerConnected = false;
        if (!networkRecoveryActive) {
            networkRecoveryActive = true;
            updateNotification("Opnieuw verbinden...");
            sendBroadcast(new Intent(ACTION_NATIVE_CALL_RECONNECTING)
                .setPackage(getPackageName())
                .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId));
            mainHandler.postDelayed(networkRecoveryTimeout, NETWORK_RECOVERY_TIMEOUT_MS);
        }
        android.util.Log.i("PulseNativeCall", "Netwerkherstel gestart: " + source);
    }

    private synchronized void requestNativeRecovery(String source) {
        if (stopping || peerConnection == null) return;
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
        if (stopping || peerConnected) return;
        peerConnected = true;
        networkRecoveryActive = false;
        mainHandler.removeCallbacks(networkRecoveryTimeout);
        updateNotification("Verbonden");
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
                if (peerStarted && !peerConnected) requestNativeRecovery("network_available");
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

    private void onRemoteCandidate(Object... args) {
        if (peerConnection == null || args.length == 0 || !(args[0] instanceof JSONObject)) return;
        JSONObject payload = (JSONObject) args[0];
        if (!sessionId.equals(payload.optString("sessionId"))) return;
        IceCandidate candidate = parseCandidate(payload.optJSONObject("candidate"));
        if (candidate != null) peerConnection.addIceCandidate(candidate);
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
        updateNotification(message);
        executor.execute(() -> {
            try { Thread.sleep(1_500L); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            endCall(false, DisconnectCause.ERROR);
        });
    }

    private synchronized void endCall(boolean notifyPeer, int disconnectCode) {
        if (stopping) return;
        stopping = true;
        mainHandler.removeCallbacks(networkRecoveryTimeout);
        if (notifyPeer && socket != null && socket.connected() && fromUid != null) {
            socket.emit("call:end", signalTarget());
        }
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
        if (videoCapturer != null) {
            try { videoCapturer.stopCapture(); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
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
        PulseTelecomManager.finishNativeCall(sessionId, disconnectCode);
        if (sessionId != null && sessionId.equals(activeSessionId)) activeSessionId = null;
        if (activeService == this) activeService = null;
        peerConnected = false;
        sendBroadcast(new Intent(ACTION_NATIVE_CALL_FINISHED)
            .setPackage(getPackageName())
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId));
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void startForegroundCompat(Notification notification, boolean microphone, boolean camera) {
        int type = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (microphone) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            if (camera) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
    }

    private void updateNotification(String status) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(status));
    }

    private Notification buildNotification(String status) {
        Intent open = new Intent(this, isVideo ? PulseNativeVideoCallActivity.class : MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (isVideo) {
            open.putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId);
            open.putExtra(PulseTelecomManager.EXTRA_CALLER_NAME, callerName);
        }
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, NOTIFICATION_ID + 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent end = new Intent(this, PulseNativeCallService.class)
            .setAction(ACTION_END)
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId)
            .putExtra("notifyPeer", true);
        PendingIntent endIntent = PendingIntent.getService(
            this, NOTIFICATION_ID + 2, end, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_pulse_call)
            .setContentTitle(callerName == null ? "Pulse-oproep" : callerName)
            .setContentText(status)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .addAction(R.drawable.pulse_call_decline, "Ophangen", endIntent)
            .build();
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
        if (!stopping) endCall(false, DisconnectCause.ERROR);
        if (connectivityManager != null && networkCallback != null) {
            try { connectivityManager.unregisterNetworkCallback(networkCallback); } catch (RuntimeException ignored) {}
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
