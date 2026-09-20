package com.pulsemessenger.chat;

import android.content.Context;
import android.os.Bundle;

final class PulseCallCoordinator {
    private static final PulseCallStartGate START_GATE = new PulseCallStartGate();

    private PulseCallCoordinator() {}

    static boolean startOutgoing(Context context, Bundle extras) {
        String sessionId = sessionId(extras);
        PulseCallStartGate.Result admission = START_GATE.reserve(sessionId);
        if (admission == PulseCallStartGate.Result.ALREADY_STARTED) return true;
        if (admission != PulseCallStartGate.Result.STARTED) {
            android.util.Log.w("PulseCallCoordinator", "Uitgaande oproep geweigerd: " + admission);
            return false;
        }

        if (!PulseNativeCallService.startOutgoing(context, extras)) {
            START_GATE.release(sessionId);
            return false;
        }

        return true;
    }

    static boolean startAnswer(Context context, Bundle extras) {
        String sessionId = sessionId(extras);
        PulseCallStartGate.Result admission = START_GATE.reserve(sessionId);
        if (admission == PulseCallStartGate.Result.ALREADY_STARTED) return true;
        if (admission != PulseCallStartGate.Result.STARTED) {
            android.util.Log.w("PulseCallCoordinator", "Beantwoorden geweigerd: " + admission);
            return false;
        }
        if (PulseNativeCallService.startAnswer(context, extras)) return true;
        START_GATE.release(sessionId);
        return false;
    }

    static void end(Context context, String sessionId, boolean notifyPeer) {
        if (sessionId == null || sessionId.trim().isEmpty()) return;
        PulseNativeCallService.stop(context, sessionId, notifyPeer);
        if (!PulseNativeCallService.isActive(sessionId)) {
            START_GATE.release(sessionId);
            PulseOutgoingCallCredentials.remove(sessionId);
        }
    }

    static void launchTimedOut(String sessionId) {
        START_GATE.release(sessionId);
        PulseOutgoingCallCredentials.remove(sessionId);
    }

    static void callFinished(String sessionId) {
        START_GATE.release(sessionId);
    }

    private static String sessionId(Bundle extras) {
        return extras == null ? null : extras.getString(PulseTelecomManager.EXTRA_SESSION_ID);
    }
}
