package com.pulsemessenger.chat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PulseRealtimeKitCredentialsClientTest {
    @Test
    public void buildsEncodedJoinUrl() throws Exception {
        assertEquals(
            "https://api.example.test/api/calls/realtimekit/session/call%3A123%2F456/join",
            PulseRealtimeKitCredentialsClient.joinUrl("https://api.example.test/", "call:123/456")
        );
    }

    @Test
    public void parsesValidatedAudioCredentials() throws Exception {
        PulseRealtimeKitCredentialsClient.Credentials credentials = PulseRealtimeKitCredentialsClient.parseResponse(
            200,
            "{\"engine\":\"realtimekit-v2\",\"sessionId\":\"call-12345678\",\"authToken\":\"secret\",\"isVideo\":false}",
            "call-12345678"
        );

        assertEquals("secret", credentials.authToken);
        assertEquals("call-12345678", credentials.sessionId);
        assertFalse(credentials.video);
    }

    @Test
    public void parsesValidatedVideoCredentials() throws Exception {
        PulseRealtimeKitCredentialsClient.Credentials credentials = PulseRealtimeKitCredentialsClient.parseResponse(
            200,
            "{\"engine\":\"realtimekit-v2\",\"sessionId\":\"call-12345678\",\"authToken\":\"secret\",\"isVideo\":true}",
            "call-12345678"
        );

        assertTrue(credentials.video);
    }

    @Test
    public void preservesBackendErrorCode() {
        PulseRealtimeKitCredentialsClient.BootstrapException error = assertThrows(
            PulseRealtimeKitCredentialsClient.BootstrapException.class,
            () -> PulseRealtimeKitCredentialsClient.parseResponse(
                503,
                "{\"error\":\"realtimekit_not_configured\"}",
                "call-12345678"
            )
        );

        assertEquals(503, error.status);
        assertEquals("realtimekit_not_configured", error.code);
    }

    @Test
    public void readinessRequiresEnabledAndConfiguredServer() throws Exception {
        PulseRealtimeKitCredentialsClient.parseReadiness(
            200,
            "{\"ok\":true,\"realtimeKitCallsEnabled\":true,\"realtimeKitConfigured\":true}"
        );

        PulseRealtimeKitCredentialsClient.BootstrapException disabled = assertThrows(
            PulseRealtimeKitCredentialsClient.BootstrapException.class,
            () -> PulseRealtimeKitCredentialsClient.parseReadiness(
                200,
                "{\"ok\":true,\"realtimeKitCallsEnabled\":false,\"realtimeKitConfigured\":true}"
            )
        );
        assertEquals("realtimekit_disabled", disabled.code);

        PulseRealtimeKitCredentialsClient.BootstrapException missing = assertThrows(
            PulseRealtimeKitCredentialsClient.BootstrapException.class,
            () -> PulseRealtimeKitCredentialsClient.parseReadiness(
                200,
                "{\"ok\":true,\"realtimeKitCallsEnabled\":true,\"realtimeKitConfigured\":false}"
            )
        );
        assertEquals("realtimekit_not_configured", missing.code);
    }

    @Test
    public void mapsBootstrapCodesToSafeUserMessages() {
        assertEquals(
            "De nieuwe belverbinding staat op de server nog uit",
            PulseRealtimeKitCredentialsClient.userMessageFor(
                new PulseRealtimeKitCredentialsClient.BootstrapException(503, "realtimekit_disabled")
            )
        );
        assertEquals(
            "De nieuwe belverbinding is op de server nog niet volledig ingesteld",
            PulseRealtimeKitCredentialsClient.userMessageFor(
                new PulseRealtimeKitCredentialsClient.BootstrapException(503, "realtimekit_not_configured")
            )
        );
    }

    @Test
    public void rejectsWrongEngineOrSession() {
        assertThrows(
            PulseRealtimeKitCredentialsClient.BootstrapException.class,
            () -> PulseRealtimeKitCredentialsClient.parseResponse(
                200,
                "{\"engine\":\"legacy\",\"sessionId\":\"call-12345678\",\"authToken\":\"secret\"}",
                "call-12345678"
            )
        );
        assertThrows(
            PulseRealtimeKitCredentialsClient.BootstrapException.class,
            () -> PulseRealtimeKitCredentialsClient.parseResponse(
                200,
                "{\"engine\":\"realtimekit-v2\",\"sessionId\":\"other-call\",\"authToken\":\"secret\"}",
                "call-12345678"
            )
        );
    }
}
