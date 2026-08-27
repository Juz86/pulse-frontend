package com.pulsemessenger.chat;

final class PulseAudioRoute {
    enum Kind {
        EARPIECE,
        SPEAKER,
        BLUETOOTH,
        WIRED,
        USB,
        OTHER
    }

    final int id;
    final Kind kind;
    final String label;
    final boolean selected;

    PulseAudioRoute(int id, Kind kind, String label, boolean selected) {
        this.id = id;
        this.kind = kind;
        this.label = label;
        this.selected = selected;
    }

    PulseAudioRoute withSelected(boolean value) {
        return new PulseAudioRoute(id, kind, label, value);
    }

    boolean isExternal() {
        return kind == Kind.BLUETOOTH || kind == Kind.WIRED || kind == Kind.USB;
    }
}
