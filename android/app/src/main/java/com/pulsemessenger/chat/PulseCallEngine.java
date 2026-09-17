package com.pulsemessenger.chat;

final class PulseCallEngine {
    static final String WEBRTC_V1 = "webrtc-v1";
    static final String REALTIMEKIT_V2 = "realtimekit-v2";

    private PulseCallEngine() {}

    static String normalize(String value) {
        return REALTIMEKIT_V2.equals(value) ? REALTIMEKIT_V2 : WEBRTC_V1;
    }

    static boolean isRealtimeKit(String value) {
        return REALTIMEKIT_V2.equals(normalize(value));
    }

    static String selectOutgoing(String requestedEngine, boolean forceRealtimeKitV2) {
        return forceRealtimeKitV2 ? REALTIMEKIT_V2 : normalize(requestedEngine);
    }
}
