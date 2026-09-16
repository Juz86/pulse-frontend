package com.pulsemessenger.chat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

final class PulseRealtimeKitCredentialsClient {
    static final String ENGINE = "realtimekit-v2";
    private static final String DEFAULT_API_URL = "https://api.pulse-messenger.com";
    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 7_000;

    static final class Credentials {
        final String authToken;
        final String sessionId;
        final boolean video;

        Credentials(String authToken, String sessionId, boolean video) {
            this.authToken = authToken;
            this.sessionId = sessionId;
            this.video = video;
        }
    }

    static final class BootstrapException extends Exception {
        final int status;
        final String code;

        BootstrapException(int status, String code) {
            super("RealtimeKit bootstrap mislukt: " + code + " (HTTP " + status + ")");
            this.status = status;
            this.code = code;
        }
    }

    private final String apiUrl;

    PulseRealtimeKitCredentialsClient() {
        this(DEFAULT_API_URL);
    }

    PulseRealtimeKitCredentialsClient(String apiUrl) {
        if (apiUrl == null || apiUrl.trim().isEmpty()) throw new IllegalArgumentException("apiUrl is required");
        this.apiUrl = trimTrailingSlash(apiUrl.trim());
    }

    Credentials fetch(String sessionId, String idToken, String name, String picture) throws Exception {
        requireValue(sessionId, "sessionId");
        requireValue(idToken, "idToken");

        HttpURLConnection connection = (HttpURLConnection) new URL(joinUrl(apiUrl, sessionId)).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setDoOutput(true);
        connection.setRequestProperty("Authorization", "Bearer " + idToken.trim());
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Cache-Control", "no-store");

        JSONObject request = new JSONObject();
        if (name != null && !name.trim().isEmpty()) request.put("name", name.trim());
        if (picture != null && !picture.trim().isEmpty()) request.put("picture", picture.trim());
        byte[] bytes = request.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(bytes);
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300
            ? connection.getInputStream()
            : connection.getErrorStream();
        String responseBody;
        try {
            responseBody = readBody(stream);
        } finally {
            connection.disconnect();
        }
        return parseResponse(status, responseBody, sessionId);
    }

    static Credentials parseResponse(int status, String responseBody, String expectedSessionId) throws Exception {
        JSONObject payload;
        try {
            payload = new JSONObject(responseBody == null || responseBody.trim().isEmpty() ? "{}" : responseBody);
        } catch (Exception error) {
            throw new BootstrapException(status, "invalid_realtimekit_response");
        }

        if (status < 200 || status >= 300) {
            throw new BootstrapException(status, payload.optString("error", "realtimekit_bootstrap_failed"));
        }
        String engine = payload.optString("engine", "");
        String authToken = payload.optString("authToken", "").trim();
        String sessionId = payload.optString("sessionId", "").trim();
        if (!ENGINE.equals(engine) || authToken.isEmpty() || !expectedSessionId.equals(sessionId)) {
            throw new BootstrapException(status, "invalid_realtimekit_response");
        }
        return new Credentials(authToken, sessionId, payload.optBoolean("isVideo", false));
    }

    static String joinUrl(String apiUrl, String sessionId) throws Exception {
        requireValue(apiUrl, "apiUrl");
        requireValue(sessionId, "sessionId");
        return trimTrailingSlash(apiUrl.trim())
            + "/api/calls/realtimekit/session/"
            + URLEncoder.encode(sessionId.trim(), StandardCharsets.UTF_8.name()).replace("+", "%20")
            + "/join";
    }

    private static String readBody(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
        }
        return body.toString();
    }

    private static String trimTrailingSlash(String value) {
        int end = value.length();
        while (end > 0 && value.charAt(end - 1) == '/') end--;
        return value.substring(0, end);
    }

    private static void requireValue(String value, String name) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(name + " is required");
    }
}
