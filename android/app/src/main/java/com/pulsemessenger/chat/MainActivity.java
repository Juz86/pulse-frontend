package com.pulsemessenger.chat;

import com.getcapacitor.BridgeActivity;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;

import com.pulsemessenger.chat.call.v2.PulseCallFollowUpStore;
import com.pulsemessenger.chat.call.v2.PulseTabletCallPanelHost;

public class MainActivity extends BridgeActivity {
    public static final String ACTION_OPEN_CALL_CONTACT =
        "com.pulsemessenger.chat.OPEN_CALL_CONTACT";
    public static final String EXTRA_CALL_CONTACT_UID = "call_contact_uid";
    public static final String EXTRA_CALL_CONTACT_NAME = "call_contact_name";

    private PulseTabletCallPanelHost tabletCallPanelHost;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        captureCallContactAction(getIntent());
        PulseWebUpdateManager.prepareForAppStart(this);
        registerPlugin(PulseAppUpdatePlugin.class);
        registerPlugin(PulseCallPlugin.class);
        registerPlugin(PulseWebUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        tabletCallPanelHost = new PulseTabletCallPanelHost(this);
        tabletCallPanelHost.attach();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        captureCallContactAction(intent);
        super.onNewIntent(intent);
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

    private void captureCallContactAction(Intent intent) {
        if (intent == null || !ACTION_OPEN_CALL_CONTACT.equals(intent.getAction())) return;
        String peerUid = intent.getStringExtra(EXTRA_CALL_CONTACT_UID);
        String displayName = intent.getStringExtra(EXTRA_CALL_CONTACT_NAME);
        if (peerUid == null || displayName == null) return;
        PulseCallFollowUpStore.INSTANCE.saveMessage(this, peerUid, displayName);
    }
}
