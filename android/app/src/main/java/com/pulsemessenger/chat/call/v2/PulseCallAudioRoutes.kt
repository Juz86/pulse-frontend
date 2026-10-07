package com.pulsemessenger.chat.call.v2

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

internal enum class PulseAudioRouteType {
    EARPIECE,
    SPEAKER,
    BLUETOOTH,
    WIRED_HEADSET,
}

internal data class PulseAudioRoute(
    val id: String,
    val name: String,
    val type: PulseAudioRouteType,
)

internal data class PulseAudioRouteSnapshot(
    val sessionId: String? = null,
    val availableRoutes: List<PulseAudioRoute> = emptyList(),
    val currentRouteId: String? = null,
) {
    val currentRoute: PulseAudioRoute?
        get() = availableRoutes.firstOrNull { it.id == currentRouteId }
}

/** UI projection of the authoritative endpoint flows owned by Core-Telecom. */
internal object PulseCallAudioRoutes {
    private val mutableState = MutableStateFlow(PulseAudioRouteSnapshot())
    val state: StateFlow<PulseAudioRouteSnapshot> = mutableState.asStateFlow()

    fun begin(sessionId: String) {
        mutableState.value = PulseAudioRouteSnapshot(sessionId = sessionId)
    }

    fun updateAvailable(sessionId: String, routes: List<PulseAudioRoute>) {
        val current = mutableState.value
        if (current.sessionId != sessionId) return
        mutableState.value = current.copy(availableRoutes = routes)
    }

    fun updateCurrent(sessionId: String, route: PulseAudioRoute?) {
        val current = mutableState.value
        if (current.sessionId != sessionId) return
        val routes = if (route != null && current.availableRoutes.none { it.id == route.id }) {
            current.availableRoutes + route
        } else {
            current.availableRoutes
        }
        mutableState.value = current.copy(
            availableRoutes = routes,
            currentRouteId = route?.id,
        )
    }

    fun clear(sessionId: String) {
        if (mutableState.value.sessionId == sessionId) {
            mutableState.value = PulseAudioRouteSnapshot()
        }
    }
}
