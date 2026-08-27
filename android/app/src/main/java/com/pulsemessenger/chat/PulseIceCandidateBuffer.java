package com.pulsemessenger.chat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

final class PulseIceCandidateBuffer<T> {
    private final int capacity;
    private final List<T> pending = new ArrayList<>();
    private boolean ready;

    PulseIceCandidateBuffer(int capacity) {
        if (capacity < 1) throw new IllegalArgumentException("capacity must be positive");
        this.capacity = capacity;
    }

    synchronized List<T> add(T candidate) {
        if (candidate == null) return Collections.emptyList();
        if (ready) return Collections.singletonList(candidate);
        if (pending.size() < capacity) pending.add(candidate);
        return Collections.emptyList();
    }

    synchronized List<T> markReadyAndDrain() {
        ready = true;
        if (pending.isEmpty()) return Collections.emptyList();
        List<T> drained = new ArrayList<>(pending);
        pending.clear();
        return drained;
    }

    synchronized void reset() {
        ready = false;
        pending.clear();
    }

    synchronized int pendingCount() {
        return pending.size();
    }
}
