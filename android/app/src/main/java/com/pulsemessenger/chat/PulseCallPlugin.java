package com.pulsemessenger.chat;

import android.Manifest;
import android.app.Activity;
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
import com.pulsemessenger.chat.call.v2.PulseCallCoordinator;
import com.pulsemessenger.chat.call.v2.PulseCallMediaType;
import com.pulsemessenger.chat.call.v2.PulseCallService;
import com.pulsemessenger.chat.call.v2.PulseCallState;
import java.util.UUID;

@CapacitorPlugin(
    name = "PulseCall",
    permissions = @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = PulseCallPlugin.MICROPHONE)
)
public class PulseCallPlugin extends Plugin {
    static final String MICROPHONE = "microphone";

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("audio", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);
        result.put("video", false);
        result.put("protocolVersion", 2);
        result.put("microphonePermission", getPermissionState(MICROPHONE).toString());
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
        launchAudioCall(call);
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
        launchAudioCall(call);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private void launchAudioCall(PluginCall call) {
        String calleeUid = normalized(call.getString("calleeUid"), 128);
        String displayName = normalized(call.getString("displayName"), 160);
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
                    PulseCallMediaType.AUDIO
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
}
