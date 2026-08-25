package com.pulsemessenger.chat;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class PulseMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if ("incoming_call".equals(data.get("type"))) {
            PulseIncomingCallNotifier.show(this, data);
        }
        // Keep Capacitor's foreground push events and token lifecycle intact.
        super.onMessageReceived(remoteMessage);
    }
}
