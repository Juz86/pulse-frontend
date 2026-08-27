package com.pulsemessenger.chat;

import android.os.Build;
import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.DisconnectCause;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;

import androidx.annotation.RequiresApi;

@RequiresApi(api = Build.VERSION_CODES.O)
public class PulseConnectionService extends ConnectionService {
    @Override
    public Connection onCreateIncomingConnection(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle extras = request == null || request.getExtras() == null ? new Bundle() : request.getExtras();
        PulseCallConnection connection = new PulseCallConnection(this, extras);
        connection.setConnectionProperties(Connection.PROPERTY_SELF_MANAGED);
        connection.setAudioModeIsVoip(true);
        connection.setRinging();
        PulseTelecomManager.attach(connection.getSessionId(), connection);
        return connection;
    }

    @Override
    public Connection onCreateOutgoingConnection(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle requestExtras = request == null || request.getExtras() == null ? new Bundle() : request.getExtras();
        Bundle nestedExtras = requestExtras.getBundle(TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS);
        Bundle extras = nestedExtras == null ? requestExtras : nestedExtras;
        PulseCallConnection connection = new PulseCallConnection(this, extras, true);
        connection.setConnectionProperties(Connection.PROPERTY_SELF_MANAGED);
        connection.setAudioModeIsVoip(true);
        connection.setDialing();
        PulseTelecomManager.attach(connection.getSessionId(), connection);
        connection.startOutgoingFromPulseUi();
        return connection;
    }

    @Override
    public void onCreateOutgoingConnectionFailed(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle requestExtras = request == null || request.getExtras() == null ? new Bundle() : request.getExtras();
        Bundle nestedExtras = requestExtras.getBundle(TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS);
        PulseNativeCallService.startOutgoing(this, nestedExtras == null ? requestExtras : nestedExtras);
    }

    @Override
    public void onCreateIncomingConnectionFailed(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle extras = request == null ? null : request.getExtras();
        if (extras == null) return;
        PulseIncomingCallNotifier.show(this, PulseCallConnection.toDataMap(extras));
    }
}
