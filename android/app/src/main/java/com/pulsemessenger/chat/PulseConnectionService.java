package com.pulsemessenger.chat;

import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.DisconnectCause;
import android.telecom.PhoneAccountHandle;

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
    public void onCreateIncomingConnectionFailed(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle extras = request == null ? null : request.getExtras();
        if (extras == null) return;
        PulseIncomingCallNotifier.show(this, PulseCallConnection.toDataMap(extras));
    }
}
