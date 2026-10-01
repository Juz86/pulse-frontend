package com.pulsemessenger.chat.call.v2

import android.telecom.DisconnectCause

interface PulseTelecomCallbacks {
    fun onRegistered(sessionId: String)
    suspend fun onAnswer(sessionId: String, callType: Int)
    suspend fun onDisconnect(sessionId: String, cause: DisconnectCause)
    suspend fun onSetActive(sessionId: String)
    suspend fun onSetInactive(sessionId: String)
}

interface PulseTelecomController {
    fun registerApp()
    suspend fun addCall(request: PulseCallRequest, callbacks: PulseTelecomCallbacks)
    suspend fun answer(sessionId: String, callType: Int): Boolean
    suspend fun setActive(sessionId: String): Boolean
    suspend fun disconnect(sessionId: String, cause: DisconnectCause): Boolean
}
