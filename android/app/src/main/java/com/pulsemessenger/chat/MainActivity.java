package com.pulsemessenger.chat;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        PulseWebUpdateManager.prepareForAppStart(this);
        registerPlugin(PulseAppUpdatePlugin.class);
        registerPlugin(PulseCallPlugin.class);
        registerPlugin(PulseWebUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
