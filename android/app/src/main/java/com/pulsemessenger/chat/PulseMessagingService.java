package com.pulsemessenger.chat;

import android.app.ActivityManager;
import android.content.Context;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class PulseMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data.get("type");
        if ("call_cancelled".equals(type) || "call_ended".equals(type)) {
            PulseIncomingCallNotifier.cancel(this, PulseIncomingCallNotifier.sessionId(data));
            return;
        }

        // On the foreground the socket-driven web UI is already ringing. A
        // second system CallStyle card would be noisy, so only let Android
        // render the native screen once the WebView is backgrounded.
        if ("incoming_call".equals(type)) {
            if (!isAppInForeground()) {
                PulseIncomingCallNotifier.show(this, data);
                return;
            }
        }
        // Keep Capacitor's foreground push events and token lifecycle intact.
        super.onMessageReceived(remoteMessage);
    }

    private boolean isAppInForeground() {
        ActivityManager manager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (manager == null) return false;
        String packageName = getPackageName();
        if (manager.getRunningAppProcesses() == null) return false;
        for (ActivityManager.RunningAppProcessInfo process : manager.getRunningAppProcesses()) {
            if (!packageName.equals(process.processName)) continue;
            return process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                || process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
        }
        return false;
    }
}
