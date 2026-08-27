package com.pulsemessenger.chat;

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
            String sessionId = PulseIncomingCallNotifier.sessionId(data);
            PulseIncomingCallNotifier.cancel(this, sessionId);
            boolean isOwnAnswerConfirmation = "answered".equals(data.get("reason"))
                && PulseNativeCallService.isActive(sessionId);
            if (!isOwnAnswerConfirmation) PulseTelecomManager.endFromPush(this, sessionId);
            return;
        }

        if ("incoming_call".equals(type)) {
            if (!PulseTelecomManager.showIncomingCall(this, data)) {
                PulseIncomingCallNotifier.show(this, data);
            }
            return;
        }
        // Keep Capacitor's foreground push events and token lifecycle intact.
        super.onMessageReceived(remoteMessage);
    }

}
