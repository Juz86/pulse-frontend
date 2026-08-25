package com.pulsemessenger.chat;

import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.auth.FirebaseAuth;

@CapacitorPlugin(name = "PulseIncomingCall")
public class PulseIncomingCallPlugin extends Plugin {
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
