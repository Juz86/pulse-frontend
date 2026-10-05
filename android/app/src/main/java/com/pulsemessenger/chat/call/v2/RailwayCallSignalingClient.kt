package com.pulsemessenger.chat.call.v2

import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class RailwayCallSignalingClient internal constructor(
    private val socketFactory: RailwayCallSocketFactory,
    private val acknowledgementTimeoutMs: Long = ACKNOWLEDGEMENT_TIMEOUT_MS,
    private val acknowledgementAttempts: Int = ACKNOWLEDGEMENT_ATTEMPTS,
) : PulseCallSignalingGateway {
    constructor(endpoint: URI) : this(SocketIoRailwayCallSocketFactory(endpoint))

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val connectionMutex = Mutex()
    private val generation = AtomicLong(0)
    private val activeSessionId = AtomicReference<String?>(null)
    private val socket = AtomicReference<RailwayCallSocket?>(null)
    private val mediaDedupeLock = Any()
    private val receivedMediaMessageIds = LinkedHashSet<String>()

    @Volatile
    private var listener: PulseCallSignalingListener? = null

    override suspend fun connect(authToken: String, listener: PulseCallSignalingListener) {
        require(authToken.isNotBlank()) { "Calling v2 requires an authentication token" }
        connectionMutex.withLock {
            disconnectLocked(notify = false)
            this.listener = listener
            val currentGeneration = generation.incrementAndGet()
            val everConnected = AtomicBoolean(false)
            val newSocket = socketFactory.create(authToken)
            socket.set(newSocket)

            withTimeout(CONNECTION_TIMEOUT_MS) {
                suspendCancellableCoroutine { continuation ->
                    newSocket.on(Socket.EVENT_CONNECT) {
                        if (!isCurrent(newSocket, currentGeneration)) return@on
                        val reconnect = everConnected.getAndSet(true)
                        listener.onConnectionChanged(true)
                        if (continuation.isActive) continuation.resume(Unit)
                        if (reconnect) reconcileAfterReconnect(newSocket, currentGeneration)
                    }
                    newSocket.on(Socket.EVENT_DISCONNECT) {
                        if (isCurrent(newSocket, currentGeneration)) {
                            listener.onConnectionChanged(false)
                        }
                    }
                    newSocket.on(Socket.EVENT_CONNECT_ERROR) { args ->
                        if (!isCurrent(newSocket, currentGeneration) || !continuation.isActive) return@on
                        val cause = args.firstOrNull() as? Throwable
                        continuation.resumeWithException(
                            cause ?: IllegalStateException("Calling v2 connection failed"),
                        )
                    }
                    newSocket.on(RailwayCallingV2Codec.EVENT_UPDATED) { args ->
                        if (!isCurrent(newSocket, currentGeneration)) return@on
                        decodeSession(args.firstOrNull())?.let(::dispatchSession)
                    }
                    newSocket.on(RailwayCallingV2Codec.EVENT_MEDIA) { args ->
                        if (!isCurrent(newSocket, currentGeneration)) return@on
                        dispatchMediaSignal(args.firstOrNull())
                    }
                    continuation.invokeOnCancellation {
                        if (isCurrent(newSocket, currentGeneration)) disconnectLocked(notify = true)
                    }
                    newSocket.connect()
                }
            }
        }
    }

    override suspend fun startCall(
        requestId: String,
        calleeUid: String,
        mediaType: PulseCallMediaType,
    ): PulseSignalingResponse {
        require(requestId.isNotBlank()) { "requestId is required" }
        require(calleeUid.isNotBlank()) { "calleeUid is required" }
        return emitWithAcknowledgement(
            RailwayCallingV2Codec.EVENT_START,
            RailwayCallingV2Codec.encodeStart(requestId, calleeUid, mediaType),
        ).also(::rememberSession)
    }

    override suspend fun sendCommand(
        sessionId: String,
        eventId: String,
        expectedRevision: Long,
        command: PulseSignalingCommand,
        reason: String?,
        installationId: String?,
    ): PulseSignalingResponse {
        require(sessionId.isNotBlank()) { "sessionId is required" }
        require(eventId.isNotBlank()) { "eventId is required" }
        require(expectedRevision > 0) { "expectedRevision must be positive" }
        return emitWithAcknowledgement(
            RailwayCallingV2Codec.EVENT_COMMAND,
            RailwayCallingV2Codec.encodeCommand(
                sessionId,
                eventId,
                expectedRevision,
                command,
                reason,
                installationId,
            ),
        ).also(::rememberSession)
    }

    override suspend fun fetchSnapshot(sessionId: String): PulseSignalingResponse {
        require(sessionId.isNotBlank()) { "sessionId is required" }
        return emitWithAcknowledgement(
            RailwayCallingV2Codec.EVENT_SNAPSHOT,
            RailwayCallingV2Codec.encodeSnapshotRequest(sessionId),
        ).also(::rememberSession)
    }

    override suspend fun fetchIceConfiguration(sessionId: String): PulseIceConfigurationResponse {
        require(sessionId.isNotBlank()) { "sessionId is required" }
        val payload = RailwayCallingV2Codec.encodeSnapshotRequest(sessionId)
        repeat(acknowledgementAttempts.coerceAtLeast(1)) {
            val currentSocket = socket.get()
            if (currentSocket == null || !currentSocket.connected()) {
                return unavailableIceConfiguration()
            }
            val response = withTimeoutOrNull(acknowledgementTimeoutMs) {
                suspendCancellableCoroutine { continuation ->
                    currentSocket.emit(RailwayCallingV2Codec.EVENT_ICE_CONFIG, payload) { args ->
                        if (!continuation.isActive) return@emit
                        val decoded = runCatching {
                            RailwayCallingV2Codec.decodeIceConfiguration(
                                args.firstOrNull() as? JSONObject
                                    ?: throw IllegalArgumentException("Missing ICE acknowledgement"),
                            )
                        }.getOrElse { unavailableIceConfiguration() }
                        continuation.resume(decoded)
                    }
                }
            }
            if (response != null) return response
        }
        return unavailableIceConfiguration()
    }

    override suspend fun sendDescription(
        sessionId: String,
        messageId: String,
        description: PulseSessionDescription,
    ): PulseSignalingResponse {
        require(sessionId.isNotBlank()) { "sessionId is required" }
        require(messageId.isNotBlank()) { "messageId is required" }
        return emitWithAcknowledgement(
            RailwayCallingV2Codec.EVENT_MEDIA,
            RailwayCallingV2Codec.encodeDescription(sessionId, messageId, description),
        )
    }

    override suspend fun sendIceCandidate(
        sessionId: String,
        messageId: String,
        candidate: PulseIceCandidate,
    ): PulseSignalingResponse {
        require(sessionId.isNotBlank()) { "sessionId is required" }
        require(messageId.isNotBlank()) { "messageId is required" }
        return emitWithAcknowledgement(
            RailwayCallingV2Codec.EVENT_MEDIA,
            RailwayCallingV2Codec.encodeIceCandidate(sessionId, messageId, candidate),
        )
    }

    override fun disconnect() {
        disconnectLocked(notify = true)
    }

    private suspend fun emitWithAcknowledgement(
        event: String,
        payload: JSONObject,
    ): PulseSignalingResponse {
        repeat(acknowledgementAttempts.coerceAtLeast(1)) {
            val currentSocket = socket.get()
            if (currentSocket == null || !currentSocket.connected()) {
                return unavailableResponse()
            }
            val response = withTimeoutOrNull(acknowledgementTimeoutMs) {
                suspendCancellableCoroutine { continuation ->
                    currentSocket.emit(event, payload) { args ->
                        if (!continuation.isActive) return@emit
                        val decoded = decodeResponse(args.firstOrNull()) ?: unavailableResponse()
                        continuation.resume(decoded)
                    }
                }
            }
            if (response != null) return response
        }
        return unavailableResponse()
    }

    private fun reconcileAfterReconnect(
        expectedSocket: RailwayCallSocket,
        expectedGeneration: Long,
    ) {
        val sessionId = activeSessionId.get() ?: return
        scope.launch {
            if (!isCurrent(expectedSocket, expectedGeneration)) return@launch
            val response = fetchSnapshot(sessionId)
            response.session?.let(::dispatchSession)
        }
    }

    private fun rememberSession(response: PulseSignalingResponse) {
        val session = response.session ?: return
        if (session.state == PulseServerCallState.ENDED) {
            activeSessionId.compareAndSet(session.sessionId, null)
        } else {
            activeSessionId.set(session.sessionId)
        }
    }

    private fun dispatchSession(session: PulseServerCallSession) {
        rememberSession(PulseSignalingResponse(ok = true, PulseSignalingStatus.FOUND, session))
        listener?.onSessionUpdated(session)
    }

    private fun decodeResponse(value: Any?): PulseSignalingResponse? = runCatching {
        RailwayCallingV2Codec.decodeResponse(value as? JSONObject ?: return null)
    }.getOrNull()

    private fun decodeSession(value: Any?): PulseServerCallSession? = runCatching {
        RailwayCallingV2Codec.decodeSession(value as? JSONObject ?: return null)
    }.getOrNull()

    private fun dispatchMediaSignal(value: Any?) {
        val signal = runCatching {
            RailwayCallingV2Codec.decodeMediaSignal(value as? JSONObject ?: return)
        }.getOrNull() ?: return
        if (activeSessionId.get() != signal.sessionId || !markMediaMessageReceived(signal.messageId)) {
            return
        }
        listener?.onMediaSignal(signal)
    }

    private fun markMediaMessageReceived(messageId: String): Boolean =
        synchronized(mediaDedupeLock) {
            if (!receivedMediaMessageIds.add(messageId)) return@synchronized false
            if (receivedMediaMessageIds.size > MEDIA_MESSAGE_CACHE_CAPACITY) {
                val oldest = receivedMediaMessageIds.iterator()
                if (oldest.hasNext()) {
                    oldest.next()
                    oldest.remove()
                }
            }
            true
        }

    private fun isCurrent(expectedSocket: RailwayCallSocket, expectedGeneration: Long): Boolean =
        socket.get() === expectedSocket && generation.get() == expectedGeneration

    private fun disconnectLocked(notify: Boolean) {
        generation.incrementAndGet()
        val oldSocket = socket.getAndSet(null)
        oldSocket?.off()
        oldSocket?.disconnect()
        activeSessionId.set(null)
        synchronized(mediaDedupeLock) {
            receivedMediaMessageIds.clear()
        }
        if (notify && oldSocket != null) listener?.onConnectionChanged(false)
        listener = null
    }

    private fun unavailableResponse() = PulseSignalingResponse(
        ok = false,
        status = PulseSignalingStatus.SERVICE_UNAVAILABLE,
    )

    private fun unavailableIceConfiguration() = PulseIceConfigurationResponse(
        ok = false,
        status = PulseSignalingStatus.SERVICE_UNAVAILABLE,
    )

    private companion object {
        const val CONNECTION_TIMEOUT_MS = 10_000L
        const val ACKNOWLEDGEMENT_TIMEOUT_MS = 5_000L
        const val ACKNOWLEDGEMENT_ATTEMPTS = 3
        const val MEDIA_MESSAGE_CACHE_CAPACITY = 512
    }
}

internal fun interface RailwayCallSocketFactory {
    fun create(authToken: String): RailwayCallSocket
}

internal interface RailwayCallSocket {
    fun on(event: String, listener: (Array<out Any?>) -> Unit)
    fun emit(event: String, payload: JSONObject, acknowledgement: (Array<out Any?>) -> Unit)
    fun connect()
    fun disconnect()
    fun connected(): Boolean
    fun off()
}

private class SocketIoRailwayCallSocketFactory(
    private val endpoint: URI,
) : RailwayCallSocketFactory {
    override fun create(authToken: String): RailwayCallSocket {
        val options = IO.Options.builder()
            .setAuth(mapOf("token" to authToken))
            .setTransports(arrayOf("websocket", "polling"))
            .setUpgrade(true)
            .setRememberUpgrade(true)
            .setReconnection(true)
            .setReconnectionAttempts(Int.MAX_VALUE)
            .setReconnectionDelay(500)
            .setReconnectionDelayMax(2_000)
            .setTimeout(10_000)
            .setForceNew(true)
            .build()
        return SocketIoRailwayCallSocket(IO.socket(endpoint, options))
    }
}

private class SocketIoRailwayCallSocket(
    private val delegate: Socket,
) : RailwayCallSocket {
    override fun on(event: String, listener: (Array<out Any?>) -> Unit) {
        delegate.on(event) { args -> listener(args) }
    }

    override fun emit(
        event: String,
        payload: JSONObject,
        acknowledgement: (Array<out Any?>) -> Unit,
    ) {
        delegate.emit(event, payload, Ack { args -> acknowledgement(args) })
    }

    override fun connect() {
        delegate.connect()
    }

    override fun disconnect() {
        delegate.disconnect()
    }

    override fun connected(): Boolean = delegate.connected()

    override fun off() {
        delegate.off()
    }
}
