package com.pulsemessenger.chat.call.v2

import android.Manifest
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.RequiresApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Bluetooth
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.CallEnd
import androidx.compose.material.icons.rounded.Cameraswitch
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MicOff
import androidx.compose.material.icons.rounded.Smartphone
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material.icons.rounded.VideocamOff
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.pulsemessenger.chat.MainActivity
import com.pulsemessenger.chat.R
import java.util.Locale
import java.util.UUID
import java.io.ByteArrayOutputStream
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

@RequiresApi(Build.VERSION_CODES.O)
class PulseCallActivity : ComponentActivity() {
    private var pendingVideoPermissionAction: (() -> Unit)? = null
    private val videoPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { permissions ->
        val granted = permissions[Manifest.permission.CAMERA] == true &&
            permissions[Manifest.permission.RECORD_AUDIO] == true
        val action = pendingVideoPermissionAction
        pendingVideoPermissionAction = null
        if (granted) action?.invoke()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }

        val initialCallId = intent.getStringExtra(EXTRA_CALL_ID).orEmpty()
        val initialPeerUid = intent.getStringExtra(EXTRA_PEER_UID).orEmpty()
        val initialPhotoUrl = intent.getStringExtra(EXTRA_PHOTO_URL)
        val initialName = intent.getStringExtra(EXTRA_DISPLAY_NAME)
            ?.takeIf(String::isNotBlank)
            ?: getString(R.string.pulse_call_unknown_caller)
        val initialDirection = intent.getStringExtra(EXTRA_DIRECTION)
            ?.let { runCatching { PulseCallDirection.valueOf(it) }.getOrNull() }
            ?: PulseCallDirection.OUTGOING
        val initialMediaType = intent.getStringExtra(EXTRA_MEDIA_TYPE)
            ?.let { runCatching { PulseCallMediaType.valueOf(it) }.getOrNull() }
            ?: PulseCallMediaType.AUDIO

        setContent {
            MaterialTheme {
                val snapshot by PulseCallCoordinator.instance.state.collectAsState()
                val audioRoutes by PulseCallAudioRoutes.state.collectAsState()
                val videoSnapshot by PulseCallVideoState.state.collectAsState()
                var observedNativeCall by remember { mutableStateOf(false) }
                val terminalPresentation = snapshot.terminalPresentation()
                val matchesActiveCall = snapshot.sessionId != null &&
                    snapshot.state != PulseCallState.IDLE
                LaunchedEffect(matchesActiveCall) {
                    if (matchesActiveCall) observedNativeCall = true
                }

                LaunchedEffect(
                    snapshot.state,
                    snapshot.sessionId,
                    terminalPresentation,
                    observedNativeCall,
                ) {
                    val unsupportedTerminal =
                        snapshot.state in setOf(PulseCallState.ENDING, PulseCallState.ENDED) &&
                            terminalPresentation == null
                    if (observedNativeCall &&
                        (snapshot.sessionId == null ||
                            snapshot.state == PulseCallState.IDLE ||
                            unsupportedTerminal)
                    ) {
                        finishAndRemoveTask()
                    }
                }

                val liveSnapshot = snapshot.takeIf {
                    it.sessionId != null && it.state != PulseCallState.IDLE
                }
                val callId = liveSnapshot?.sessionId ?: initialCallId
                val direction = liveSnapshot?.direction ?: initialDirection
                val uiState = PulseCallUiState(
                    callId = callId,
                    peerUid = liveSnapshot?.peerUid ?: initialPeerUid,
                    displayName = liveSnapshot?.displayName ?: initialName,
                    photoUrl = liveSnapshot?.photoUrl ?: initialPhotoUrl,
                    direction = direction,
                    mediaType = liveSnapshot?.mediaType ?: initialMediaType,
                    callState = liveSnapshot?.state ?: if (
                        direction == PulseCallDirection.INCOMING
                    ) {
                        PulseCallState.RINGING
                    } else {
                        PulseCallState.PREPARING
                    },
                    activeSinceElapsedRealtimeMs =
                        liveSnapshot?.activeSinceElapsedRealtimeMs,
                    isMuted = liveSnapshot?.isMuted ?: false,
                    terminalPresentation = liveSnapshot?.terminalPresentation(),
                    finalActiveDurationMs = liveSnapshot?.finalActiveDurationMs,
                )
                PulseCallScreen(
                    state = uiState,
                    audioRoutes = audioRoutes.takeIf { it.sessionId == callId }
                        ?: PulseAudioRouteSnapshot(),
                    videoSnapshot = videoSnapshot.takeIf { it.sessionId == callId }
                        ?: PulseVideoTrackSnapshot(),
                    onAccept = { acceptCall(callId, uiState.mediaType) },
                    onDecline = { sendCallAction(PulseCallService.ACTION_DISCONNECT, callId) },
                    onHangUp = { sendCallAction(PulseCallService.ACTION_DISCONNECT, callId) },
                    onToggleMute = { sendCallAction(PulseCallService.ACTION_TOGGLE_MUTE, callId) },
                    onToggleVideo = { sendCallAction(PulseCallService.ACTION_TOGGLE_VIDEO, callId) },
                    onSwitchCamera = { sendCallAction(PulseCallService.ACTION_SWITCH_CAMERA, callId) },
                    onAudioRouteSelected = { routeId ->
                        sendAudioRouteAction(callId, routeId)
                    },
                    onMessage = {
                        openConversation(uiState.peerUid, uiState.displayName)
                    },
                    onCallBack = {
                        startCallBack(
                            uiState.peerUid,
                            uiState.displayName,
                            uiState.photoUrl,
                            uiState.mediaType,
                        )
                    },
                    onClose = ::finishAndRemoveTask,
                )
                BackHandler(enabled = true) {
                    if (uiState.terminalPresentation != null) finishAndRemoveTask()
                }
            }
        }
    }

    private fun sendCallAction(action: String, callId: String) {
        if (callId.isBlank()) return
        startService(
            Intent(this, PulseCallService::class.java)
                .setAction(action)
                .putExtra(PulseCallService.EXTRA_SESSION_ID, callId),
        )
    }

    private fun acceptCall(callId: String, mediaType: PulseCallMediaType) {
        if (mediaType != PulseCallMediaType.VIDEO || hasVideoPermissions()) {
            sendCallAction(PulseCallService.ACTION_ANSWER, callId)
            return
        }
        pendingVideoPermissionAction = {
            sendCallAction(PulseCallService.ACTION_ANSWER, callId)
        }
        videoPermissionLauncher.launch(arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
        ))
    }

    private fun hasVideoPermissions(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED

    private fun sendAudioRouteAction(callId: String, routeId: String) {
        if (callId.isBlank() || routeId.isBlank()) return
        startService(
            Intent(this, PulseCallService::class.java)
                .setAction(PulseCallService.ACTION_SELECT_AUDIO_ROUTE)
                .putExtra(PulseCallService.EXTRA_SESSION_ID, callId)
                .putExtra(PulseCallService.EXTRA_AUDIO_ROUTE_ID, routeId),
        )
    }

    private fun openConversation(peerUid: String, displayName: String) {
        if (peerUid.isBlank()) return
        PulseCallFollowUpStore.saveMessage(this, peerUid, displayName)
        startActivity(
            Intent(this, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP,
            ),
        )
        finish()
    }

    private fun startCallBack(
        peerUid: String,
        displayName: String,
        photoUrl: String?,
        mediaType: PulseCallMediaType,
    ) {
        if (peerUid.isBlank()) return
        ContextCompat.startForegroundService(
            this,
            PulseCallService.outgoingIntent(
                context = this,
                requestId = UUID.randomUUID().toString(),
                calleeUid = peerUid,
                displayName = displayName,
                photoUrl = photoUrl,
                mediaType = mediaType,
            ),
        )
        finish()
    }

    companion object {
        private const val EXTRA_CALL_ID = "call_ui_call_id"
        private const val EXTRA_PEER_UID = "call_ui_peer_uid"
        private const val EXTRA_DISPLAY_NAME = "call_ui_display_name"
        private const val EXTRA_PHOTO_URL = "call_ui_photo_url"
        private const val EXTRA_DIRECTION = "call_ui_direction"
        private const val EXTRA_MEDIA_TYPE = "call_ui_media_type"

        fun intent(
            context: Context,
            callId: String,
            peerUid: String,
            displayName: String,
            photoUrl: String?,
            direction: PulseCallDirection,
            mediaType: PulseCallMediaType = PulseCallMediaType.AUDIO,
        ): Intent = Intent(context, PulseCallActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA_CALL_ID, callId)
            .putExtra(EXTRA_PEER_UID, peerUid)
            .putExtra(EXTRA_DISPLAY_NAME, displayName)
            .putExtra(EXTRA_PHOTO_URL, photoUrl)
            .putExtra(EXTRA_DIRECTION, direction.name)
            .putExtra(EXTRA_MEDIA_TYPE, mediaType.name)
    }
}

internal data class PulseCallUiState(
    val callId: String,
    val peerUid: String,
    val displayName: String,
    val photoUrl: String?,
    val direction: PulseCallDirection,
    val mediaType: PulseCallMediaType,
    val callState: PulseCallState,
    val activeSinceElapsedRealtimeMs: Long?,
    val isMuted: Boolean,
    val terminalPresentation: PulseCallTerminalPresentation?,
    val finalActiveDurationMs: Long?,
)

@Composable
internal fun PulseCallScreen(
    state: PulseCallUiState,
    audioRoutes: PulseAudioRouteSnapshot,
    videoSnapshot: PulseVideoTrackSnapshot,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onHangUp: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleVideo: () -> Unit,
    onSwitchCamera: () -> Unit,
    onAudioRouteSelected: (String) -> Unit,
    onMessage: () -> Unit,
    onCallBack: () -> Unit,
    onClose: () -> Unit,
) {
    var showAudioOutput by remember(state.callId) { mutableStateOf(false) }
    val avatar by rememberContactAvatar(state.photoUrl)
    LaunchedEffect(state.callState) {
        if (state.callState != PulseCallState.ACTIVE) showAudioOutput = false
    }
    CallBackground(avatar = avatar) {
      Box(modifier = Modifier.fillMaxSize()) {
        if (state.mediaType == PulseCallMediaType.VIDEO && videoSnapshot.remoteTrack != null) {
            PulseVideoRenderer(
                track = videoSnapshot.remoteTrack,
                mirror = false,
                mediaOverlay = false,
                modifier = Modifier.fillMaxSize(),
            )
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.16f)))
        }
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal = 24.dp),
        ) {
            val compact = maxHeight < 620.dp
            val avatarSize = when {
                state.terminalPresentation != null -> if (compact) 104.dp else 126.dp
                compact -> 120.dp
                else -> 156.dp
            }
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Spacer(Modifier.height(if (compact) 12.dp else 24.dp))
                CallBrand()
                Spacer(Modifier.weight(if (compact) 0.45f else 0.75f))
                if (state.mediaType != PulseCallMediaType.VIDEO ||
                    videoSnapshot.remoteTrack == null
                ) {
                    ContactAvatar(state.displayName, avatar, avatarSize)
                    Spacer(Modifier.height(if (compact) 16.dp else 22.dp))
                    ContactName(state.displayName)
                }
                Spacer(Modifier.height(6.dp))
                if (state.terminalPresentation != null) {
                    TerminalCallStatus(
                        presentation = state.terminalPresentation,
                        finalActiveDurationMs = state.finalActiveDurationMs,
                    )
                } else if (state.callState == PulseCallState.ACTIVE) {
                    ActiveCallTimer(state.activeSinceElapsedRealtimeMs)
                } else {
                    CallStatus(state)
                }
                Spacer(Modifier.weight(1f))
                if (state.terminalPresentation != null) {
                    TerminalCallActions(
                        actionsEnabled = state.peerUid.isNotBlank(),
                        onMessage = onMessage,
                        onClose = onClose,
                        onCallBack = onCallBack,
                    )
                } else if (state.direction == PulseCallDirection.INCOMING &&
                    state.callState in setOf(PulseCallState.PREPARING, PulseCallState.RINGING)
                ) {
                    IncomingActions(onDecline = onDecline, onAccept = onAccept)
                } else {
                    OutgoingActions(
                        isMuted = state.isMuted,
                        isVideoCall = state.mediaType == PulseCallMediaType.VIDEO,
                        isVideoEnabled = videoSnapshot.cameraEnabled,
                        isSpeakerActive = audioRoutes.currentRoute?.type ==
                            PulseAudioRouteType.SPEAKER,
                        onToggleMute = if (state.callState == PulseCallState.ACTIVE) {
                            onToggleMute
                        } else {
                            null
                        },
                        onHangUp = onHangUp,
                        onToggleVideo = if (state.mediaType == PulseCallMediaType.VIDEO &&
                            state.callState in setOf(PulseCallState.CONNECTING, PulseCallState.ACTIVE)
                        ) onToggleVideo else null,
                        onSwitchCamera = if (state.mediaType == PulseCallMediaType.VIDEO &&
                            state.callState in setOf(PulseCallState.CONNECTING, PulseCallState.ACTIVE)
                        ) onSwitchCamera else null,
                        onAudioOutput = if (state.callState == PulseCallState.ACTIVE) {
                            {
                                showAudioOutput = true
                            }
                        } else {
                            null
                        },
                    )
                }
                Spacer(Modifier.height(if (compact) 14.dp else 24.dp))
            }
        }
        if (state.mediaType == PulseCallMediaType.VIDEO &&
            videoSnapshot.localTrack != null &&
            videoSnapshot.cameraEnabled
        ) {
            PulseVideoRenderer(
                track = videoSnapshot.localTrack,
                mirror = videoSnapshot.usingFrontCamera,
                mediaOverlay = true,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .padding(top = 78.dp, end = 14.dp)
                    .size(width = 112.dp, height = 154.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .border(2.dp, Color.White.copy(alpha = 0.82f), RoundedCornerShape(8.dp))
                    .clickable(onClick = onSwitchCamera),
            )
        }
      }
    }
    if (showAudioOutput && state.callState == PulseCallState.ACTIVE) {
        AudioOutputSheet(
            routes = audioRoutes.availableRoutes,
            currentRouteId = audioRoutes.currentRouteId,
            onDismiss = { showAudioOutput = false },
            onRouteSelected = { routeId ->
                onAudioRouteSelected(routeId)
                showAudioOutput = false
            },
        )
    }
}

@Composable
private fun PulseVideoRenderer(
    track: VideoTrack?,
    mirror: Boolean,
    mediaOverlay: Boolean,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val renderer = remember {
        SurfaceViewRenderer(context).apply {
            init(PulseCallVideoState.eglContext, null)
            setEnableHardwareScaler(true)
            setZOrderMediaOverlay(mediaOverlay)
        }
    }
    DisposableEffect(track) {
        track?.addSink(renderer)
        onDispose { track?.removeSink(renderer) }
    }
    DisposableEffect(Unit) {
        onDispose { renderer.release() }
    }
    AndroidView(
        factory = { renderer },
        modifier = modifier,
        update = { it.setMirror(mirror) },
    )
}

@Composable
private fun TerminalCallStatus(
    presentation: PulseCallTerminalPresentation,
    finalActiveDurationMs: Long?,
) {
    val rejected = presentation == PulseCallTerminalPresentation.REJECTED
    Row(
        horizontalArrangement = Arrangement.spacedBy(9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(22.dp)
                .background(if (rejected) PulseRejected else PulseEnded, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.CallEnd,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(14.dp),
            )
        }
        Text(
            text = stringResource(
                if (rejected) R.string.pulse_call_status_rejected
                else R.string.pulse_call_status_ended,
            ),
            color = Color.White.copy(alpha = 0.94f),
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
        )
    }
    if (!rejected && finalActiveDurationMs != null) {
        Spacer(Modifier.height(7.dp))
        CallTimerText(formatCallDuration(finalActiveDurationMs))
    }
}

@Composable
private fun TerminalCallActions(
    actionsEnabled: Boolean,
    onMessage: () -> Unit,
    onClose: () -> Unit,
    onCallBack: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Top,
    ) {
        CallControlButton(
            label = stringResource(R.string.pulse_call_action_message),
            icon = Icons.Rounded.ChatBubble,
            onClick = onMessage.takeIf { actionsEnabled },
        )
        CallControlButton(
            label = stringResource(R.string.pulse_call_action_close),
            icon = Icons.Rounded.Close,
            onClick = onClose,
        )
        CallControlButton(
            label = stringResource(R.string.pulse_call_action_call_back),
            icon = Icons.Rounded.Call,
            background = PulseGreen,
            onClick = onCallBack.takeIf { actionsEnabled },
        )
    }
}

@Composable
internal fun CallBackground(
    avatar: ImageBitmap?,
    content: @Composable () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().background(PulseBackground)) {
        if (avatar != null) {
            Image(
                bitmap = avatar,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().blur(44.dp),
            )
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.66f)))
        }
        content()
    }
}

@Composable
private fun CallBrand() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(PulseAccent),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.GraphicEq,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp),
                )
            }
            Text(
                text = stringResource(R.string.pulse_call_brand),
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.height(10.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Rounded.Lock,
                contentDescription = null,
                tint = PulseMutedText,
                modifier = Modifier.size(13.dp),
            )
            Text(
                text = stringResource(R.string.pulse_call_encrypted),
                color = PulseMutedText,
                fontSize = 13.sp,
                fontWeight = FontWeight.Normal,
            )
        }
    }
}

@Composable
internal fun ContactAvatar(displayName: String, avatar: ImageBitmap?, size: Dp) {
    Box(
        modifier = Modifier
            .size(size)
            .border(2.dp, PulseAccent, CircleShape)
            .padding(4.dp)
            .clip(CircleShape)
            .background(PulseAvatar),
        contentAlignment = Alignment.Center,
    ) {
        if (avatar != null) {
            Image(
                bitmap = avatar,
                contentDescription = displayName,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Text(
                text = initials(displayName),
                color = Color.White,
                fontSize = 44.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun rememberContactAvatar(photoUrl: String?) = produceState<ImageBitmap?>(
    initialValue = null,
    key1 = photoUrl,
) {
    value = photoUrl?.let { loadRemoteAvatar(it) }
}

private suspend fun loadRemoteAvatar(photoUrl: String): ImageBitmap? = withContext(Dispatchers.IO) {
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
        )?.asImageBitmap()
    } catch (_: Exception) {
        null
    } finally {
        connection.disconnect()
    }
}

@Composable
internal fun ContactName(displayName: String) {
    Text(
        text = displayName,
        color = Color.White,
        fontSize = 30.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        maxLines = 2,
    )
}

@Composable
internal fun CallStatus(state: PulseCallUiState) {
    val status = when {
        state.direction == PulseCallDirection.INCOMING -> stringResource(
            if (state.mediaType == PulseCallMediaType.VIDEO) {
                R.string.pulse_call_status_incoming_video
            } else {
                R.string.pulse_call_status_incoming
            },
        )
        state.callState == PulseCallState.RINGING ->
            stringResource(R.string.pulse_call_status_ringing)
        else -> stringResource(R.string.pulse_call_status_calling)
    }
    Text(
        text = status,
        color = Color.White.copy(alpha = 0.92f),
        fontSize = 17.sp,
        fontWeight = FontWeight.Normal,
        textAlign = TextAlign.Center,
    )
}

@Composable
internal fun ActiveCallTimer(activeSinceElapsedRealtimeMs: Long?) {
    if (activeSinceElapsedRealtimeMs == null) {
        CallTimerText("00:00")
        return
    }
    var nowElapsedRealtimeMs by remember(activeSinceElapsedRealtimeMs) {
        mutableLongStateOf(SystemClock.elapsedRealtime())
    }
    LaunchedEffect(activeSinceElapsedRealtimeMs) {
        while (true) {
            nowElapsedRealtimeMs = SystemClock.elapsedRealtime()
            val elapsedMs = (nowElapsedRealtimeMs - activeSinceElapsedRealtimeMs).coerceAtLeast(0L)
            delay((1_000L - elapsedMs % 1_000L).coerceAtLeast(50L))
        }
    }
    val totalSeconds =
        ((nowElapsedRealtimeMs - activeSinceElapsedRealtimeMs).coerceAtLeast(0L) / 1_000L)
    CallTimerText(formatCallDuration(totalSeconds * 1_000L))
}

private fun formatCallDuration(durationMs: Long): String {
    val totalSeconds = durationMs.coerceAtLeast(0L) / 1_000L
    return String.format(Locale.ROOT, "%02d:%02d", totalSeconds / 60L, totalSeconds % 60L)
}

@Composable
private fun CallTimerText(value: String) {
    Text(
        text = value,
        color = Color.White.copy(alpha = 0.94f),
        fontSize = 18.sp,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
    )
}

@Composable
private fun IncomingActions(onDecline: () -> Unit, onAccept: () -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(68.dp),
        verticalAlignment = Alignment.Top,
    ) {
        IncomingActionButton(
            label = stringResource(R.string.pulse_call_action_decline),
            icon = Icons.Rounded.CallEnd,
            background = PulseRed,
            onClick = onDecline,
        )
        IncomingActionButton(
            label = stringResource(R.string.pulse_call_action_accept),
            icon = Icons.Rounded.Call,
            background = PulseGreen,
            onClick = onAccept,
        )
    }
}

@Composable
private fun OutgoingActions(
    isMuted: Boolean,
    isVideoCall: Boolean,
    isVideoEnabled: Boolean,
    isSpeakerActive: Boolean,
    onToggleMute: (() -> Unit)?,
    onHangUp: () -> Unit,
    onToggleVideo: (() -> Unit)?,
    onSwitchCamera: (() -> Unit)?,
    onAudioOutput: (() -> Unit)?,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(if (isVideoCall) 16.dp else 30.dp),
        verticalAlignment = Alignment.Top,
    ) {
        CallControlButton(
            label = stringResource(
                if (isMuted) R.string.pulse_call_action_muted else R.string.pulse_call_action_mute,
            ),
            icon = if (isMuted) Icons.Rounded.MicOff else Icons.Rounded.Mic,
            background = if (isMuted) PulseRed else PulseControl,
            onClick = onToggleMute,
        )
        CallControlButton(
            label = stringResource(
                if (isVideoEnabled) R.string.pulse_call_action_video_off
                else R.string.pulse_call_action_video_on,
            ),
            icon = if (isVideoEnabled) Icons.Rounded.Videocam else Icons.Rounded.VideocamOff,
            background = if (isVideoCall && !isVideoEnabled) PulseRed else PulseControl,
            onClick = onToggleVideo,
        )
        if (isVideoCall) {
            CallControlButton(
                label = stringResource(R.string.pulse_call_action_switch_camera),
                icon = Icons.Rounded.Cameraswitch,
                onClick = onSwitchCamera,
            )
        }
        CallControlButton(
            stringResource(R.string.pulse_call_action_speaker),
            Icons.AutoMirrored.Rounded.VolumeUp,
            background = if (isSpeakerActive) PulseAccent else PulseControl,
            onClick = onAudioOutput,
        )
    }
    Spacer(Modifier.height(34.dp))
    HangupButton(onClick = onHangUp)
}

@Composable
internal fun CallControlButton(
    label: String,
    icon: ImageVector,
    background: Color = PulseControl,
    onClick: (() -> Unit)? = null,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(58.dp)
                .clip(CircleShape)
                .background(background)
                .clickable(enabled = onClick != null) { onClick?.invoke() },
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = label, tint = Color.White, modifier = Modifier.size(26.dp))
        }
        Spacer(Modifier.height(9.dp))
        Text(text = label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AudioOutputSheet(
    routes: List<PulseAudioRoute>,
    currentRouteId: String?,
    onDismiss: () -> Unit,
    onRouteSelected: (String) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PulseSheet,
        contentColor = Color.White,
        scrimColor = Color.Black.copy(alpha = 0.48f),
        shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
        dragHandle = {
            Box(
                Modifier
                    .padding(top = 10.dp, bottom = 8.dp)
                    .size(width = 42.dp, height = 4.dp)
                    .background(PulseMutedText.copy(alpha = 0.72f), CircleShape),
            )
        },
    ) {
        Column(
            modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = stringResource(R.string.pulse_call_audio_output_title),
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(2.dp))
            routes.sortedBy(PulseAudioRoute::type).forEach { route ->
                AudioRouteRow(
                    route = route,
                    selected = route.id == currentRouteId,
                    onClick = { onRouteSelected(route.id) },
                )
            }
        }
    }
}

@Composable
private fun AudioRouteRow(
    route: PulseAudioRoute,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val icon = when (route.type) {
        PulseAudioRouteType.EARPIECE -> Icons.Rounded.Smartphone
        PulseAudioRouteType.SPEAKER -> Icons.AutoMirrored.Rounded.VolumeUp
        PulseAudioRouteType.BLUETOOTH -> Icons.Rounded.Bluetooth
        PulseAudioRouteType.WIRED_HEADSET -> Icons.Rounded.Headphones
    }
    val label = when (route.type) {
        PulseAudioRouteType.EARPIECE -> stringResource(R.string.pulse_call_audio_earpiece)
        PulseAudioRouteType.SPEAKER -> stringResource(R.string.pulse_call_action_speaker)
        PulseAudioRouteType.BLUETOOTH -> route.name.takeIf(String::isNotBlank)
            ?: stringResource(R.string.pulse_call_audio_bluetooth)
        PulseAudioRouteType.WIRED_HEADSET -> stringResource(R.string.pulse_call_audio_wired_headset)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) PulseSelectedRoute else PulseRoute)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
        Text(
            text = label,
            modifier = Modifier.padding(start = 14.dp).weight(1f),
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
        )
        if (selected) {
            Icon(
                Icons.Rounded.Check,
                contentDescription = null,
                tint = PulseRouteCheck,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}

@Composable
internal fun HangupButton(onClick: () -> Unit) {
    RoundCallButton(
        label = stringResource(R.string.pulse_call_action_hang_up),
        icon = Icons.Rounded.CallEnd,
        background = PulseRed,
        diameter = 76.dp,
        showLabel = false,
        onClick = onClick,
    )
}

@Composable
internal fun IncomingActionButton(
    label: String,
    icon: ImageVector,
    background: Color,
    onClick: () -> Unit,
) {
    RoundCallButton(label, icon, background, 76.dp, showLabel = true, onClick)
}

@Composable
private fun RoundCallButton(
    label: String,
    icon: ImageVector,
    background: Color,
    diameter: Dp,
    showLabel: Boolean,
    onClick: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        androidx.compose.material3.IconButton(
            onClick = onClick,
            modifier = Modifier.size(diameter).background(background, CircleShape),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = Color.White,
                modifier = Modifier.size(34.dp),
            )
        }
        if (showLabel) {
            Spacer(Modifier.height(11.dp))
            Text(
                text = label,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
            )
        }
    }
}

private fun initials(displayName: String): String {
    val words = displayName.trim().split(Regex("\\s+")).filter(String::isNotBlank)
    return when {
        words.isEmpty() -> "P"
        words.size == 1 -> words.first().take(2)
        else -> words.first().take(1) + words.last().take(1)
    }.uppercase()
}

private const val MAX_AVATAR_DOWNLOAD_BYTES = 5 * 1024 * 1024
private const val MAX_AVATAR_DIMENSION = 1_024

private val PulseBackground = Color(0xFF0B0912)
private val PulseAccent = Color(0xFF8B5CF6)
private val PulseAvatar = Color(0xFF6547B8)
private val PulseControl = Color(0xFF24222E)
private val PulseSheet = Color(0xFF171321)
private val PulseRoute = Color(0xFF1D1928)
private val PulseSelectedRoute = Color(0xFF38205D)
private val PulseRouteCheck = Color(0xFFA970FF)
private val PulseMutedText = Color(0xFFB8B3C8)
private val PulseRed = Color(0xFFFF3E4D)
private val PulseGreen = Color(0xFF35C967)
private val PulseRejected = Color(0xFFD94B59)
private val PulseEnded = Color(0xFF4F6B58)
