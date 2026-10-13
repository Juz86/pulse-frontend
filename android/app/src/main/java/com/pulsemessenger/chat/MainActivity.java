package com.pulsemessenger.chat;

import com.getcapacitor.BridgeActivity;
import android.content.res.Configuration;
import android.os.Bundle;

import com.pulsemessenger.chat.call.v2.PulseTabletCallPanelHost;

public class MainActivity extends BridgeActivity {
    private PulseTabletCallPanelHost tabletCallPanelHost;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        PulseWebUpdateManager.prepareForAppStart(this);
        registerPlugin(PulseAppUpdatePlugin.class);
        registerPlugin(PulseCallPlugin.class);
        registerPlugin(PulseWebUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        tabletCallPanelHost = new PulseTabletCallPanelHost(this);
        tabletCallPanelHost.attach();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (tabletCallPanelHost != null) {
            tabletCallPanelHost.onConfigurationChanged();
        }
    }

    @Override
    public void onDestroy() {
        if (tabletCallPanelHost != null) {
            tabletCallPanelHost.dispose();
            tabletCallPanelHost = null;
        }
        super.onDestroy();
    }
}
