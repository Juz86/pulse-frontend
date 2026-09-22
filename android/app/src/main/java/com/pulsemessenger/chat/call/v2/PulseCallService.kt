package com.pulsemessenger.chat.call.v2

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.telecom.DisconnectCause
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.pulsemessenger.chat.MainActivity
import com.pulsemessenger.chat.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@RequiresApi(Build.VERSION_CODES.O)
class PulseCallService : Service(), PulseTelecomCallbacks {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val coordinator = PulseCallCoordinator.instance
    private lateinit var telecom: PulseTelecomController
    private var registrationJob: Job? = null
    private var foregroundSessionId: String? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        telecom = CoreTelecomController(this)
        telecom.registerApp()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_REGISTER_CALL -> registerCall(intent)
            ACTION_SET_ACTIVE -> runForSession(intent) { sessionId ->
                if (telecom.setActive(sessionId)) coordinator.onTelecomSetActive(sessionId)
            }
            ACTION_DISCONNECT -> runForSession(intent) { sessionId ->
                telecom.disconnect(sessionId, DisconnectCause(DisconnectCause.LOCAL))
            }
            else -> stopIfIdle()
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        registrationJob?.cancel()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onRegistered(sessionId: String) {
        coordinator.onTelecomRegistered(sessionId)
    }

    override suspend fun onAnswer(sessionId: String, callType: Int) {
        coordinator.onTelecomSetActive(sessionId)
    }

    override suspend fun onDisconnect(sessionId: String, cause: DisconnectCause) {
        finishCall(sessionId, remote = cause.code != DisconnectCause.LOCAL)
    }

    override suspend fun onSetActive(sessionId: String) {
        coordinator.onTelecomSetActive(sessionId)
    }

    override suspend fun onSetInactive(sessionId: String) {
        coordinator.onTelecomSetInactive(sessionId)
    }

    private fun registerCall(intent: Intent) {
        val request = intent.toCallRequest() ?: run {
            stopIfIdle()
            return
        }
        when (coordinator.begin(request)) {
            PulseCoordinatorResult.APPLIED -> startCallForeground(request)
            PulseCoordinatorResult.IDEMPOTENT -> return
            else -> return
        }
        if (registrationJob?.isActive == true) return

        registrationJob = serviceScope.launch {
            try {
                telecom.addCall(request, this@PulseCallService)
            } catch (error: Exception) {
                Log.e(TAG, "Core-Telecom registration failed", error)
                finishCall(request.sessionId, remote = false)
            } finally {
                if (coordinator.state.value.sessionId == request.sessionId &&
                    coordinator.state.value.state !in setOf(PulseCallState.ENDING, PulseCallState.ENDED)
                ) {
                    finishCall(request.sessionId, remote = true)
                }
            }
        }
    }

    private fun runForSession(intent: Intent, block: suspend (String) -> Unit) {
        val sessionId = intent.getStringExtra(EXTRA_SESSION_ID)?.takeIf { it.isNotBlank() } ?: return
        serviceScope.launch { block(sessionId) }
    }

    private fun finishCall(sessionId: String, remote: Boolean) {
        coordinator.beginEnding(sessionId, remote)
        coordinator.completeCleanup(sessionId)
        stopCallForeground()
    }

    private fun startCallForeground(request: PulseCallRequest) {
        foregroundSessionId = request.sessionId
        val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
        } else {
            0
        }
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(request.displayName),
            serviceType,
        )
    }

    private fun stopCallForeground() {
        foregroundSessionId = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun stopIfIdle() {
        if (foregroundSessionId == null) stopSelf()
    }

    private fun buildNotification(displayName: String): Notification {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(getString(R.string.pulse_call_notification_title))
            .setContentText("$displayName · ${getString(R.string.pulse_call_notification_preparing)}")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openApp)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            getString(R.string.pulse_call_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun Intent.toCallRequest(): PulseCallRequest? {
        val sessionId = getStringExtra(EXTRA_SESSION_ID)?.takeIf { it.isNotBlank() } ?: return null
        val displayName = getStringExtra(EXTRA_DISPLAY_NAME)?.takeIf { it.isNotBlank() } ?: return null
        val direction = getStringExtra(EXTRA_DIRECTION)?.let {
            runCatching { PulseCallDirection.valueOf(it) }.getOrNull()
        } ?: return null
        val mediaType = getStringExtra(EXTRA_MEDIA_TYPE)?.let {
            runCatching { PulseCallMediaType.valueOf(it) }.getOrNull()
        } ?: PulseCallMediaType.AUDIO
        return PulseCallRequest(sessionId, displayName, direction, mediaType)
    }

    companion object {
        const val ACTION_REGISTER_CALL = "com.pulsemessenger.chat.call.v2.REGISTER_CALL"
        const val ACTION_SET_ACTIVE = "com.pulsemessenger.chat.call.v2.SET_ACTIVE"
        const val ACTION_DISCONNECT = "com.pulsemessenger.chat.call.v2.DISCONNECT"
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_DISPLAY_NAME = "display_name"
        const val EXTRA_DIRECTION = "direction"
        const val EXTRA_MEDIA_TYPE = "media_type"

        private const val TAG = "PulseCallService"
        private const val NOTIFICATION_CHANNEL_ID = "pulse_active_calls"
        private const val NOTIFICATION_ID = 4102
    }
}
