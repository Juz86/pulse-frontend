package com.pulsemessenger.chat;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.pulsemessenger.chat.call.v2.PulseCallCoordinator;
import com.pulsemessenger.chat.call.v2.PulseCallFollowUpAction;
import com.pulsemessenger.chat.call.v2.PulseCallFollowUpStore;
import com.pulsemessenger.chat.call.v2.PulseCallMediaType;
import com.pulsemessenger.chat.call.v2.PulseCallService;
import com.pulsemessenger.chat.call.v2.PulseCallState;
import com.pulsemessenger.chat.call.v2.PulseCallUiEvents;
import com.pulsemessenger.chat.call.v2.PulsePushTokenRegistrar;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.UUID;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "PulseCall",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = PulseCallPlugin.MICROPHONE),
        @Permission(strings = { Manifest.permission.CAMERA }, alias = PulseCallPlugin.CAMERA)
    }
)
public class PulseCallPlugin extends Plugin {
    static final String MICROPHONE = "microphone";
    static final String CAMERA = "camera";
    private static final String NATIVE_AUTH_CLAIM_URL =
        "https://api.pulse-messenger.com/api/calling/v2/native-auth/claim";
    private final ExecutorService authExecutor = Executors.newSingleThreadExecutor();
    private BroadcastReceiver callStatusReceiver;

    @Override
    public void load() {
        super.load();
        callStatusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!PulseCallUiEvents.ACTION_CALL_STATUS_CHANGED.equals(intent.getAction())) return;
                String status = intent.getStringExtra(PulseCallUiEvents.EXTRA_STATUS);
                String code = intent.getStringExtra(PulseCallUiEvents.EXTRA_CODE);
                String callId = intent.getStringExtra(PulseCallUiEvents.EXTRA_CALL_ID);
                if (!PulseCallUiEvents.STATUS_FAILED.equals(status) || code == null || callId == null) {
                    return;
                }
                JSObject payload = new JSObject();
                payload.put("status", status);
                payload.put("code", code);
                payload.put("callId", callId);
                notifyListeners("callStatusChanged", payload);
            }
        };
        ContextCompat.registerReceiver(
            getContext(),
            callStatusReceiver,
            new IntentFilter(PulseCallUiEvents.ACTION_CALL_STATUS_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("audio", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);
        result.put(
            "video",
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                getContext().getPackageManager().hasSystemFeature("android.hardware.camera.any")
        );
        result.put("protocolVersion", 2);
        result.put("microphonePermission", getPermissionState(MICROPHONE).toString());
        result.put("cameraPermission", getPermissionState(CAMERA).toString());
        call.resolve(result);
    }

    @PluginMethod
    public void consumeFollowUpAction(PluginCall call) {
        PulseCallFollowUpAction action = PulseCallFollowUpStore.INSTANCE.consume(getContext());
        JSObject result = new JSObject();
        if (action != null) {
            result.put("type", action.getType());
            result.put("peerUid", action.getPeerUid());
            result.put("displayName", action.getDisplayName());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void syncIdentity(PluginCall call) {
        authenticateNativeIdentity(call, user -> {
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("uid", user.getUid());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void clearIdentity(PluginCall call) {
        FirebaseAuth.getInstance().signOut();
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void startAudioCall(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Android version is not supported", "android_version_unsupported");
            return;
        }
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            requestPermissionForAlias(MICROPHONE, call, "microphonePermissionCallback");
            return;
        }
        authenticateAndLaunch(call, PulseCallMediaType.AUDIO);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Android version is not supported", "android_version_unsupported");
            return;
        }
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            call.reject("Microphone permission denied", "microphone_permission_denied");
            return;
        }
        authenticateAndLaunch(call, PulseCallMediaType.AUDIO);
    }

    @PluginMethod
    public void startVideoCall(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Android version is not supported", "android_version_unsupported");
            return;
        }
        if (!getContext().getPackageManager().hasSystemFeature("android.hardware.camera.any")) {
            call.reject("No camera is available", "camera_unavailable");
            return;
        }
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED ||
            getPermissionState(CAMERA) != PermissionState.GRANTED
        ) {
            requestPermissionForAliases(
                new String[] { MICROPHONE, CAMERA },
                call,
                "videoPermissionCallback"
            );
            return;
        }
        authenticateAndLaunch(call, PulseCallMediaType.VIDEO);
    }

    @PermissionCallback
    @RequiresApi(Build.VERSION_CODES.O)
    private void videoPermissionCallback(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            call.reject("Microphone permission denied", "microphone_permission_denied");
            return;
        }
        if (getPermissionState(CAMERA) != PermissionState.GRANTED) {
            call.reject("Camera permission denied", "camera_permission_denied");
            return;
        }
        authenticateAndLaunch(call, PulseCallMediaType.VIDEO);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private void authenticateAndLaunch(PluginCall call, PulseCallMediaType mediaType) {
        authenticateNativeIdentity(call, user -> launchCall(call, mediaType));
    }

    private void authenticateNativeIdentity(
        PluginCall call,
        NativeIdentityCallback onAuthenticated
    ) {
        String callerUid = normalized(call.getString("callerUid"), 128);
        String bootstrapCode = normalized(call.getString("bootstrapCode"), 128);
        if (callerUid == null || bootstrapCode == null) {
            call.reject("Native authentication is required", "native_auth_required");
            return;
        }
        authExecutor.execute(() -> {
            try {
                String customToken = claimCustomToken(bootstrapCode);
                FirebaseAuth.getInstance()
                    .signInWithCustomToken(customToken)
                    .addOnSuccessListener(result -> {
                        FirebaseUser user = result.getUser();
                        if (user == null || !callerUid.equals(user.getUid())) {
                            FirebaseAuth.getInstance().signOut();
                            call.reject("Native identity did not match", "native_auth_required");
                            return;
                        }
                        PulsePushTokenRegistrar.INSTANCE.registerCurrentToken(getContext());
                        onAuthenticated.onAuthenticated(user);
                    })
                    .addOnFailureListener(error ->
                        call.reject("Native authentication failed", "native_auth_required", error)
                    );
            } catch (NativeAuthException error) {
                call.reject("Native authentication failed", error.code, error);
            }
        });
    }

    private String claimCustomToken(String bootstrapCode) throws NativeAuthException {
        HttpURLConnection connection = null;
        try {
            byte[] requestBody = new JSONObject()
                .put("code", bootstrapCode)
                .toString()
                .getBytes(StandardCharsets.UTF_8);
            connection = (HttpURLConnection) new URL(NATIVE_AUTH_CLAIM_URL).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(10_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setFixedLengthStreamingMode(requestBody.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(requestBody);
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
            String responseBody = readLimited(stream, 16_384);
            if (status < 200 || status >= 300) {
                String code = status == 400 || status == 401
                    ? "native_auth_code_invalid"
                    : "native_auth_unavailable";
                throw new NativeAuthException(code);
            }
            String customToken = new JSONObject(responseBody).optString("customToken", "").trim();
            if (customToken.isEmpty()) throw new NativeAuthException("native_auth_unavailable");
            return customToken;
        } catch (NativeAuthException error) {
            throw error;
        } catch (Exception error) {
            throw new NativeAuthException("native_auth_unavailable", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String readLimited(InputStream stream, int limit) throws Exception {
        if (stream == null) return "";
        StringBuilder value = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(stream, StandardCharsets.UTF_8)
        )) {
            char[] buffer = new char[1024];
            int read;
            while ((read = reader.read(buffer)) != -1) {
                if (value.length() + read > limit) {
                    throw new NativeAuthException("native_auth_unavailable");
                }
                value.append(buffer, 0, read);
            }
        }
        return value.toString();
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private void launchCall(PluginCall call, PulseCallMediaType mediaType) {
        String calleeUid = normalized(call.getString("calleeUid"), 128);
        String displayName = normalized(call.getString("displayName"), 160);
        String photoUrl = normalizedHttpsUrl(call.getString("photoURL"));
        String requestId = normalized(call.getString("requestId"), 128);
        if (calleeUid == null || displayName == null) {
            call.reject("Call target is invalid", "invalid_call_target");
            return;
        }
        if (requestId == null) requestId = UUID.randomUUID().toString();

        PulseCallState state = PulseCallCoordinator.Companion
            .getInstance()
            .getState()
            .getValue()
            .getState();
        if (state != PulseCallState.IDLE && state != PulseCallState.ENDED) {
            call.reject("A call is already active", "call_already_active");
            return;
        }

        Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject("Pulse must be visible to start a call", "app_not_foreground");
            return;
        }

        try {
            ContextCompat.startForegroundService(
                getContext(),
                PulseCallService.Companion.outgoingIntent(
                    getContext(),
                    requestId,
                    calleeUid,
                    displayName,
                    photoUrl,
                    mediaType
                )
            );
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("requestId", requestId);
            result.put("status", "starting");
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Native call service could not start", "call_service_start_failed", error);
        }
    }

    private String normalized(String value, int maxLength) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) return null;
        return normalized;
    }

    private String normalizedHttpsUrl(String value) {
        String normalized = normalized(value, 2_048);
        if (normalized == null) return null;
        try {
            URL url = new URL(normalized);
            return "https".equalsIgnoreCase(url.getProtocol()) ? normalized : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (callStatusReceiver != null) {
            try {
                getContext().unregisterReceiver(callStatusReceiver);
            } catch (IllegalArgumentException ignored) {
                // The host may already have released the receiver.
            }
            callStatusReceiver = null;
        }
        authExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    private interface NativeIdentityCallback {
        void onAuthenticated(FirebaseUser user);
    }

    private static final class NativeAuthException extends Exception {
        final String code;

        NativeAuthException(String code) {
            super(code);
            this.code = code;
        }

        NativeAuthException(String code, Throwable cause) {
            super(code, cause);
            this.code = code;
        }
    }
}
