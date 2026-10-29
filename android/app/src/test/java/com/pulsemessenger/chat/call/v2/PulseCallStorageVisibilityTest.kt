package com.pulsemessenger.chat.call.v2

import com.pulsemessenger.chat.e2ee.v2.PulseE2eeRecordStorage
import java.lang.reflect.Modifier
import org.junit.Assert.assertTrue
import org.junit.Test

class PulseCallStorageVisibilityTest {
    @Test
    fun e2eeRecordStorageIsAccessibleToNativeCallPackage() {
        assertTrue(Modifier.isPublic(PulseE2eeRecordStorage::class.java.modifiers))
    }
}
