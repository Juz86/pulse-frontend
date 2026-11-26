package com.pulsemessenger.chat.call.v2

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.pulsemessenger.chat.MainActivity
import com.pulsemessenger.chat.R

object PulseFriendRequestNotifications {
    private const val CHANNEL_ID = "pulse_messages"
    private const val ACTION_ACCEPT_OFFSET = 0x45A1
    private const val ACTION_DECLINE_OFFSET = 0x45A2

    fun show(context: Context, push: PulseFriendRequestPush) {
        val notification = when (push.kind) {
            PulseFriendRequestPush.Kind.INCOMING -> incomingNotification(context, push)
            PulseFriendRequestPush.Kind.ACCEPTED,
            PulseFriendRequestPush.Kind.DECLINED -> outcomeNotification(context, push)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) return
        try {
            NotificationManagerCompat.from(context).notify(notificationId(push.requestId), notification)
        } catch (_: SecurityException) {
            return
        }
    }

    fun notificationId(requestId: String): Int =
        ("friend_request:$requestId").hashCode() and Int.MAX_VALUE

    private fun incomingNotification(context: Context, push: PulseFriendRequestPush): android.app.Notification {
        val openIntent = openPulseIntent(context, push)
        return baseBuilder(context, context.getString(R.string.pulse_friend_request_title), push.body)
            .setContentIntent(openIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                context.getString(R.string.pulse_friend_request_decline),
                actionIntent(context, push.requestId, PulseFriendRequestActionReceiver.ACTION_DECLINE, ACTION_DECLINE_OFFSET),
            )
            .addAction(
                android.R.drawable.checkbox_on_background,
                context.getString(R.string.pulse_friend_request_accept),
                actionIntent(context, push.requestId, PulseFriendRequestActionReceiver.ACTION_ACCEPT, ACTION_ACCEPT_OFFSET),
            )
            .build()
    }

    private fun outcomeNotification(context: Context, push: PulseFriendRequestPush): android.app.Notification {
        val title = context.getString(
            if (push.kind == PulseFriendRequestPush.Kind.ACCEPTED) {
                R.string.pulse_friend_request_accepted_title
            } else {
                R.string.pulse_friend_request_declined_title
            },
        )
        return baseBuilder(context, title, push.body)
            .setContentIntent(openPulseIntent(context, push))
            .build()
    }

    private fun baseBuilder(context: Context, title: String, body: String): NotificationCompat.Builder =
        NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_pulse_notification)
            .setColor(context.getColor(R.color.pulse_notification_color))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)

    private fun openPulseIntent(context: Context, push: PulseFriendRequestPush): PendingIntent =
        PendingIntent.getActivity(
            context,
            notificationId(push.requestId),
            Intent(context, MainActivity::class.java).apply {
                action = "FCM_PLUGIN_ACTIVITY"
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("type", "friend_request")
                putExtra("requestId", push.requestId)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun actionIntent(
        context: Context,
        requestId: String,
        action: String,
        offset: Int,
    ): PendingIntent = PendingIntent.getBroadcast(
        context,
        notificationId(requestId) xor offset,
        Intent(context, PulseFriendRequestActionReceiver::class.java).apply {
            this.action = "com.pulsemessenger.chat.FRIEND_REQUEST_ACTION"
            putExtra(PulseFriendRequestActionReceiver.EXTRA_REQUEST_ID, requestId)
            putExtra(PulseFriendRequestActionReceiver.EXTRA_ACTION, action)
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
