package com.pulsemessenger.chat;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

import org.json.JSONObject;

import java.net.URI;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;

import io.socket.client.IO;
import io.socket.client.Socket;

final class PulseTerminalCallSignal {
    private static final String API_URL = "https://api.pulse-messenger.com";

    private PulseTerminalCallSignal() {}

    static void send(Bundle extras, String event, Runnable completion) {
        AtomicBoolean completed = new AtomicBoolean(false);
        Runnable finish = () -> {
            if (completed.compareAndSet(false, true) && completion != null) completion.run();
        };
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            finish.run();
            return;
        }
        user.getIdToken(false)
            .addOnSuccessListener(result -> connectAndSend(result.getToken(), extras, event, finish))
            .addOnFailureListener(error -> finish.run());
    }

    private static void connectAndSend(String token, Bundle extras, String event, Runnable finish) {
        try {
            IO.Options options = IO.Options.builder()
                .setAuth(Collections.singletonMap("token", token))
                .setForceNew(true)
                .build();
            Socket socket = IO.socket(URI.create(API_URL), options);
            Handler handler = new Handler(Looper.getMainLooper());
            Runnable close = () -> {
                socket.off();
                socket.disconnect();
                socket.close();
                finish.run();
            };
            socket.on(Socket.EVENT_CONNECT, args -> {
                JSONObject payload = new JSONObject();
                try {
                    payload.put("to", extras == null ? null : extras.getString(PulseTelecomManager.EXTRA_FROM_UID));
                    payload.put("sessionId", extras == null ? null : extras.getString(PulseTelecomManager.EXTRA_SESSION_ID));
                } catch (Exception ignored) {}
                socket.emit(event, payload);
                handler.postDelayed(close, 350L);
            });
            socket.on(Socket.EVENT_CONNECT_ERROR, args -> handler.post(close));
            handler.postDelayed(close, 4_000L);
            socket.connect();
        } catch (Exception error) {
            finish.run();
        }
    }
}
