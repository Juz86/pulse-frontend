package com.pulsemessenger.chat;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;

import androidx.core.content.ContextCompat;

import java.util.Map;
import java.util.Set;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;

final class PulseTelecomManager {
    static final String EXTRA_SESSION_ID = "sessionId";
    static final String EXTRA_FROM_UID = "fromUid";
    static final String EXTRA_LOCAL_CALLER_NAME = "localCallerName";
    static final String EXTRA_CONVERSATION_ID = "conversationId";
    static final String EXTRA_CALLER_NAME = "callerName";
    static final String EXTRA_IS_VIDEO = "isVideo";

    private static final String PHONE_ACCOUNT_ID = "pulse-voip";
    private static final ConcurrentHashMap<String, PulseCallConnection> CONNECTIONS = new ConcurrentHashMap<>();
    private static final Set<String> RINGING_SESSIONS =
        Collections.newSetFromMap(new ConcurrentHashMap<String, Boolean>());

    private PulseTelecomManager() {}

    static boolean supportsNativeCalls() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
    }

    static void registerPhoneAccount(Context context) {
        if (context == null || !supportsNativeCalls()) return;
        TelecomManager telecom = context.getSystemService(TelecomManager.class);
        if (telecom == null) return;
        try {
            PhoneAccount account = PhoneAccount.builder(phoneAccountHandle(context), "Pulse")
                .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                .build();
            telecom.registerPhoneAccount(account);
        } catch (SecurityException error) {
            android.util.Log.w("PulseTelecom", "PhoneAccount registreren mislukt", error);
        }
    }

    static boolean showIncomingCall(Context context, Map<String, String> data) {
        if (context == null || data == null || !supportsNativeCalls()) return false;
        String sessionId = PulseIncomingCallNotifier.sessionId(data);
        String fromUid = data.get(EXTRA_FROM_UID);
        if (isBlank(sessionId) || isBlank(fromUid)) return false;
        if (CONNECTIONS.containsKey(sessionId) || !RINGING_SESSIONS.add(sessionId)) return true;

        registerPhoneAccount(context);
        TelecomManager telecom = context.getSystemService(TelecomManager.class);
        if (telecom == null) return false;

        Bundle extras = new Bundle();
        extras.putString(EXTRA_SESSION_ID, sessionId);
        extras.putString(EXTRA_FROM_UID, fromUid);
        extras.putString(EXTRA_CALLER_NAME, blankToDefault(data.get(EXTRA_CALLER_NAME), "Iemand"));
        extras.putBoolean(EXTRA_IS_VIDEO, parseBoolean(data.get(EXTRA_IS_VIDEO)));
        extras.putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, Uri.fromParts("pulse", fromUid, null));
        try {
            telecom.addNewIncomingCall(phoneAccountHandle(context), extras);
            return true;
        } catch (SecurityException | IllegalArgumentException error) {
            RINGING_SESSIONS.remove(sessionId);
            android.util.Log.w("PulseTelecom", "Inkomende Telecom-oproep registreren mislukt", error);
            return false;
        }
    }

    static boolean startOutgoingCall(Context context, Bundle callExtras) {
        if (context == null || callExtras == null) return false;
        String sessionId = callExtras.getString(EXTRA_SESSION_ID);
        String remoteUid = callExtras.getString(EXTRA_FROM_UID);
        if (isBlank(sessionId) || isBlank(remoteUid)) return false;
        if (!supportsNativeCalls()) return PulseNativeCallService.startOutgoing(context, callExtras);
        registerPhoneAccount(context);
        TelecomManager telecom = context.getSystemService(TelecomManager.class);
        if (telecom == null) return PulseNativeCallService.startOutgoing(context, callExtras);
        PhoneAccountHandle accountHandle = phoneAccountHandle(context);
        try {
            if (!telecom.isOutgoingCallPermitted(accountHandle)) {
                android.util.Log.w("PulseTelecom", "Uitgaande oproep is niet toegestaan door Telecom");
                return false;
            }
        } catch (SecurityException error) {
            android.util.Log.w("PulseTelecom", "Uitgaande oproeptoestemming controleren mislukt", error);
            return false;
        }
        Bundle telecomExtras = new Bundle();
        telecomExtras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, accountHandle);
        telecomExtras.putBundle(TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS, new Bundle(callExtras));
        try {
            telecom.placeCall(Uri.fromParts("pulse", remoteUid, null), telecomExtras);
            // placeCall() bindt ConnectionService asynchroon. Start de media-
            // service meteen na toelating, zodat een trage OEM-callback de
            // zichtbare belactie niet kan laten verdwijnen.
            PulseNativeCallService.startOutgoing(context, callExtras);
            return true;
        } catch (SecurityException | IllegalArgumentException error) {
            android.util.Log.w("PulseTelecom", "Uitgaande Telecom-oproep starten mislukt", error);
            return false;
        }
    }

    static Bundle extrasFrom(Intent intent) {
        Bundle extras = intent == null || intent.getExtras() == null ? new Bundle() : new Bundle(intent.getExtras());
        return extras;
    }

    static void attach(String sessionId, PulseCallConnection connection) {
        if (!isBlank(sessionId) && connection != null) {
            RINGING_SESSIONS.add(sessionId);
            CONNECTIONS.put(sessionId, connection);
        }
    }

    static void detach(String sessionId, PulseCallConnection connection) {
        if (!isBlank(sessionId) && connection != null) {
            CONNECTIONS.remove(sessionId, connection);
            RINGING_SESSIONS.remove(sessionId);
        }
    }

    static boolean answer(Context context, Intent intent) {
        String sessionId = intent == null ? null : intent.getStringExtra(EXTRA_SESSION_ID);
        PulseCallConnection connection = CONNECTIONS.get(sessionId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && connection != null) {
            connection.answerFromPulseUi();
            return true;
        }
        if (!isBlank(sessionId)) {
            return PulseNativeCallService.startAnswer(context, extrasFrom(intent));
        }
        return false;
    }

    static boolean hasRequiredMediaPermissions(Context context, Intent intent) {
        if (context == null) return false;
        boolean audioGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
        boolean isVideo = intent != null && intent.getBooleanExtra(EXTRA_IS_VIDEO, false);
        boolean cameraGranted = !isVideo || ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED;
        return audioGranted && cameraGranted;
    }

    static boolean decline(Context context, Intent intent) {
        String sessionId = intent == null ? null : intent.getStringExtra(EXTRA_SESSION_ID);
        PulseCallConnection connection = CONNECTIONS.get(sessionId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && connection != null) {
            connection.rejectFromPulseUi();
            return true;
        }
        if (!isBlank(sessionId)) {
            PulseTerminalCallSignal.send(extrasFrom(intent), "call:decline", null);
            return true;
        }
        return false;
    }

    static void endFromPush(Context context, String sessionId) {
        RINGING_SESSIONS.remove(sessionId);
        PulseCallConnection connection = CONNECTIONS.get(sessionId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && connection != null) connection.endFromRemote();
        PulseNativeCallService.stop(context, sessionId, false);
    }

    static void finishNativeCall(String sessionId, int disconnectCode) {
        PulseCallConnection connection = CONNECTIONS.get(sessionId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && connection != null) {
            connection.finishFromNativeService(disconnectCode);
        }
    }

    static void markActive(String sessionId) {
        PulseCallConnection connection = CONNECTIONS.get(sessionId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && connection != null) connection.markActive();
    }

    static PhoneAccountHandle phoneAccountHandle(Context context) {
        return new PhoneAccountHandle(new ComponentName(context, PulseConnectionService.class), PHONE_ACCOUNT_ID);
    }

    private static boolean parseBoolean(String value) {
        return "true".equalsIgnoreCase(value) || "1".equals(value);
    }

    private static String blankToDefault(String value, String fallback) {
        return isBlank(value) ? fallback : value;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
