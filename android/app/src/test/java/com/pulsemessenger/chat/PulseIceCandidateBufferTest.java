package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;

import org.junit.Test;

public class PulseIceCandidateBufferTest {
    @Test
    public void buffersUntilRemoteDescriptionIsReady() {
        PulseIceCandidateBuffer<String> buffer = new PulseIceCandidateBuffer<>(3);

        assertTrue(buffer.add("first").isEmpty());
        assertTrue(buffer.add("second").isEmpty());
        assertEquals(Arrays.asList("first", "second"), buffer.markReadyAndDrain());
        assertEquals(0, buffer.pendingCount());
    }

    @Test
    public void forwardsCandidatesImmediatelyAfterDrain() {
        PulseIceCandidateBuffer<String> buffer = new PulseIceCandidateBuffer<>(3);
        buffer.markReadyAndDrain();

        assertEquals(Collections.singletonList("late"), buffer.add("late"));
    }

    @Test
    public void capsPendingCandidatesAndPreservesOrder() {
        PulseIceCandidateBuffer<String> buffer = new PulseIceCandidateBuffer<>(2);
        buffer.add("first");
        buffer.add("second");
        buffer.add("overflow");

        assertEquals(Arrays.asList("first", "second"), buffer.markReadyAndDrain());
    }

    @Test
    public void resetRequiresRemoteDescriptionAgain() {
        PulseIceCandidateBuffer<String> buffer = new PulseIceCandidateBuffer<>(2);
        buffer.markReadyAndDrain();
        buffer.reset();

        assertTrue(buffer.add("new-session").isEmpty());
        assertEquals(Collections.singletonList("new-session"), buffer.markReadyAndDrain());
    }
}
