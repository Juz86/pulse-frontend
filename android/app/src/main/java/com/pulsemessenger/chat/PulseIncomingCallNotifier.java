package com.pulsemessenger.chat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;

import java.util.Map;

final class PulseIncomingCallNotifier {
    static final String CHANNEL_ID = "pulse_calls_v2";
    static final String ACTION_CALL_FINISHED = "com.pulsemessenger.chat.CALL_FINISHED";
    private static final String EXTRA_SESSION_ID = "sessionId";
    private static final String EXTRA_CALL_SESSION_ID = "callSessionId";
    private static final String EXTRA_FROM_UID = "fromUid";
    private static final String EXTRA_CALLER_NAME = "callerName";
    private static final String EXTRA_IS_VIDEO = "isVideo";
    private static final long RING_TIMEOUT_MS = 35_000L;

    private PulseIncomingCallNotifier() {}

    static void show(Context context, Map<String, String> data) {
        if (context == null || data == null) return;
        String sessionId = sessionId(data);
        String fromUid = data.get(EXTRA_FROM_UID);
        if (isBlank(sessionId) || isBlank(fromUid)) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        String callerName = data.get(EXTRA_CALLER_NAME);
        if (isBlank(callerName)) callerName = "Iemand";
        boolean isVideo = "true".equalsIgnoreCase(data.get(EXTRA_IS_VIDEO)) || "1".equals(data.get(EXTRA_IS_VIDEO));
        prepare(context);

        int notificationId = notificationId(sessionId);
        PendingIntent declineIntent = actionIntent(context, PulseIncomingCallStore.ACTION_DECLINE, sessionId, fromUid, callerName, isVideo, notificationId + 1);
        PendingIntent answerIntent = actionIntent(context, PulseIncomingCallStore.ACTION_ANSWER, sessionId, fromUid, callerName, isVideo, notificationId + 2);
        PendingIntent fullScreenIntent = fullScreenIntent(context, sessionId, fromUid, callerName, isVideo, notificationId + 3);

        Person caller = new Person.Builder()
            .setName(callerName)
            .setImportant(true)
            .setIcon(IconCompat.createWithBitmap(initialsAvatar(callerName)))
            .build();
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
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(RING_TIMEOUT_MS)
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(fullScreenIntent, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, answerIntent));

        NotificationManagerCompat.from(context).notify(notificationId, notification.build());
    }

    static void cancel(Context context, String sessionId) {
        if (context == null || isBlank(sessionId)) return;
        NotificationManagerCompat.from(context).cancel(notificationId(sessionId));
        context.sendBroadcast(new Intent(ACTION_CALL_FINISHED)
            .setPackage(context.getPackageName())
            .putExtra(EXTRA_SESSION_ID, sessionId));
    }

    static String sessionId(Map<String, String> data) {
        if (data == null) return null;
        String sessionId = data.get(EXTRA_SESSION_ID);
        return isBlank(sessionId) ? data.get(EXTRA_CALL_SESSION_ID) : sessionId;
    }

    static void prepare(Context context) {
        ensureChannel(context);
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
        channel.setShowBadge(false);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0L, 700L, 450L, 700L, 450L });
        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .build();
        channel.setSound(ringtone, attributes);
        manager.createNotificationChannel(channel);
    }

    private static Bitmap initialsAvatar(String callerName) {
        int size = 192;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.rgb(106, 78, 214));
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setColor(Color.WHITE);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTextSize(72f);
        paint.setFakeBoldText(true);
        Paint.FontMetrics metrics = paint.getFontMetrics();
        float baseline = size / 2f - (metrics.ascent + metrics.descent) / 2f;
        canvas.drawText(initials(callerName), size / 2f, baseline, paint);
        return bitmap;
    }

    private static String initials(String name) {
        if (isBlank(name)) return "P";
        String[] words = name.trim().split("\\s+");
        String first = words[0].substring(0, 1);
        String second = words.length > 1 ? words[words.length - 1].substring(0, 1) : "";
        return (first + second).toUpperCase();
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
