package com.pulsemessenger.chat;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PulseAppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
