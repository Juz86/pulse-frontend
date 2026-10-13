package com.pulsemessenger.chat.call.v2

import android.annotation.SuppressLint
import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.RequiresApi
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.core.content.ContextCompat
import com.pulsemessenger.chat.MainActivity
import java.util.UUID

/** Embeds the native call UI beside the Capacitor web view on landscape tablets. */
@SuppressLint("NewApi") // attach() gates the complete host behind Android 8.
class PulseTabletCallPanelHost(private val activity: MainActivity) {
    private var content: FrameLayout? = null
    private var appContent: View? = null
    private var panel: ComposeView? = null
    private var requestedVisible = false

    fun attach() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || panel != null) return
        val root = activity.findViewById<FrameLayout>(android.R.id.content) ?: return
        val mainContent = root.getChildAt(0) ?: return
        content = root
        appContent = mainContent

        panel = ComposeView(activity).apply {
            visibility = View.GONE
            setViewCompositionStrategy(
                ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed,
            )
            setContent {
                MaterialTheme {
                    TabletCallPanel { visible ->
                        requestedVisible = visible
                        updateLayout()
                    }
                }
            }
        }.also { callPanel ->
            root.addView(
                callPanel,
                FrameLayout.LayoutParams(panelWidthPx(), ViewGroup.LayoutParams.MATCH_PARENT).apply {
                    gravity = Gravity.END
                },
            )
        }
    }

    fun onConfigurationChanged() {
        updateLayout()
        if (requestedVisible && !PulseTabletCallPanelPolicy.shouldUsePanel(
                activity.resources.configuration,
            )
        ) {
            val snapshot = PulseCallCoordinator.instance.state.value
            val callId = snapshot.sessionId ?: return
            activity.startActivity(
                PulseCallActivity.intent(
                    context = activity,
                    callId = callId,
                    peerUid = snapshot.peerUid.orEmpty(),
                    displayName = snapshot.displayName.orEmpty(),
                    photoUrl = snapshot.photoUrl,
                    direction = snapshot.direction ?: PulseCallDirection.OUTGOING,
                    mediaType = snapshot.mediaType ?: PulseCallMediaType.AUDIO,
                ),
            )
        }
    }

    fun dispose() {
        requestedVisible = false
        updateLayout()
        panel?.disposeComposition()
        panel?.let { content?.removeView(it) }
        panel = null
        appContent = null
        content = null
    }

    private fun updateLayout() {
        val callPanel = panel ?: return
        val mainContent = appContent ?: return
        val visible = requestedVisible && PulseTabletCallPanelPolicy.shouldUsePanel(
            activity.resources.configuration,
        )
        val width = panelWidthPx()
        (callPanel.layoutParams as? FrameLayout.LayoutParams)?.let { params ->
            params.width = width
            params.gravity = Gravity.END
            callPanel.layoutParams = params
        }
        (mainContent.layoutParams as? FrameLayout.LayoutParams)?.let { params ->
            val targetMargin = if (visible) width else 0
            if (params.marginEnd != targetMargin) {
                params.marginEnd = targetMargin
                mainContent.layoutParams = params
            }
        }
        callPanel.visibility = if (visible) View.VISIBLE else View.GONE
        content?.requestLayout()
    }

    private fun panelWidthPx(): Int {
        val density = activity.resources.displayMetrics.density
        val widthDp = activity.resources.configuration.screenWidthDp
        val panelDp = (widthDp * 0.29f).coerceIn(320f, 420f)
        return (panelDp * density).toInt()
    }

    @RequiresApi(Build.VERSION_CODES.O)
    @Composable
    private fun TabletCallPanel(onVisibilityChanged: (Boolean) -> Unit) {
        val snapshot by PulseCallCoordinator.instance.state.collectAsState()
        val audioRoutes by PulseCallAudioRoutes.state.collectAsState()
        val videoSnapshot by PulseCallVideoState.state.collectAsState()
        var dismissedSessionId by remember { mutableStateOf<String?>(null) }
        val callId = snapshot.sessionId.orEmpty()
        val terminalPresentation = snapshot.terminalPresentation()
        val shouldDisplay = callId.isNotBlank() && callId != dismissedSessionId &&
            PulseTabletCallPanelPolicy.shouldDisplayCall(
                state = snapshot.state,
                direction = snapshot.direction,
                hasTerminalPresentation = terminalPresentation != null,
            )

        LaunchedEffect(shouldDisplay) {
            onVisibilityChanged(shouldDisplay)
        }
        if (!shouldDisplay) return

        val uiState = PulseCallUiState(
            callId = callId,
            peerUid = snapshot.peerUid.orEmpty(),
            displayName = snapshot.displayName.orEmpty(),
            photoUrl = snapshot.photoUrl,
            direction = snapshot.direction ?: PulseCallDirection.OUTGOING,
            mediaType = snapshot.mediaType ?: PulseCallMediaType.AUDIO,
            callState = snapshot.state,
            activeSinceElapsedRealtimeMs = snapshot.activeSinceElapsedRealtimeMs,
            isMuted = snapshot.isMuted,
            terminalPresentation = terminalPresentation,
            finalActiveDurationMs = snapshot.finalActiveDurationMs,
        )
        PulseCallScreen(
            state = uiState,
            audioRoutes = audioRoutes.takeIf { it.sessionId == callId }
                ?: PulseAudioRouteSnapshot(),
            videoSnapshot = videoSnapshot.takeIf { it.sessionId == callId }
                ?: PulseVideoTrackSnapshot(),
            onAccept = { sendCallAction(PulseCallService.ACTION_ANSWER, callId) },
            onDecline = { sendCallAction(PulseCallService.ACTION_DISCONNECT, callId) },
            onHangUp = { sendCallAction(PulseCallService.ACTION_DISCONNECT, callId) },
            onToggleMute = { sendCallAction(PulseCallService.ACTION_TOGGLE_MUTE, callId) },
            onToggleVideo = { sendCallAction(PulseCallService.ACTION_TOGGLE_VIDEO, callId) },
            onSwitchCamera = { sendCallAction(PulseCallService.ACTION_SWITCH_CAMERA, callId) },
            onAudioRouteSelected = { routeId -> sendAudioRouteAction(callId, routeId) },
            onMessage = {
                PulseCallFollowUpStore.saveMessage(
                    activity,
                    uiState.peerUid,
                    uiState.displayName,
                )
                dismissedSessionId = callId
            },
            onCallBack = {
                if (uiState.peerUid.isNotBlank()) {
                    ContextCompat.startForegroundService(
                        activity,
                        PulseCallService.outgoingIntent(
                            context = activity,
                            requestId = UUID.randomUUID().toString(),
                            calleeUid = uiState.peerUid,
                            displayName = uiState.displayName,
                            photoUrl = uiState.photoUrl,
                            mediaType = uiState.mediaType,
                        ),
                    )
                }
            },
            onClose = { dismissedSessionId = callId },
            panelMode = true,
        )
    }

    private fun sendCallAction(action: String, callId: String) {
        if (callId.isBlank()) return
        activity.startService(
            Intent(activity, PulseCallService::class.java)
                .setAction(action)
                .putExtra(PulseCallService.EXTRA_SESSION_ID, callId),
        )
    }

    private fun sendAudioRouteAction(callId: String, routeId: String) {
        if (callId.isBlank() || routeId.isBlank()) return
        activity.startService(
            Intent(activity, PulseCallService::class.java)
                .setAction(PulseCallService.ACTION_SELECT_AUDIO_ROUTE)
                .putExtra(PulseCallService.EXTRA_SESSION_ID, callId)
                .putExtra(PulseCallService.EXTRA_AUDIO_ROUTE_ID, routeId),
        )
    }
}

object PulseTabletCallPanelPolicy {
    fun shouldUsePanel(configuration: Configuration): Boolean = shouldUsePanel(
        smallestWidthDp = configuration.smallestScreenWidthDp,
        screenWidthDp = configuration.screenWidthDp,
        landscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE,
    )

    fun shouldUsePanel(
        smallestWidthDp: Int,
        screenWidthDp: Int,
        landscape: Boolean,
    ): Boolean = smallestWidthDp >= 600 && screenWidthDp >= 840 && landscape

    fun shouldDisplayCall(
        state: PulseCallState,
        direction: PulseCallDirection?,
        hasTerminalPresentation: Boolean,
    ): Boolean = state in setOf(PulseCallState.CONNECTING, PulseCallState.ACTIVE) ||
        direction == PulseCallDirection.OUTGOING &&
        state in setOf(PulseCallState.PREPARING, PulseCallState.RINGING) ||
        hasTerminalPresentation

    fun mainActivityIntent(context: android.content.Context): Intent =
        Intent(context, MainActivity::class.java).addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP,
        )
}
