package com.pulsemessenger.chat;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        PulseWebUpdateManager.prepareForAppStart(this);
        registerPlugin(PulseAppUpdatePlugin.class);
        registerPlugin(PulseWebUpdatePlugin.class);
        registerPlugin(PulseIncomingCallPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        PulseNativeCallService.reopenActiveCallUi();
    }
}
