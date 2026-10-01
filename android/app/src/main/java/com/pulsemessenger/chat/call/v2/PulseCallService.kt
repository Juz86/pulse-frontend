package com.pulsemessenger.chat.call.v2

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import com.pulsemessenger.chat.MainActivity
import com.pulsemessenger.chat.R
import java.net.URI
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@RequiresApi(Build.VERSION_CODES.O)
class PulseCallService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val coordinator = PulseCallCoordinator.instance
    private lateinit var orchestrator: PulseCallSessionOrchestrator
    private var launchJob: Job? = null
    private var stateJob: Job? = null
    private var foregroundCallId: String? = null
    private var foregroundDisplayName: String? = null
    private lateinit var networkMonitor: PulseNetworkMonitor
    private var networkMonitorStarted = false
    private var pendingNotificationAction: Pair<String, NotificationAction>? = null

    private enum class NotificationAction { ANSWER, DISCONNECT }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        val telecom = CoreTelecomController(this).also(PulseTelecomController::registerApp)
        orchestrator = PulseCallSessionOrchestrator(
            scope = serviceScope,
            identityProvider = FirebasePulseCallIdentityProvider(),
            signaling = RailwayCallSignalingClient(URI.create(CALLING_API_URL)),
            telecom = telecom,
            coordinator = coordinator,
            mediaEngineFactory = PulseCallMediaEngineFactory { WebRtcAudioEngine(this) },
            beforeMediaStart = ::promoteToMicrophoneForeground,
        )
        networkMonitor = AndroidPulseNetworkMonitor(this) {
            serviceScope.launch {
                coordinator.state.value.sessionId?.let(orchestrator::onNetworkChanged)
            }
        }
        stateJob = serviceScope.launch {
            coordinator.state.collectLatest(::onCallStateChanged)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_REGISTER_INCOMING) {
            PulseCallDiagnostics.event(
                "INCOMING_INTENT_RECEIVED",
                intent.getStringExtra(EXTRA_SESSION_ID),
            )
        }
        when (intent?.action) {
            ACTION_START_OUTGOING -> startOutgoing(intent)
            ACTION_REGISTER_INCOMING -> registerIncoming(intent)
            ACTION_ANSWER -> handleNotificationAction(intent, NotificationAction.ANSWER)
            ACTION_DISCONNECT -> handleNotificationAction(intent, NotificationAction.DISCONNECT)
            else -> stopIfIdle()
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        launchJob?.cancel()
        stateJob?.cancel()
        stopNetworkMonitoring()
        if (::orchestrator.isInitialized) {
            serviceScope.launch {
                orchestrator.shutdown()
                serviceScope.cancel()
            }
        } else {
            serviceScope.cancel()
        }
        super.onDestroy()
    }

    private fun startOutgoing(intent: Intent) {
        val requestId = intent.requiredString(EXTRA_REQUEST_ID) ?: return stopIfIdle()
        val calleeUid = intent.requiredString(EXTRA_CALLEE_UID) ?: return stopIfIdle()
        val displayName = intent.requiredString(EXTRA_DISPLAY_NAME) ?: return stopIfIdle()
        val mediaType = intent.mediaType()

        if (!startPreparingForeground(requestId, displayName)) return
        launchJob = serviceScope.launch {
            val result = runCatching {
                orchestrator.startOutgoing(requestId, calleeUid, displayName, mediaType)
            }.getOrElse { error ->
                Log.e(TAG, "Outgoing call launch failed", error)
                PulseCallLaunchResult.SIGNALING_UNAVAILABLE
            }
            handleLaunchResult(requestId, result)
        }
    }

    private fun registerIncoming(intent: Intent) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID) ?: run {
            PulseCallDiagnostics.event("INCOMING_INTENT_REJECTED", status = "MISSING_SESSION_ID")
            return stopIfIdle()
        }
        val displayName = intent.requiredString(EXTRA_DISPLAY_NAME) ?: run {
            PulseCallDiagnostics.event(
                "INCOMING_INTENT_REJECTED",
                sessionId,
                status = "MISSING_DISPLAY_NAME",
            )
            return stopIfIdle()
        }

        if (!startPreparingForeground(sessionId, displayName, incoming = true)) return
        PulseCallDiagnostics.event("INCOMING_REGISTRATION_STARTED", sessionId)
        launchJob = serviceScope.launch {
            val result = runCatching {
                orchestrator.registerIncoming(sessionId, displayName)
            }.getOrElse { error ->
                PulseCallDiagnostics.event(
                    "INCOMING_REGISTRATION_FAILED",
                    sessionId,
                    status = error.javaClass.simpleName,
                )
                Log.e(TAG, "Incoming call registration failed", error)
                PulseCallLaunchResult.SIGNALING_UNAVAILABLE
            }
            PulseCallDiagnostics.event(
                "INCOMING_REGISTRATION_RESULT",
                sessionId,
                status = result.name,
            )
            handleLaunchResult(sessionId, result)
        }
    }

    private fun handleNotificationAction(intent: Intent, action: NotificationAction) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID)
            ?: coordinator.state.value.sessionId
            ?: return stopIfIdle()
        PulseCallDiagnostics.event("NOTIFICATION_ACTION_RECEIVED", sessionId, status = action.name)
        val snapshot = coordinator.state.value
        if (snapshot.sessionId == sessionId && snapshot.telecomRegistered) {
            dispatchNotificationAction(sessionId, action)
        } else if (foregroundCallId == sessionId) {
            pendingNotificationAction = sessionId to action
            PulseCallDiagnostics.event("NOTIFICATION_ACTION_QUEUED", sessionId, status = action.name)
        } else {
            PulseCallDiagnostics.event("NOTIFICATION_ACTION_REJECTED", sessionId, status = "STALE_SESSION")
            stopIfIdle()
        }
    }

    private fun dispatchNotificationAction(sessionId: String, action: NotificationAction) {
        when (action) {
            NotificationAction.ANSWER -> orchestrator.requestAnswer(sessionId)
            NotificationAction.DISCONNECT -> orchestrator.requestDisconnect(sessionId)
        }
    }

    private fun dispatchPendingNotificationAction(snapshot: PulseCallSnapshot) {
        val pending = pendingNotificationAction ?: return
        if (snapshot.sessionId != pending.first || !snapshot.telecomRegistered) return
        pendingNotificationAction = null
        dispatchNotificationAction(pending.first, pending.second)
    }

    private fun promoteToMicrophoneForeground(): Boolean {
        if (!hasRecordAudioPermission()) {
            Log.w(TAG, "Microphone foreground promotion rejected: permission missing")
            return false
        }
        val displayName = foregroundDisplayName ?: return false
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true

        return runCatching {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(
                    displayName,
                    getString(R.string.pulse_call_notification_connecting),
                    coordinator.state.value,
                ),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL or
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )
            true
        }.getOrElse { error ->
            Log.e(TAG, "Microphone foreground promotion failed", error)
            false
        }
    }

    private fun hasRecordAudioPermission(): Boolean =
        ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED

    private fun startPreparingForeground(
        callId: String,
        displayName: String,
        incoming: Boolean = false,
    ): Boolean {
        if (foregroundCallId != null) {
            Log.i(TAG, "Ignoring duplicate call launch while another call is being handled")
            return false
        }

        foregroundCallId = callId
        foregroundDisplayName = displayName
        val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
        } else {
            0
        }
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(
                displayName,
                getString(
                    if (incoming) {
                        R.string.pulse_call_notification_incoming
                    } else {
                        R.string.pulse_call_notification_preparing
                    },
                ),
                incomingPreparing = incoming,
            ),
            serviceType,
        )
        PulseCallDiagnostics.event("CALL_FOREGROUND_STARTED", callId)
        return true
    }

    private fun handleLaunchResult(callId: String, result: PulseCallLaunchResult) {
        launchJob = null
        if (result == PulseCallLaunchResult.STARTED) {
            foregroundCallId = coordinator.state.value.sessionId ?: callId
            return
        }
        Log.w(TAG, "Call launch rejected: $result")
        stopCallForeground(callId)
    }

    private fun onCallStateChanged(snapshot: PulseCallSnapshot) {
        if (foregroundCallId == null) return
        if (snapshot.state in setOf(PulseCallState.CONNECTING, PulseCallState.ACTIVE)) {
            startNetworkMonitoring()
        } else if (snapshot.state in setOf(
                PulseCallState.IDLE,
                PulseCallState.ENDING,
                PulseCallState.ENDED,
            )
        ) {
            stopNetworkMonitoring()
        }
        if (snapshot.state == PulseCallState.ENDED) {
            stopCallForeground()
            return
        }
        if (snapshot.sessionId == null) return

        foregroundCallId = snapshot.sessionId
        val displayName = snapshot.displayName ?: foregroundDisplayName ?: return
        foregroundDisplayName = displayName
        val status = when (snapshot.state) {
            PulseCallState.IDLE, PulseCallState.PREPARING ->
                getString(R.string.pulse_call_notification_preparing)
            PulseCallState.RINGING -> if (snapshot.direction == PulseCallDirection.INCOMING) {
                getString(R.string.pulse_call_notification_incoming)
            } else {
                getString(R.string.pulse_call_notification_ringing)
            }
            PulseCallState.CONNECTING -> getString(R.string.pulse_call_notification_connecting)
            PulseCallState.ACTIVE -> getString(R.string.pulse_call_notification_active)
            PulseCallState.ENDING, PulseCallState.ENDED ->
                getString(R.string.pulse_call_notification_ending)
        }
        getSystemService(NotificationManager::class.java).notify(
            NOTIFICATION_ID,
            buildNotification(displayName, status, snapshot),
        )
        dispatchPendingNotificationAction(snapshot)
    }

    private fun stopCallForeground(expectedCallId: String? = null) {
        if (expectedCallId != null && foregroundCallId != expectedCallId) return
        foregroundCallId = null
        foregroundDisplayName = null
        pendingNotificationAction = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun stopIfIdle() {
        if (foregroundCallId == null) stopSelf()
    }

    private fun startNetworkMonitoring() {
        if (networkMonitorStarted || !::networkMonitor.isInitialized) return
        networkMonitorStarted = networkMonitor.start()
    }

    private fun stopNetworkMonitoring() {
        if (!networkMonitorStarted || !::networkMonitor.isInitialized) return
        networkMonitor.stop()
        networkMonitorStarted = false
    }

    private fun buildNotification(
        displayName: String,
        status: String,
        snapshot: PulseCallSnapshot? = null,
        incomingPreparing: Boolean = false,
    ): Notification {
        val sessionId = snapshot?.sessionId ?: foregroundCallId
        val isIncoming = incomingPreparing || snapshot?.direction == PulseCallDirection.INCOMING
        val person = Person.Builder()
            .setName(displayName)
            .setImportant(true)
            .setIcon(IconCompat.createWithBitmap(initialsAvatar(displayName)))
            .build()
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(
            this,
            if (isIncoming) INCOMING_NOTIFICATION_CHANNEL_ID else NOTIFICATION_CHANNEL_ID,
        )
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(
                if (isIncoming) displayName else getString(R.string.pulse_call_notification_title),
            )
            .setContentText(if (isIncoming) status else "$displayName · $status")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openApp)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addPerson(person)

        if (isIncoming && sessionId != null &&
            (incomingPreparing || snapshot?.state == PulseCallState.RINGING)
        ) {
            builder.setStyle(
                NotificationCompat.CallStyle.forIncomingCall(
                    person,
                    callActionIntent(ACTION_DISCONNECT, sessionId, 1),
                    callActionIntent(ACTION_ANSWER, sessionId, 2),
                ),
            )
        } else if (sessionId != null && snapshot?.telecomRegistered == true &&
            snapshot.state !in setOf(PulseCallState.ENDING, PulseCallState.ENDED)
        ) {
            builder.setStyle(
                NotificationCompat.CallStyle.forOngoingCall(
                    person,
                    callActionIntent(ACTION_DISCONNECT, sessionId, 3),
                ),
            )
        }
        return builder.build()
    }

    private fun callActionIntent(action: String, sessionId: String, offset: Int): PendingIntent =
        PendingIntent.getService(
            this,
            sessionId.hashCode() xor offset,
            Intent(this, PulseCallService::class.java)
                .setAction(action)
                .putExtra(EXTRA_SESSION_ID, sessionId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun initialsAvatar(displayName: String): Bitmap {
        val size = 192
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(106, 78, 214)
        }
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
        val initials = displayName.trim()
            .split(Regex("\\s+"))
            .filter(String::isNotBlank)
            .let { words ->
                when {
                    words.isEmpty() -> "P"
                    words.size == 1 -> words.first().take(2)
                    else -> words.first().take(1) + words.last().take(1)
                }
            }
            .uppercase()
        paint.apply {
            color = Color.WHITE
            textAlign = Paint.Align.CENTER
            textSize = 72f
            isFakeBoldText = true
        }
        val metrics = paint.fontMetrics
        val baseline = size / 2f - (metrics.ascent + metrics.descent) / 2f
        canvas.drawText(initials, size / 2f, baseline, paint)
        return bitmap
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val activeChannel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            getString(R.string.pulse_call_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(false)
        }
        val incomingChannel = NotificationChannel(
            INCOMING_NOTIFICATION_CHANNEL_ID,
            getString(R.string.pulse_incoming_call_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = getString(R.string.pulse_incoming_call_channel_description)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(false)
            enableVibration(true)
            vibrationPattern = longArrayOf(0L, 700L, 450L, 700L, 450L)
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build(),
            )
        }
        manager.createNotificationChannels(listOf(activeChannel, incomingChannel))
    }

    private fun Intent.requiredString(name: String): String? =
        getStringExtra(name)?.takeIf(String::isNotBlank)

    private fun Intent.mediaType(): PulseCallMediaType = getStringExtra(EXTRA_MEDIA_TYPE)?.let {
        runCatching { PulseCallMediaType.valueOf(it) }.getOrNull()
    } ?: PulseCallMediaType.AUDIO

    companion object {
        const val ACTION_START_OUTGOING = "com.pulsemessenger.chat.call.v2.START_OUTGOING"
        const val ACTION_REGISTER_INCOMING = "com.pulsemessenger.chat.call.v2.REGISTER_INCOMING"
        const val ACTION_ANSWER = "com.pulsemessenger.chat.call.v2.ANSWER"
        const val ACTION_DISCONNECT = "com.pulsemessenger.chat.call.v2.DISCONNECT"
        const val EXTRA_REQUEST_ID = "request_id"
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_CALLEE_UID = "callee_uid"
        const val EXTRA_DISPLAY_NAME = "display_name"
        const val EXTRA_MEDIA_TYPE = "media_type"

        private const val TAG = "PulseCallService"
        private const val CALLING_API_URL = "https://api.pulse-messenger.com"
        private const val NOTIFICATION_CHANNEL_ID = "pulse_active_calls"
        private const val INCOMING_NOTIFICATION_CHANNEL_ID = "pulse_incoming_calls_v2"
        private const val NOTIFICATION_ID = 4102

        fun outgoingIntent(
            context: Context,
            requestId: String,
            calleeUid: String,
            displayName: String,
            mediaType: PulseCallMediaType,
        ): Intent = Intent(context, PulseCallService::class.java)
            .setAction(ACTION_START_OUTGOING)
            .putExtra(EXTRA_REQUEST_ID, requestId)
            .putExtra(EXTRA_CALLEE_UID, calleeUid)
            .putExtra(EXTRA_DISPLAY_NAME, displayName)
            .putExtra(EXTRA_MEDIA_TYPE, mediaType.name)

        fun incomingIntent(
            context: Context,
            sessionId: String,
            displayName: String,
        ): Intent = Intent(context, PulseCallService::class.java)
            .setAction(ACTION_REGISTER_INCOMING)
            .putExtra(EXTRA_SESSION_ID, sessionId)
            .putExtra(EXTRA_DISPLAY_NAME, displayName)

        fun disconnectIntent(context: Context, sessionId: String): Intent =
            Intent(context, PulseCallService::class.java)
                .setAction(ACTION_DISCONNECT)
                .putExtra(EXTRA_SESSION_ID, sessionId)
    }
}
