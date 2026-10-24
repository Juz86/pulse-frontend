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
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.pulsemessenger.chat.BuildConfig
import androidx.core.graphics.drawable.IconCompat
import com.pulsemessenger.chat.R
import java.io.ByteArrayOutputStream
import java.net.URI
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@RequiresApi(Build.VERSION_CODES.O)
class PulseCallService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val coordinator = PulseCallCoordinator.instance
    private lateinit var orchestrator: PulseCallSessionOrchestrator
    private var launchJob: Job? = null
    private var terminalJob: Job? = null
    private var stateJob: Job? = null
    private var foregroundCallId: String? = null
    private var foregroundDisplayName: String? = null
    private var foregroundPhotoUrl: String? = null
    private var foregroundAvatar: Bitmap? = null
    private var foregroundMediaType = PulseCallMediaType.AUDIO
    private var avatarJob: Job? = null
    private var callUiOpenedForId: String? = null
    private lateinit var networkMonitor: PulseNetworkMonitor
    private lateinit var recoveryStore: PulseCallRecoveryStore
    private lateinit var incomingCallRinger: PulseIncomingCallRinger
    private var networkMonitorStarted = false
    private var pendingNotificationAction: Pair<String, NotificationAction>? = null

    private enum class NotificationAction { ANSWER, DISCONNECT }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        recoveryStore = PulseCallRecoveryStore(this)
        incomingCallRinger = PulseIncomingCallRinger(this)

        val telecom = CoreTelecomController(this).also(PulseTelecomController::registerApp)
        orchestrator = PulseCallSessionOrchestrator(
            scope = serviceScope,
            identityProvider = FirebasePulseCallIdentityProvider(this),
            signaling = RailwayCallSignalingClient(URI.create(CALLING_API_URL)),
            telecom = telecom,
            coordinator = coordinator,
            mediaEngineFactory = PulseCallMediaEngineFactory { WebRtcAudioEngine(this) },
            mediaIdentityBinder = if (BuildConfig.PULSE_CALL_E2EE_ENABLED) {
                NativePulseCallE2eeIdentityBinder(this)
            } else {
                null
            },
            beforeMediaStart = ::promoteToMediaForeground,
            onRecoveryRecordChanged = { record ->
                if (record == null) recoveryStore.clear() else recoveryStore.save(record)
            },
            onCallFailure = { sessionId, reason ->
                PulseCallUiEvents.reportFailure(this, sessionId, reason)
            },
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
            ACTION_SELECT_AUDIO_ROUTE -> selectAudioRoute(intent)
            ACTION_TOGGLE_MUTE -> toggleMute(intent)
            ACTION_TOGGLE_VIDEO -> toggleVideo(intent)
            ACTION_SWITCH_CAMERA -> switchCamera(intent)
            ACTION_RECONCILE_TERMINAL -> reconcileTerminal(intent)
            ACTION_RECONCILE_TAKEN_ELSEWHERE -> reconcileTakenElsewhere(intent)
            null -> recoverPersistedCall()
            else -> stopIfIdle()
        }
        return if (foregroundCallId != null || recoveryStore.hasRecord()) {
            START_STICKY
        } else {
            START_NOT_STICKY
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopIncomingAlert()
        avatarJob?.cancel()
        launchJob?.cancel()
        terminalJob?.cancel()
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
        val photoUrl = intent.safePhotoUrl(EXTRA_PHOTO_URL)
        val mediaType = intent.mediaType()

        if (!startPreparingForeground(
                requestId,
                displayName,
                mediaType = mediaType,
                photoUrl = photoUrl,
            )
        ) return
        launchJob = serviceScope.launch {
            val result = runCatching {
                orchestrator.startOutgoing(requestId, calleeUid, displayName, photoUrl, mediaType)
            }.getOrElse { error ->
                Log.e(TAG, "Outgoing call launch failed", error)
                PulseCallLaunchResult.SIGNALING_UNAVAILABLE
            }
            handleLaunchResult(requestId, result, notifyUi = true)
        }
    }

    private fun recoverPersistedCall() {
        if (launchJob?.isActive == true) return
        val record = recoveryStore.load() ?: return stopIfIdle()
        if (foregroundCallId == null && !startPreparingForeground(
                callId = record.sessionId,
                displayName = record.displayName,
                incoming = record.direction == PulseCallDirection.INCOMING,
                mediaType = record.mediaType,
                photoUrl = record.photoUrl,
            )
        ) return
        if (foregroundCallId != record.sessionId) return
        PulseCallDiagnostics.event(
            "CALL_RECOVERY_STARTED",
            record.sessionId,
            direction = record.direction,
        )
        launchJob = serviceScope.launch {
            val result = runCatching { orchestrator.recover(record) }.getOrElse { error ->
                Log.e(TAG, "Call recovery failed", error)
                PulseCallRecoveryResult.SIGNALING_UNAVAILABLE
            }
            PulseCallDiagnostics.event(
                "CALL_RECOVERY_RESULT",
                record.sessionId,
                status = result.name,
            )
            if (result == PulseCallRecoveryResult.SIGNALING_UNAVAILABLE) {
                delay(RECOVERY_RETRY_DELAY_MS)
                launchJob = null
                recoverPersistedCall()
            } else if (result != PulseCallRecoveryResult.RECOVERED) {
                launchJob = null
                recoveryStore.clear(record.sessionId)
                stopCallForeground(record.sessionId)
            } else {
                launchJob = null
            }
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
        val photoUrl = intent.safePhotoUrl(EXTRA_PHOTO_URL)
        val mediaType = intent.mediaType()

        if (!startPreparingForeground(
                sessionId,
                displayName,
                incoming = true,
                mediaType = mediaType,
                photoUrl = photoUrl,
            )
        ) return
        PulseCallDiagnostics.event("INCOMING_REGISTRATION_STARTED", sessionId)
        launchJob = serviceScope.launch {
            val result = runCatching {
                orchestrator.registerIncoming(sessionId, displayName, photoUrl)
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
            handleLaunchResult(sessionId, result, notifyUi = false)
        }
    }

    private fun reconcileTerminal(intent: Intent) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID) ?: return stopIfIdle()
        stopIncomingAlert(sessionId)
        val current = coordinator.state.value
        if (current.sessionId != null && current.sessionId != sessionId &&
            current.state !in setOf(PulseCallState.IDLE, PulseCallState.ENDED)
        ) {
            PulseCallDiagnostics.event(
                "TERMINAL_RECONCILIATION_REJECTED",
                sessionId,
                status = "DIFFERENT_ACTIVE_SESSION",
            )
            return
        }
        val reconciliationOnly = foregroundCallId == null
        if (!startTerminalReconciliationForeground(sessionId)) return

        terminalJob?.cancel()
        terminalJob = serviceScope.launch {
            val result = try {
                orchestrator.reconcileTerminal(sessionId)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                Log.e(TAG, "Terminal call reconciliation failed", error)
                PulseTerminalReconcileResult.SIGNALING_UNAVAILABLE
            }
            PulseCallDiagnostics.event(
                "TERMINAL_RECONCILIATION_RESULT",
                sessionId,
                status = result.name,
            )
            if (result in setOf(
                    PulseTerminalReconcileResult.RECONCILED,
                    PulseTerminalReconcileResult.VERIFIED_ENDED,
                )
            ) {
                recoveryStore.clear(sessionId)
            }
            terminalJob = null
            if (reconciliationOnly) {
                stopCallForeground(sessionId)
            }
        }
    }

    private fun reconcileTakenElsewhere(intent: Intent) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID) ?: return stopIfIdle()
        stopIncomingAlert(sessionId)
        val acceptedInstallationId = intent.requiredString(EXTRA_ACCEPTED_INSTALLATION_ID)
            ?: return stopIfIdle()
        val reconciliationOnly = foregroundCallId == null
        if (!startTerminalReconciliationForeground(sessionId)) return

        terminalJob?.cancel()
        terminalJob = serviceScope.launch {
            val result = try {
                orchestrator.reconcileTakenElsewhere(sessionId, acceptedInstallationId)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                Log.e(TAG, "Taken-elsewhere reconciliation failed", error)
                PulseTakenElsewhereReconcileResult.REJECTED
            }
            PulseCallDiagnostics.event(
                "TAKEN_ELSEWHERE_RECONCILIATION_RESULT",
                sessionId,
                status = result.name,
            )
            if (result in setOf(
                    PulseTakenElsewhereReconcileResult.RECONCILED,
                    PulseTakenElsewhereReconcileResult.VERIFIED_NO_LOCAL_CALL,
                )
            ) {
                recoveryStore.clear(sessionId)
            }
            terminalJob = null
            if (reconciliationOnly) stopCallForeground(sessionId)
        }
    }

    private fun handleNotificationAction(intent: Intent, action: NotificationAction) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID)
            ?: coordinator.state.value.sessionId
            ?: return stopIfIdle()
        stopIncomingAlert(sessionId)
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

    private fun selectAudioRoute(intent: Intent) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID) ?: return
        val routeId = intent.requiredString(EXTRA_AUDIO_ROUTE_ID) ?: return
        orchestrator.requestAudioRoute(sessionId, routeId)
    }

    private fun toggleMute(intent: Intent) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID) ?: return
        orchestrator.requestToggleMute(sessionId)
    }

    private fun toggleVideo(intent: Intent) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID) ?: return
        orchestrator.requestToggleVideo(sessionId)
    }

    private fun switchCamera(intent: Intent) {
        val sessionId = intent.requiredString(EXTRA_SESSION_ID) ?: return
        orchestrator.requestSwitchCamera(sessionId)
    }

    private fun dispatchPendingNotificationAction(snapshot: PulseCallSnapshot) {
        val pending = pendingNotificationAction ?: return
        if (snapshot.sessionId != pending.first || !snapshot.telecomRegistered) return
        pendingNotificationAction = null
        dispatchNotificationAction(pending.first, pending.second)
    }

    private fun promoteToMediaForeground(): Boolean {
        if (!hasRecordAudioPermission()) {
            Log.w(TAG, "Microphone foreground promotion rejected: permission missing")
            return false
        }
        val videoCall = coordinator.state.value.mediaType == PulseCallMediaType.VIDEO
        if (videoCall && !hasCameraPermission()) {
            Log.w(TAG, "Camera foreground promotion rejected: permission missing")
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
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                    if (videoCall) ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA else 0,
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

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA,
        ) == PackageManager.PERMISSION_GRANTED

    private fun startPreparingForeground(
        callId: String,
        displayName: String,
        incoming: Boolean = false,
        mediaType: PulseCallMediaType = PulseCallMediaType.AUDIO,
        photoUrl: String? = null,
    ): Boolean {
        if (foregroundCallId != null) {
            Log.i(TAG, "Ignoring duplicate call launch while another call is being handled")
            return false
        }

        foregroundCallId = callId
        foregroundDisplayName = displayName
        foregroundPhotoUrl = photoUrl
        foregroundAvatar = null
        foregroundMediaType = mediaType
        if (incoming) incomingCallRinger.start(callId) else stopIncomingAlert()
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
                        incomingNotificationTextResource(mediaType)
                    } else {
                        R.string.pulse_call_notification_preparing
                    },
                ),
                incomingPreparing = incoming,
            ),
            serviceType,
        )
        if (photoUrl != null) loadForegroundAvatar(callId, displayName, photoUrl, incoming)
        PulseCallDiagnostics.event("CALL_FOREGROUND_STARTED", callId)
        return true
    }

    private fun startTerminalReconciliationForeground(sessionId: String): Boolean {
        if (foregroundCallId != null && foregroundCallId != sessionId) return false
        foregroundCallId = sessionId
        foregroundDisplayName = getString(R.string.pulse_call_notification_title)
        val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
        } else {
            0
        }
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(
                requireNotNull(foregroundDisplayName),
                getString(R.string.pulse_call_notification_ending),
            ),
            serviceType,
        )
        PulseCallDiagnostics.event("TERMINAL_RECONCILIATION_FOREGROUND_STARTED", sessionId)
        return true
    }

    private fun handleLaunchResult(
        callId: String,
        result: PulseCallLaunchResult,
        notifyUi: Boolean,
    ) {
        launchJob = null
        if (result == PulseCallLaunchResult.STARTED) {
            foregroundCallId = coordinator.state.value.sessionId ?: callId
            return
        }
        Log.w(TAG, "Call launch rejected: $result")
        if (notifyUi) {
            PulseCallUiEvents.reportFailure(this, callId, result.uiErrorCode())
        }
        stopCallForeground(callId)
    }

    private fun PulseCallLaunchResult.uiErrorCode(): String = when (this) {
        PulseCallLaunchResult.BUSY -> "call_already_active"
        PulseCallLaunchResult.AUTH_REQUIRED -> "native_auth_required"
        PulseCallLaunchResult.RATE_LIMITED -> "call_rate_limited"
        PulseCallLaunchResult.SIGNALING_UNAVAILABLE -> "call_signaling_unavailable"
        PulseCallLaunchResult.REJECTED -> "call_rejected"
        PulseCallLaunchResult.STARTED -> error("A started call has no UI error")
    }

    private fun onCallStateChanged(snapshot: PulseCallSnapshot) {
        if (foregroundCallId == null) return
        if (snapshot.shouldPlayIncomingAlert()) {
            snapshot.sessionId?.let(incomingCallRinger::start)
        } else {
            stopIncomingAlert()
        }
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
        foregroundMediaType = snapshot.mediaType ?: foregroundMediaType
        val photoUrl = snapshot.photoUrl ?: foregroundPhotoUrl
        if (photoUrl != foregroundPhotoUrl) {
            foregroundPhotoUrl = photoUrl
            foregroundAvatar = null
            if (photoUrl != null) {
                loadForegroundAvatar(snapshot.sessionId, displayName, photoUrl, isIncoming = false)
            }
        }
        val shouldOpenCallUi =
            snapshot.direction == PulseCallDirection.OUTGOING &&
                snapshot.state in setOf(PulseCallState.PREPARING, PulseCallState.RINGING) ||
                snapshot.state == PulseCallState.ACTIVE
        if (shouldOpenCallUi &&
            callUiOpenedForId != snapshot.sessionId
        ) {
            callUiOpenedForId = snapshot.sessionId
            val tabletPanel = PulseTabletCallPanelPolicy.shouldUsePanel(resources.configuration)
            startActivity(
                if (tabletPanel) {
                    PulseTabletCallPanelPolicy.mainActivityIntent(this)
                } else PulseCallActivity.intent(
                    context = this,
                    callId = snapshot.sessionId,
                    peerUid = snapshot.peerUid.orEmpty(),
                    displayName = displayName,
                    photoUrl = snapshot.photoUrl,
                    direction = requireNotNull(snapshot.direction),
                    mediaType = snapshot.mediaType ?: PulseCallMediaType.AUDIO,
                ),
            )
        }
        val status = notificationStatus(snapshot)
        getSystemService(NotificationManager::class.java).notify(
            NOTIFICATION_ID,
            buildNotification(displayName, status, snapshot),
        )
        dispatchPendingNotificationAction(snapshot)
    }

    private fun notificationStatus(snapshot: PulseCallSnapshot): String =
        when (snapshot.state) {
            PulseCallState.IDLE, PulseCallState.PREPARING ->
                getString(R.string.pulse_call_notification_preparing)
            PulseCallState.RINGING -> if (snapshot.direction == PulseCallDirection.INCOMING) {
                getString(incomingNotificationTextResource(snapshot.mediaType ?: foregroundMediaType))
            } else {
                getString(R.string.pulse_call_notification_ringing)
            }
            PulseCallState.CONNECTING -> getString(R.string.pulse_call_notification_connecting)
            PulseCallState.ACTIVE -> getString(R.string.pulse_call_notification_active)
            PulseCallState.ENDING, PulseCallState.ENDED ->
                getString(R.string.pulse_call_notification_ending)
        }

    private fun incomingNotificationTextResource(mediaType: PulseCallMediaType): Int =
        if (mediaType == PulseCallMediaType.VIDEO) {
            R.string.pulse_call_notification_incoming_video
        } else {
            R.string.pulse_call_notification_incoming
        }

    private fun loadForegroundAvatar(
        callId: String,
        displayName: String,
        photoUrl: String,
        isIncoming: Boolean,
    ) {
        avatarJob?.cancel()
        avatarJob = serviceScope.launch {
            val avatar = downloadNotificationAvatar(photoUrl) ?: return@launch
            if (foregroundCallId != callId || foregroundPhotoUrl != photoUrl) return@launch
            foregroundAvatar = avatar

            val snapshot = coordinator.state.value.takeIf { it.sessionId == callId }
            val status = snapshot?.let(::notificationStatus) ?: getString(
                if (isIncoming) incomingNotificationTextResource(foregroundMediaType)
                else R.string.pulse_call_notification_preparing,
            )
            getSystemService(NotificationManager::class.java).notify(
                NOTIFICATION_ID,
                buildNotification(
                    displayName = snapshot?.displayName ?: displayName,
                    status = status,
                    snapshot = snapshot,
                    incomingPreparing = isIncoming && snapshot == null,
                ),
            )
        }
    }

    private suspend fun downloadNotificationAvatar(photoUrl: String): Bitmap? =
        withContext(Dispatchers.IO) {
            val url = runCatching { URL(photoUrl) }.getOrNull() ?: return@withContext null
            if (!url.protocol.equals("https", ignoreCase = true)) return@withContext null
            val connection = runCatching { url.openConnection() as HttpsURLConnection }.getOrNull()
                ?: return@withContext null
            try {
                connection.connectTimeout = 5_000
                connection.readTimeout = 7_000
                connection.instanceFollowRedirects = true
                connection.connect()
                if (!connection.url.protocol.equals("https", ignoreCase = true) ||
                    connection.responseCode !in 200..299 ||
                    connection.contentLengthLong > MAX_AVATAR_DOWNLOAD_BYTES ||
                    connection.contentType?.startsWith("image/") != true
                ) return@withContext null

                val output = ByteArrayOutputStream()
                connection.inputStream.use { input ->
                    val buffer = ByteArray(8_192)
                    var total = 0
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > MAX_AVATAR_DOWNLOAD_BYTES) return@withContext null
                        output.write(buffer, 0, read)
                    }
                }
                val bytes = output.toByteArray()
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@withContext null
                var sampleSize = 1
                while (maxOf(bounds.outWidth, bounds.outHeight) / sampleSize > MAX_AVATAR_DIMENSION) {
                    sampleSize *= 2
                }
                BitmapFactory.decodeByteArray(
                    bytes,
                    0,
                    bytes.size,
                    BitmapFactory.Options().apply { inSampleSize = sampleSize },
                )
            } catch (_: Exception) {
                null
            } finally {
                connection.disconnect()
            }
        }

    private fun stopCallForeground(expectedCallId: String? = null) {
        if (expectedCallId != null && foregroundCallId != expectedCallId) return
        stopIncomingAlert(expectedCallId)
        foregroundCallId = null
        foregroundDisplayName = null
        foregroundPhotoUrl = null
        foregroundAvatar = null
        foregroundMediaType = PulseCallMediaType.AUDIO
        avatarJob?.cancel()
        avatarJob = null
        callUiOpenedForId = null
        pendingNotificationAction = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun stopIfIdle() {
        if (foregroundCallId == null) stopSelf()
    }

    private fun stopIncomingAlert(expectedCallId: String? = null) {
        if (::incomingCallRinger.isInitialized) incomingCallRinger.stop(expectedCallId)
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
        val isIncomingAlert = isIncoming &&
            (incomingPreparing || snapshot?.state == PulseCallState.RINGING)
        val direction = if (isIncoming) {
            PulseCallDirection.INCOMING
        } else {
            PulseCallDirection.OUTGOING
        }
        val person = Person.Builder()
            .setName(displayName)
            .setImportant(true)
            .setIcon(IconCompat.createWithBitmap(foregroundAvatar ?: initialsAvatar(displayName)))
            .build()
        val useTabletPanel = !isIncomingAlert &&
            PulseTabletCallPanelPolicy.shouldUsePanel(resources.configuration)
        val openCallUi = PendingIntent.getActivity(
            this,
            sessionId?.hashCode() ?: 0,
            if (useTabletPanel) {
                PulseTabletCallPanelPolicy.mainActivityIntent(this)
            } else PulseCallActivity.intent(
                context = this,
                callId = sessionId.orEmpty(),
                peerUid = snapshot?.peerUid.orEmpty(),
                displayName = displayName,
                photoUrl = snapshot?.photoUrl ?: foregroundPhotoUrl,
                direction = direction,
                mediaType = snapshot?.mediaType ?: foregroundMediaType,
            ),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(
            this,
            if (isIncomingAlert) INCOMING_NOTIFICATION_CHANNEL_ID else NOTIFICATION_CHANNEL_ID,
        )
            .setSmallIcon(R.drawable.ic_pulse_notification)
            .setColor(ContextCompat.getColor(this, R.color.pulse_notification_color))
            .setContentTitle(
                if (isIncoming) displayName else getString(R.string.pulse_call_notification_title),
            )
            .setContentText(if (isIncoming) status else "$displayName · $status")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openCallUi)
            .setPriority(
                if (isIncomingAlert) NotificationCompat.PRIORITY_MAX
                else NotificationCompat.PRIORITY_LOW,
            )
            .setSilent(!isIncomingAlert)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addPerson(person)

        foregroundAvatar?.let(builder::setLargeIcon)

        if (isIncomingAlert && sessionId != null) {
            builder.setFullScreenIntent(openCallUi, true)
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
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        val incomingChannel = NotificationChannel(
            INCOMING_NOTIFICATION_CHANNEL_ID,
            getString(R.string.pulse_incoming_call_channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = getString(R.string.pulse_incoming_call_channel_description)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(false)
            enableVibration(false)
            setSound(null, null)
        }
        manager.createNotificationChannels(listOf(activeChannel, incomingChannel))
        manager.deleteNotificationChannel(LEGACY_ACTIVE_NOTIFICATION_CHANNEL_ID)
    }

    private fun Intent.requiredString(name: String): String? =
        getStringExtra(name)?.takeIf(String::isNotBlank)

    private fun Intent.safePhotoUrl(name: String): String? = getStringExtra(name)
        ?.trim()
        ?.takeIf { value ->
            value.length <= 2_048 && runCatching {
                java.net.URI(value).scheme.equals("https", ignoreCase = true)
            }.getOrDefault(false)
        }

    private fun Intent.mediaType(): PulseCallMediaType = getStringExtra(EXTRA_MEDIA_TYPE)?.let {
        runCatching { PulseCallMediaType.valueOf(it) }.getOrNull()
    } ?: PulseCallMediaType.AUDIO

    companion object {
        const val ACTION_START_OUTGOING = "com.pulsemessenger.chat.call.v2.START_OUTGOING"
        const val ACTION_REGISTER_INCOMING = "com.pulsemessenger.chat.call.v2.REGISTER_INCOMING"
        const val ACTION_ANSWER = "com.pulsemessenger.chat.call.v2.ANSWER"
        const val ACTION_DISCONNECT = "com.pulsemessenger.chat.call.v2.DISCONNECT"
        const val ACTION_SELECT_AUDIO_ROUTE = "com.pulsemessenger.chat.call.v2.SELECT_AUDIO_ROUTE"
        const val ACTION_TOGGLE_MUTE = "com.pulsemessenger.chat.call.v2.TOGGLE_MUTE"
        const val ACTION_TOGGLE_VIDEO = "com.pulsemessenger.chat.call.v2.TOGGLE_VIDEO"
        const val ACTION_SWITCH_CAMERA = "com.pulsemessenger.chat.call.v2.SWITCH_CAMERA"
        const val ACTION_RECONCILE_TERMINAL = "com.pulsemessenger.chat.call.v2.RECONCILE_TERMINAL"
        const val ACTION_RECONCILE_TAKEN_ELSEWHERE =
            "com.pulsemessenger.chat.call.v2.RECONCILE_TAKEN_ELSEWHERE"
        const val EXTRA_REQUEST_ID = "request_id"
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_CALLEE_UID = "callee_uid"
        const val EXTRA_DISPLAY_NAME = "display_name"
        const val EXTRA_PHOTO_URL = "photo_url"
        const val EXTRA_MEDIA_TYPE = "media_type"
        const val EXTRA_ACCEPTED_INSTALLATION_ID = "accepted_installation_id"
        const val EXTRA_AUDIO_ROUTE_ID = "audio_route_id"

        private const val TAG = "PulseCallService"
        private const val CALLING_API_URL = "https://api.pulse-messenger.com"
        private const val NOTIFICATION_CHANNEL_ID = "pulse_active_calls_v2"
        private const val LEGACY_ACTIVE_NOTIFICATION_CHANNEL_ID = "pulse_active_calls"
        private const val INCOMING_NOTIFICATION_CHANNEL_ID = "pulse_incoming_calls_v3"
        private const val NOTIFICATION_ID = 4102
        private const val RECOVERY_RETRY_DELAY_MS = 5_000L
        private const val MAX_AVATAR_DOWNLOAD_BYTES = 2 * 1024 * 1024
        private const val MAX_AVATAR_DIMENSION = 512

        fun outgoingIntent(
            context: Context,
            requestId: String,
            calleeUid: String,
            displayName: String,
            photoUrl: String? = null,
            mediaType: PulseCallMediaType,
        ): Intent = Intent(context, PulseCallService::class.java)
            .setAction(ACTION_START_OUTGOING)
            .putExtra(EXTRA_REQUEST_ID, requestId)
            .putExtra(EXTRA_CALLEE_UID, calleeUid)
            .putExtra(EXTRA_DISPLAY_NAME, displayName)
            .putExtra(EXTRA_PHOTO_URL, photoUrl)
            .putExtra(EXTRA_MEDIA_TYPE, mediaType.name)

        fun incomingIntent(
            context: Context,
            sessionId: String,
            displayName: String,
            photoUrl: String? = null,
            mediaType: PulseCallMediaType = PulseCallMediaType.AUDIO,
        ): Intent = Intent(context, PulseCallService::class.java)
            .setAction(ACTION_REGISTER_INCOMING)
            .putExtra(EXTRA_SESSION_ID, sessionId)
            .putExtra(EXTRA_DISPLAY_NAME, displayName)
            .putExtra(EXTRA_PHOTO_URL, photoUrl)
            .putExtra(EXTRA_MEDIA_TYPE, mediaType.name)

        fun terminalIntent(context: Context, sessionId: String): Intent =
            Intent(context, PulseCallService::class.java)
                .setAction(ACTION_RECONCILE_TERMINAL)
                .putExtra(EXTRA_SESSION_ID, sessionId)

        fun takenElsewhereIntent(
            context: Context,
            sessionId: String,
            acceptedInstallationId: String,
        ): Intent = Intent(context, PulseCallService::class.java)
            .setAction(ACTION_RECONCILE_TAKEN_ELSEWHERE)
            .putExtra(EXTRA_SESSION_ID, sessionId)
            .putExtra(EXTRA_ACCEPTED_INSTALLATION_ID, acceptedInstallationId)

        fun disconnectIntent(context: Context, sessionId: String): Intent =
            Intent(context, PulseCallService::class.java)
                .setAction(ACTION_DISCONNECT)
                .putExtra(EXTRA_SESSION_ID, sessionId)
    }
}
