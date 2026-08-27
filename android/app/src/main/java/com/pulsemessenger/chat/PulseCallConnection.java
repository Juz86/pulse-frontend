package com.pulsemessenger.chat;

import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.DisconnectCause;
import android.telecom.TelecomManager;
import android.telecom.VideoProfile;

import androidx.annotation.RequiresApi;

import java.util.HashMap;
import java.util.Map;

@RequiresApi(api = Build.VERSION_CODES.O)
final class PulseCallConnection extends Connection {
    private final Context context;
    private final Bundle callExtras;
    private final String sessionId;
    private final boolean outgoing;
    private boolean finished;

    PulseCallConnection(Context context, Bundle extras) {
        this(context, extras, false);
    }

    PulseCallConnection(Context context, Bundle extras, boolean outgoing) {
        this.context = context.getApplicationContext();
        this.callExtras = extras == null ? new Bundle() : new Bundle(extras);
        this.outgoing = outgoing;
        this.sessionId = callExtras.getString(PulseTelecomManager.EXTRA_SESSION_ID);
        String fromUid = callExtras.getString(PulseTelecomManager.EXTRA_FROM_UID, "unknown");
        String callerName = callExtras.getString(PulseTelecomManager.EXTRA_CALLER_NAME, "Iemand");
        setAddress(Uri.fromParts("pulse", fromUid, null), TelecomManager.PRESENTATION_ALLOWED);
        setCallerDisplayName(callerName, TelecomManager.PRESENTATION_ALLOWED);
        if (callExtras.getBoolean(PulseTelecomManager.EXTRA_IS_VIDEO, false)) {
            setVideoState(VideoProfile.STATE_BIDIRECTIONAL);
        }
    }

    String getSessionId() {
        return sessionId;
    }

    @Override
    public void onShowIncomingCallUi() {
        PulseIncomingCallNotifier.show(context, toDataMap(callExtras));
    }

    @Override
    public void onAnswer() {
        answerFromPulseUi();
    }

    @Override
    public void onReject() {
        rejectFromPulseUi();
    }

    @Override
    public void onDisconnect() {
        if (finished) return;
        PulseNativeCallService.stop(context, sessionId, true);
        finish(new DisconnectCause(DisconnectCause.LOCAL));
    }

    @Override
    public void onAbort() {
        PulseNativeCallService.stop(context, sessionId, true);
        finish(new DisconnectCause(DisconnectCause.CANCELED));
    }

    void answerFromPulseUi() {
        if (finished) return;
        setActive();
        PulseIncomingCallNotifier.cancel(context, sessionId);
        if (!PulseNativeCallService.startAnswer(context, callExtras)) {
            finish(new DisconnectCause(DisconnectCause.ERROR));
        }
    }

    void startOutgoingFromPulseUi() {
        if (finished || !outgoing) return;
        if (!PulseNativeCallService.startOutgoing(context, callExtras)) {
            finish(new DisconnectCause(DisconnectCause.ERROR));
        }
    }

    void markActive() {
        if (!finished) setActive();
    }

    void rejectFromPulseUi() {
        if (finished) return;
        PulseTerminalCallSignal.send(callExtras, "call:decline", null);
        finish(new DisconnectCause(DisconnectCause.REJECTED));
    }

    void endFromRemote() {
        finish(new DisconnectCause(DisconnectCause.REMOTE));
    }

    void finishFromNativeService(int disconnectCode) {
        finish(new DisconnectCause(disconnectCode));
    }

    private void finish(DisconnectCause cause) {
        if (finished) return;
        finished = true;
        PulseIncomingCallNotifier.cancel(context, sessionId);
        setDisconnected(cause);
        destroy();
        PulseTelecomManager.detach(sessionId, this);
    }

    static Map<String, String> toDataMap(Bundle extras) {
        Map<String, String> data = new HashMap<>();
        data.put("type", "incoming_call");
        data.put("sessionId", extras.getString(PulseTelecomManager.EXTRA_SESSION_ID, ""));
        data.put("callSessionId", extras.getString(PulseTelecomManager.EXTRA_SESSION_ID, ""));
        data.put("fromUid", extras.getString(PulseTelecomManager.EXTRA_FROM_UID, ""));
        data.put("callerName", extras.getString(PulseTelecomManager.EXTRA_CALLER_NAME, "Iemand"));
        data.put("isVideo", String.valueOf(extras.getBoolean(PulseTelecomManager.EXTRA_IS_VIDEO, false)));
        return data;
    }
}
