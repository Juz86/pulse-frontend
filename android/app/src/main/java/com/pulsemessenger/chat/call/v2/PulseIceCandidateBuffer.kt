package com.pulsemessenger.chat.call.v2

internal class PulseIceCandidateBuffer(
    private val capacity: Int = DEFAULT_CAPACITY,
) {
    private val pending = ArrayDeque<PulseIceCandidate>()
    private var remoteDescriptionApplied = false

    init {
        require(capacity > 0) { "ICE candidate buffer capacity must be positive" }
    }

    fun offer(candidate: PulseIceCandidate): PulseIceCandidate? {
        if (remoteDescriptionApplied) return candidate
        check(pending.size < capacity) { "ICE candidate buffer capacity exceeded" }
        pending.addLast(candidate)
        return null
    }

    fun markRemoteDescriptionApplied(): List<PulseIceCandidate> {
        if (remoteDescriptionApplied) return emptyList()
        remoteDescriptionApplied = true
        return buildList(pending.size) {
            while (pending.isNotEmpty()) add(pending.removeFirst())
        }
    }

    fun clear() {
        pending.clear()
        remoteDescriptionApplied = false
    }

    private companion object {
        const val DEFAULT_CAPACITY = 128
    }
}
