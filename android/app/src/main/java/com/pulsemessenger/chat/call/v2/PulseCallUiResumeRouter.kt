package com.pulsemessenger.chat.call.v2

import android.os.Build
import com.pulsemessenger.chat.MainActivity

/** Restores the native call surface when the launcher reopens Pulse during a call. */
object PulseCallUiResumeRouter {
    @JvmStatic
    fun restoreActiveCall(activity: MainActivity): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val snapshot = PulseCallCoordinator.instance.state.value
        if (!shouldRestore(snapshot, activity.resources.configuration)) return false
        activity.startActivity(
            PulseCallActivity.intent(
                context = activity,
                callId = snapshot.sessionId.orEmpty(),
                peerUid = snapshot.peerUid.orEmpty(),
                displayName = snapshot.displayName.orEmpty(),
                photoUrl = snapshot.photoUrl,
                direction = snapshot.direction ?: PulseCallDirection.OUTGOING,
                mediaType = snapshot.mediaType ?: PulseCallMediaType.AUDIO,
            ),
        )
        return true
    }

    internal fun shouldRestore(
        snapshot: PulseCallSnapshot,
        configuration: android.content.res.Configuration,
    ): Boolean = shouldRestore(
        sessionId = snapshot.sessionId,
        state = snapshot.state,
        tabletPanel = PulseTabletCallPanelPolicy.shouldUsePanel(configuration),
    )

    internal fun shouldRestore(
        sessionId: String?,
        state: PulseCallState,
        tabletPanel: Boolean,
    ): Boolean = !tabletPanel &&
        !sessionId.isNullOrBlank() &&
        state in setOf(PulseCallState.CONNECTING, PulseCallState.ACTIVE)
}
