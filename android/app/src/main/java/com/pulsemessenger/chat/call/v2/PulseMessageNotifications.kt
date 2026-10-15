package com.pulsemessenger.chat.call.v2

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Shader
import android.os.Build
import androidx.appcompat.content.res.AppCompatResources
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import com.pulsemessenger.chat.MainActivity
import com.pulsemessenger.chat.R
import java.net.URL
import java.util.UUID
import javax.net.ssl.HttpsURLConnection
import kotlin.math.min

object PulseMessageNotifications {
    private const val CHANNEL_ID = "pulse_messages"
    private const val MISSED_CALL_CHANNEL_ID = "pulse_missed_calls"
    private const val AVATAR_SIZE = 192
    private const val MAX_IMAGE_BYTES = 2 * 1024 * 1024

    fun show(context: Context, push: PulseIncomingMessagePush) {
        ensureChannel(context)
        val fallbackAvatar = createInitialsAvatar(push.senderDisplayName)
        notify(context, push, addPulseBadge(context, fallbackAvatar))

        val photoUrl = push.senderPhotoUrl ?: return
        val photo = downloadAvatar(photoUrl) ?: return
        notify(context, push, addPulseBadge(context, circleCrop(photo)))
    }

    fun showMissedCall(context: Context, push: PulseTerminalCallPush) {
        val peerUid = push.peerUid ?: return
        val displayName = push.peerDisplayName ?: return
        ensureMissedCallChannel(context)
        val fallbackAvatar = addPulseBadge(context, createInitialsAvatar(displayName))
        notifyMissedCall(context, push, peerUid, displayName, fallbackAvatar)

        val photoUrl = push.peerPhotoUrl ?: return
        val photo = downloadAvatar(photoUrl) ?: return
        val avatar = addPulseBadge(context, circleCrop(photo))
        notifyMissedCall(context, push, peerUid, displayName, avatar)
    }

    private fun notify(context: Context, push: PulseIncomingMessagePush, avatar: Bitmap) {
        val sender = Person.Builder()
            .setName(push.senderDisplayName)
            .setIcon(IconCompat.createWithAdaptiveBitmap(avatar))
            .build()
        val user = Person.Builder().setName(context.getString(R.string.pulse_message_you)).build()
        val timestamp = push.sentAtMs ?: System.currentTimeMillis()
        val style = NotificationCompat.MessagingStyle(user)
            .setConversationTitle(null)
            .addMessage(push.body, timestamp, sender)

        val intent = Intent(context, MainActivity::class.java).apply {
            action = "FCM_PLUGIN_ACTIVITY"
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("google.message_id", push.messageId)
            putExtra("type", "pulse_message")
            putExtra("convId", push.conversationId)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            push.conversationId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val messageActionIntent = PendingIntent.getActivity(
            context,
            push.conversationId.hashCode() xor MESSAGE_ACTION_OFFSET,
            Intent(context, MainActivity::class.java).apply {
                action = "FCM_PLUGIN_ACTIVITY"
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("google.message_id", push.messageId)
                putExtra("type", "pulse_message")
                putExtra("convId", push.conversationId)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val callBackIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PendingIntent.getForegroundService(
                context,
                push.conversationId.hashCode() xor CALL_ACTION_OFFSET,
                PulseCallService.outgoingIntent(
                    context = context,
                    requestId = UUID.randomUUID().toString(),
                    calleeUid = push.senderUid,
                    displayName = push.senderDisplayName,
                    photoUrl = push.senderPhotoUrl,
                    mediaType = PulseCallMediaType.AUDIO,
                ),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        } else null
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_pulse_notification)
            .setColor(context.getColor(R.color.pulse_notification_color))
            .setContentTitle(push.senderDisplayName)
            .setContentText(push.body)
            .setStyle(style)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setGroup("pulse_message_${push.conversationId}")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            builder.setLargeIcon(avatar)
        }
        callBackIntent?.let {
            builder.addAction(
                android.R.drawable.sym_action_call,
                context.getString(R.string.pulse_notification_call_back),
                it,
            )
        }
        builder.addAction(
            android.R.drawable.sym_action_email,
            context.getString(R.string.pulse_notification_message),
            messageActionIntent,
        )
        val notification = builder.build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) return
        try {
            NotificationManagerCompat.from(context).notify(notificationId(push.conversationId), notification)
        } catch (_: SecurityException) {
            return
        }
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.pulse_message_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = context.getString(R.string.pulse_message_channel_description)
                enableVibration(true)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            },
        )
    }

    private fun ensureMissedCallChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(MISSED_CALL_CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                MISSED_CALL_CHANNEL_ID,
                context.getString(R.string.pulse_missed_call_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = context.getString(R.string.pulse_missed_call_channel_description)
                enableVibration(true)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            },
        )
    }

    private fun notifyMissedCall(
        context: Context,
        push: PulseTerminalCallPush,
        peerUid: String,
        displayName: String,
        avatar: Bitmap,
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val notificationText = context.getString(
            if (push.mediaType == PulseCallMediaType.VIDEO) {
                R.string.pulse_missed_video_call
            } else {
                R.string.pulse_missed_audio_call
            },
        )
        val openMessageIntent = PendingIntent.getActivity(
            context,
            push.sessionId.hashCode() xor MESSAGE_ACTION_OFFSET,
            Intent(context, MainActivity::class.java).apply {
                action = MainActivity.ACTION_OPEN_CALL_CONTACT
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(MainActivity.EXTRA_CALL_CONTACT_UID, peerUid)
                putExtra(MainActivity.EXTRA_CALL_CONTACT_NAME, displayName)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val callBackIntent = PendingIntent.getForegroundService(
            context,
            push.sessionId.hashCode() xor CALL_ACTION_OFFSET,
            PulseCallService.outgoingIntent(
                context = context,
                requestId = UUID.randomUUID().toString(),
                calleeUid = peerUid,
                displayName = displayName,
                photoUrl = push.peerPhotoUrl,
                mediaType = push.mediaType,
            ),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, MISSED_CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_pulse_notification)
            .setColor(context.getColor(R.color.pulse_notification_color))
            .setContentTitle(displayName)
            .setContentText(notificationText)
            .setLargeIcon(avatar)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openMessageIntent)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .addAction(
                android.R.drawable.sym_action_call,
                context.getString(R.string.pulse_notification_call_back),
                callBackIntent,
            )
            .addAction(
                android.R.drawable.sym_action_email,
                context.getString(R.string.pulse_notification_message),
                openMessageIntent,
            )
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) return
        try {
            NotificationManagerCompat.from(context).notify(missedCallNotificationId(peerUid), notification)
        } catch (_: SecurityException) {
            return
        }
    }

    private fun createInitialsAvatar(displayName: String): Bitmap {
        val bitmap = Bitmap.createBitmap(AVATAR_SIZE, AVATAR_SIZE, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(109, 74, 221) }
        canvas.drawCircle(AVATAR_SIZE / 2f, AVATAR_SIZE / 2f, AVATAR_SIZE / 2f, paint)
        val initials = displayName
            .split(Regex("\\s+"))
            .filter(String::isNotBlank)
            .take(2)
            .mapNotNull { it.firstOrNull()?.uppercaseChar() }
            .joinToString("")
            .ifBlank { "P" }
        paint.apply {
            color = Color.WHITE
            textAlign = Paint.Align.CENTER
            textSize = 70f
            isFakeBoldText = true
        }
        val baseline = AVATAR_SIZE / 2f - (paint.ascent() + paint.descent()) / 2f
        canvas.drawText(initials, AVATAR_SIZE / 2f, baseline, paint)
        return bitmap
    }

    private fun circleCrop(source: Bitmap): Bitmap {
        val size = min(source.width, source.height)
        val left = (source.width - size) / 2
        val top = (source.height - size) / 2
        val square = Bitmap.createBitmap(source, left, top, size, size)
        val output = Bitmap.createBitmap(AVATAR_SIZE, AVATAR_SIZE, Bitmap.Config.ARGB_8888)
        val shader = BitmapShader(square, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        val scale = AVATAR_SIZE.toFloat() / size
        val matrix = android.graphics.Matrix().apply { setScale(scale, scale) }
        shader.setLocalMatrix(matrix)
        Canvas(output).drawCircle(
            AVATAR_SIZE / 2f,
            AVATAR_SIZE / 2f,
            AVATAR_SIZE / 2f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { this.shader = shader },
        )
        if (square !== source) square.recycle()
        return output
    }

    private fun addPulseBadge(context: Context, avatar: Bitmap): Bitmap {
        val output = avatar.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(output)
        val badgeSize = 62f
        val badgeOuterRadius = badgeSize / 2f + 5f
        val centerX = AVATAR_SIZE - badgeOuterRadius - 16f
        val centerY = AVATAR_SIZE - badgeOuterRadius - 16f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.color = Color.WHITE
        canvas.drawCircle(centerX, centerY, badgeOuterRadius, paint)
        paint.color = context.getColor(R.color.pulse_notification_color)
        canvas.drawCircle(centerX, centerY, badgeSize / 2f, paint)
        AppCompatResources.getDrawable(context, R.drawable.ic_pulse_notification)?.let { icon ->
            val inset = 10
            val left = (centerX - badgeSize / 2f + inset).toInt()
            val top = (centerY - badgeSize / 2f + inset).toInt()
            val right = (centerX + badgeSize / 2f - inset).toInt()
            val bottom = (centerY + badgeSize / 2f - inset).toInt()
            icon.bounds = Rect(left, top, right, bottom)
            icon.draw(canvas)
        }
        return output
    }

    private fun downloadAvatar(value: String): Bitmap? {
        val url = runCatching { URL(value) }.getOrNull() ?: return null
        if (!url.protocol.equals("https", ignoreCase = true)) return null
        val connection = runCatching { url.openConnection() as HttpsURLConnection }.getOrNull() ?: return null
        return try {
            connection.connectTimeout = 3_000
            connection.readTimeout = 3_000
            connection.instanceFollowRedirects = false
            connection.connect()
            if (connection.responseCode !in 200..299) return null
            val declaredLength = connection.contentLengthLong
            if (declaredLength > MAX_IMAGE_BYTES) return null
            val bytes = connection.inputStream.use { stream ->
                val buffer = ByteArray(8_192)
                val output = java.io.ByteArrayOutputStream()
                var total = 0
                while (true) {
                    val count = stream.read(buffer)
                    if (count < 0) break
                    total += count
                    if (total > MAX_IMAGE_BYTES) return null
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun notificationId(conversationId: String): Int =
        0x40000000 or (conversationId.hashCode() and 0x3fffffff)

    private fun missedCallNotificationId(peerUid: String): Int =
        0x50000000 or (peerUid.hashCode() and 0x0fffffff)

    private const val CALL_ACTION_OFFSET = 0x1357
    private const val MESSAGE_ACTION_OFFSET = 0x2468
}
