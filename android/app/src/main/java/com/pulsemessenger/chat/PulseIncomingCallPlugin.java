package com.pulsemessenger.chat;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.auth.FirebaseAuth;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@CapacitorPlugin(
    name = "PulseIncomingCall",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
    }
)
public class PulseIncomingCallPlugin extends Plugin {
    private static final long OUTGOING_START_TIMEOUT_MS = 5_000L;
    private static final long OUTGOING_START_POLL_MS = 50L;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        PulseTelecomManager.registerPhoneAccount(getContext());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        notifyListeners("pendingCallChanged", new JSObject());
    }

    @PluginMethod
    public void consumePendingCall(PluginCall call) {
        call.resolve(PulseIncomingCallStore.consume(getContext()));
    }

    @PluginMethod
    public void presentIncomingCall(PluginCall call) {
        if (PulseNativeCallService.clearStaleCallIfNeeded(() -> presentIncomingCall(call))) return;
        String sessionId = call.getString("sessionId");
        String fromUid = call.getString("fromUid");
        if (sessionId == null || fromUid == null) {
            call.reject("sessionId en fromUid zijn verplicht");
            return;
        }
        Map<String, String> data = new HashMap<>();
        data.put("sessionId", sessionId);
        data.put("fromUid", fromUid);
        data.put("callerName", call.getString("callerName", "Iemand"));
        data.put("isVideo", String.valueOf(call.getBoolean("isVideo", false)));
        if (PulseNativeCallService.hasActiveCall()) {
            Bundle extras = new Bundle();
            extras.putString(PulseTelecomManager.EXTRA_SESSION_ID, sessionId);
            extras.putString(PulseTelecomManager.EXTRA_FROM_UID, fromUid);
            PulseTerminalCallSignal.send(extras, "call:busy", null);
            JSObject result = new JSObject();
            result.put("shown", false);
            result.put("busy", true);
            call.resolve(result);
            return;
        }
        boolean shown = PulseTelecomManager.showIncomingCall(getContext(), data);
        if (!shown) PulseIncomingCallNotifier.show(getContext(), data);
        JSObject result = new JSObject();
        result.put("shown", true);
        call.resolve(result);
    }

    @PluginMethod
    public void startOutgoingCall(PluginCall call) {
        if (PulseNativeCallService.clearStaleCallIfNeeded(() -> startOutgoingCall(call))) return;
        if (PulseNativeCallService.hasActiveCall()) {
            PulseNativeCallService.reopenActiveCallUi();
            call.reject("Er is al een actief gesprek");
            return;
        }
        boolean isVideo = call.getBoolean("isVideo", false);
        boolean microphoneGranted = getPermissionState("microphone") == PermissionState.GRANTED;
        boolean cameraGranted = !isVideo || getPermissionState("camera") == PermissionState.GRANTED;
        if (!microphoneGranted || !cameraGranted) {
            requestPermissionForAliases(
                isVideo ? new String[] { "microphone", "camera" } : new String[] { "microphone" },
                call,
                "outgoingPermissionsResult"
            );
            return;
        }
        startOutgoingAfterPermissions(call);
    }

    @PermissionCallback
    private void outgoingPermissionsResult(PluginCall call) {
        boolean isVideo = call.getBoolean("isVideo", false);
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microfoontoegang is nodig om te bellen");
            return;
        }
        if (isVideo && getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("Cameratoegang is nodig om te videobellen");
            return;
        }
        startOutgoingAfterPermissions(call);
    }

    private void startOutgoingAfterPermissions(PluginCall call) {
        String toUid = call.getString("toUid");
        if (toUid == null || toUid.trim().isEmpty()) {
            call.reject("toUid is verplicht");
            return;
        }
        String sessionId = "call_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8);
        Bundle extras = new Bundle();
        extras.putString(PulseTelecomManager.EXTRA_SESSION_ID, sessionId);
        extras.putString(PulseTelecomManager.EXTRA_FROM_UID, toUid);
        extras.putString(PulseTelecomManager.EXTRA_CALLER_NAME, call.getString("contactName", "Contactpersoon"));
        extras.putString(PulseTelecomManager.EXTRA_LOCAL_CALLER_NAME, call.getString("callerName", "Pulse-gebruiker"));
        extras.putString(PulseTelecomManager.EXTRA_CONVERSATION_ID, call.getString("convId"));
        extras.putBoolean(PulseTelecomManager.EXTRA_IS_VIDEO, call.getBoolean("isVideo", false));
        if (!PulseTelecomManager.startOutgoingCall(getContext(), extras)) {
            call.reject("Native oproep kon niet worden gestart");
            return;
        }
        awaitOutgoingServiceStart(call, sessionId, SystemClock.elapsedRealtime());
    }

    private void awaitOutgoingServiceStart(PluginCall call, String sessionId, long startedAtMs) {
        if (PulseNativeCallService.isActive(sessionId) && PulseNativeCallService.hasActiveCall()) {
            JSObject result = new JSObject();
            result.put("sessionId", sessionId);
            result.put("native", true);
            call.resolve(result);
            return;
        }
        if (SystemClock.elapsedRealtime() - startedAtMs >= OUTGOING_START_TIMEOUT_MS) {
            call.reject("Native oproepservice reageert niet. Probeer opnieuw.");
            return;
        }
        mainHandler.postDelayed(
            () -> awaitOutgoingServiceStart(call, sessionId, startedAtMs),
            OUTGOING_START_POLL_MS
        );
    }

    @PluginMethod
    public void provisionCallAuth(PluginCall call) {
        String customToken = call.getString("customToken");
        if (customToken == null || customToken.trim().isEmpty()) {
            call.reject("customToken is verplicht");
            return;
        }
        FirebaseAuth.getInstance().signInWithCustomToken(customToken)
            .addOnSuccessListener(result -> {
                JSObject response = new JSObject();
                response.put("ok", true);
                response.put("uid", result.getUser() == null ? "" : result.getUser().getUid());
                call.resolve(response);
            })
            .addOnFailureListener(error -> call.reject(error.getMessage() == null ? "Native oproepauthenticatie mislukt" : error.getMessage()));
    }

    @PluginMethod
    public void clearCallAuth(PluginCall call) {
        FirebaseAuth.getInstance().signOut();
        call.resolve();
    }

    @PluginMethod
    public void ensureCallNotificationAccess(PluginCall call) {
        PulseIncomingCallNotifier.prepare(getContext());
        JSObject result = new JSObject();
        result.put("notificationsEnabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());

        boolean fullScreenEnabled = true;
        boolean openedSettings = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            fullScreenEnabled = manager != null && manager.canUseFullScreenIntent();
            boolean alreadyRequested = getContext()
                .getSharedPreferences("pulse_incoming_call", android.content.Context.MODE_PRIVATE)
                .getBoolean("full_screen_access_requested", false);
            if (!fullScreenEnabled && !alreadyRequested) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
                    .setData(Uri.parse("package:" + getContext().getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                getContext().getSharedPreferences("pulse_incoming_call", android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean("full_screen_access_requested", true)
                    .apply();
                openedSettings = true;
            }
        }

        result.put("fullScreenEnabled", fullScreenEnabled);
        result.put("openedSettings", openedSettings);
        call.resolve(result);
    }
}
