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
        PulseIncomingCallNotifier.cancel(context, intent.getStringExtra("sessionId"));

        boolean nativeHandled = PulseIncomingCallStore.ACTION_ANSWER.equals(action)
            ? PulseTelecomManager.answer(context, intent)
            : PulseTelecomManager.decline(context, intent);
        if (nativeHandled && !intent.getBooleanExtra("isVideo", false)) return;

        PulseIncomingCallStore.save(context, intent, callAction);

        // Weigeren gebeurt volledig vanuit de systeemmelding. Alleen opnemen
        // opent Pulse, zodat de gebruiker niet na een afwijzing in de app landt.
        if (!PulseIncomingCallStore.ACTION_ANSWER.equals(action)) return;

        Intent launch = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtras(intent.getExtras() == null ? new android.os.Bundle() : intent.getExtras());
        context.startActivity(launch);
    }
}
