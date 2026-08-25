package com.pulsemessenger.chat;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class PulseCallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        String callAction = PulseIncomingCallStore.ACTION_ANSWER.equals(action) ? "answer" : "decline";
        PulseIncomingCallStore.save(context, intent, callAction);
        PulseIncomingCallNotifier.cancel(context, intent.getStringExtra("sessionId"));

        Intent launch = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtras(intent.getExtras() == null ? new android.os.Bundle() : intent.getExtras());
        context.startActivity(launch);
    }
}
