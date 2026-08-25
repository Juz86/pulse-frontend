package com.pulsemessenger.chat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

import java.util.Map;

final class PulseIncomingCallNotifier {
    private static final String CHANNEL_ID = "pulse_calls";
    private static final String EXTRA_SESSION_ID = "sessionId";
    private static final String EXTRA_FROM_UID = "fromUid";
    private static final String EXTRA_CALLER_NAME = "callerName";
    private static final String EXTRA_IS_VIDEO = "isVideo";
    private static final long RING_TIMEOUT_MS = 35_000L;

    private PulseIncomingCallNotifier() {}

    static void show(Context context, Map<String, String> data) {
        if (context == null || data == null) return;
        String sessionId = data.get(EXTRA_SESSION_ID);
        String fromUid = data.get(EXTRA_FROM_UID);
        if (isBlank(sessionId) || isBlank(fromUid)) return;

        String callerName = data.get(EXTRA_CALLER_NAME);
        if (isBlank(callerName)) callerName = "Iemand";
        boolean isVideo = "true".equalsIgnoreCase(data.get(EXTRA_IS_VIDEO)) || "1".equals(data.get(EXTRA_IS_VIDEO));
        ensureChannel(context);

        int notificationId = notificationId(sessionId);
        PendingIntent declineIntent = actionIntent(context, PulseIncomingCallStore.ACTION_DECLINE, sessionId, fromUid, callerName, isVideo, notificationId + 1);
        PendingIntent answerIntent = actionIntent(context, PulseIncomingCallStore.ACTION_ANSWER, sessionId, fromUid, callerName, isVideo, notificationId + 2);
        PendingIntent fullScreenIntent = fullScreenIntent(context, sessionId, fromUid, callerName, isVideo, notificationId + 3);

        Person caller = new Person.Builder().setName(callerName).setImportant(true).build();
        String callType = isVideo ? "Inkomend videogesprek" : "Inkomende spraakoproep";
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_pulse_call)
            .setContentTitle(callerName)
            .setContentText(callType)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(RING_TIMEOUT_MS)
            .setFullScreenIntent(fullScreenIntent, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, answerIntent));

        NotificationManagerCompat.from(context).notify(notificationId, notification.build());
    }

    static void cancel(Context context, String sessionId) {
        if (context == null || isBlank(sessionId)) return;
        NotificationManagerCompat.from(context).cancel(notificationId(sessionId));
    }

    static int notificationId(String sessionId) {
        return 41_000 + Math.abs(sessionId == null ? 0 : sessionId.hashCode() % 9_000);
    }

    private static PendingIntent actionIntent(Context context, String action, String sessionId, String fromUid, String callerName, boolean isVideo, int requestCode) {
        Intent intent = new Intent(context, PulseCallActionReceiver.class)
            .setAction(action)
            .putExtra(EXTRA_SESSION_ID, sessionId)
            .putExtra(EXTRA_FROM_UID, fromUid)
            .putExtra(EXTRA_CALLER_NAME, callerName)
            .putExtra(EXTRA_IS_VIDEO, isVideo);
        return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent fullScreenIntent(Context context, String sessionId, String fromUid, String callerName, boolean isVideo, int requestCode) {
        Intent intent = new Intent(context, PulseIncomingCallActivity.class)
            .putExtra(EXTRA_SESSION_ID, sessionId)
            .putExtra(EXTRA_FROM_UID, fromUid)
            .putExtra(EXTRA_CALLER_NAME, callerName)
            .putExtra(EXTRA_IS_VIDEO, isVideo)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Pulse oproepen", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Meldingen voor inkomende Pulse-oproepen");
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .build();
        channel.setSound(ringtone, attributes);
        manager.createNotificationChannel(channel);
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
