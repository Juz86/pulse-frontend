package com.pulsemessenger.chat.call.v2

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.util.Log

internal class PulseDefaultNetworkChangeDetector<T>(
    initialNetwork: T?,
    private val onNetworkChanged: () -> Unit,
) {
    private var currentNetwork: T? = initialNetwork

    @Synchronized
    fun onAvailable(network: T) {
        val previous = currentNetwork
        currentNetwork = network
        if (previous != network) onNetworkChanged()
    }

    @Synchronized
    fun onLost(network: T) {
        if (currentNetwork == network) currentNetwork = null
    }
}

internal interface PulseNetworkMonitor {
    fun start(): Boolean
    fun stop()
}

internal class AndroidPulseNetworkMonitor(
    context: Context,
    private val onNetworkChanged: () -> Unit,
) : PulseNetworkMonitor {
    private val connectivityManager =
        context.applicationContext.getSystemService(ConnectivityManager::class.java)
    private var registered = false
    private var detector: PulseDefaultNetworkChangeDetector<Network>? = null
    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            detector?.onAvailable(network)
        }

        override fun onLost(network: Network) {
            detector?.onLost(network)
        }
    }

    @Synchronized
    override fun start(): Boolean {
        if (registered) return true
        detector = PulseDefaultNetworkChangeDetector(
            initialNetwork = connectivityManager.activeNetwork,
            onNetworkChanged = onNetworkChanged,
        )
        return runCatching {
            connectivityManager.registerDefaultNetworkCallback(callback)
            registered = true
            true
        }.onFailure { error ->
            detector = null
            Log.w(TAG, "Default network monitoring could not start", error)
        }.getOrDefault(false)
    }

    @Synchronized
    override fun stop() {
        if (!registered) return
        runCatching { connectivityManager.unregisterNetworkCallback(callback) }
            .onFailure { error -> Log.w(TAG, "Default network monitoring could not stop", error) }
        registered = false
        detector = null
    }

    private companion object {
        const val TAG = "PulseNetworkMonitor"
    }
}
