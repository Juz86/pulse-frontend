package com.pulsemessenger.chat.call.v2

import android.content.Context
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.O)
internal class PulseIncomingCallRinger(context: Context) {
    private val applicationContext = context.applicationContext
    private val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
    private var activeCallId: String? = null
    private var ringtone: Ringtone? = null

    @Synchronized
    fun start(callId: String) {
        if (callId.isBlank() || activeCallId == callId) return
        stop()
        activeCallId = callId
        ringtone = runCatching {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            RingtoneManager.getRingtone(applicationContext, uri)?.apply {
                audioAttributes = this@PulseIncomingCallRinger.audioAttributes
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) isLooping = true
                play()
            }
        }.getOrNull()
        @Suppress("DEPRECATION")
        runCatching {
            vibrator()?.vibrate(
                VibrationEffect.createWaveform(VIBRATION_PATTERN, 0),
                audioAttributes,
            )
        }
        PulseCallDiagnostics.event("INCOMING_ALERT_STARTED", callId)
    }

    @Synchronized
    fun stop(expectedCallId: String? = null) {
        if (expectedCallId != null && activeCallId != expectedCallId) return
        val stoppedCallId = activeCallId
        activeCallId = null
        runCatching { ringtone?.stop() }
        ringtone = null
        runCatching { vibrator()?.cancel() }
        stoppedCallId?.let { PulseCallDiagnostics.event("INCOMING_ALERT_STOPPED", it) }
    }

    private fun vibrator(): Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        applicationContext.getSystemService(VibratorManager::class.java)?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        applicationContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    private companion object {
        val VIBRATION_PATTERN = longArrayOf(0L, 700L, 450L, 700L, 450L)
    }
}

internal fun PulseCallSnapshot.shouldPlayIncomingAlert(): Boolean =
    direction == PulseCallDirection.INCOMING && state == PulseCallState.RINGING
