package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause
import org.junit.Assert.assertEquals
import org.junit.Test

class CoreTelecomControllerTest {
    @Test
    fun `Telecom supported disconnect causes remain unchanged`() {
        listOf(
            DisconnectCause.LOCAL,
            DisconnectCause.REMOTE,
            DisconnectCause.MISSED,
            DisconnectCause.REJECTED,
        ).forEach { code ->
            assertEquals(code, normalizeDisconnectCauseCode(code))
        }
    }

    @Test
    fun `unsupported disconnect causes become local`() {
        listOf(
            DisconnectCause.UNKNOWN,
            DisconnectCause.ERROR,
            DisconnectCause.CANCELED,
            DisconnectCause.BUSY,
        ).forEach { code ->
            assertEquals(DisconnectCause.LOCAL, normalizeDisconnectCauseCode(code))
        }
    }
}
