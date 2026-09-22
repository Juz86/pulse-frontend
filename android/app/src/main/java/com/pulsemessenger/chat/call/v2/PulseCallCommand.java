package com.pulsemessenger.chat.call.v2;

import java.util.Objects;

public final class PulseCallCommand {
    private final String sessionId;
    private final String eventId;
    private final long sequence;
    private final PulseCallEvent event;

    public PulseCallCommand(String sessionId, String eventId, long sequence, PulseCallEvent event) {
        this.sessionId = sessionId;
        this.eventId = eventId;
        this.sequence = sequence;
        this.event = Objects.requireNonNull(event, "event");
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getEventId() {
        return eventId;
    }

    public long getSequence() {
        return sequence;
    }

    public PulseCallEvent getEvent() {
        return event;
    }
}
