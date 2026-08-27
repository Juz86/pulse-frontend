package com.pulsemessenger.chat;

import android.annotation.SuppressLint;
import android.content.Context;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

final class PulseAudioRouteController {
    interface Listener {
        void onRoutesChanged(List<PulseAudioRoute> routes, String selectedLabel);
    }

    private final Context context;
    private final AudioManager audioManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final boolean videoCall;
    private final Listener listener;
    private final AudioDeviceCallback deviceCallback;
    private Object communicationDeviceListener;
    private volatile List<PulseAudioRoute> routes = Collections.emptyList();
    private Integer selectedRouteId;
    private Integer userRouteId;
    private int previousAudioMode = AudioManager.MODE_NORMAL;
    private boolean ownsAudioMode;
    private volatile boolean started;

    PulseAudioRouteController(Context context, boolean videoCall, Listener listener) {
        this.context = context.getApplicationContext();
        this.audioManager = (AudioManager) this.context.getSystemService(Context.AUDIO_SERVICE);
        this.videoCall = videoCall;
        this.listener = listener;
        this.deviceCallback = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                mainHandler.post(() -> reconcile(preferredExternalId(addedDevices)));
            }

            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                mainHandler.post(() -> reconcile(null));
            }
        };
    }

    void start() {
        if (started || audioManager == null) return;
        started = true;
        try {
            previousAudioMode = audioManager.getMode();
            if (previousAudioMode != AudioManager.MODE_IN_COMMUNICATION) {
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                ownsAudioMode = true;
            }
        } catch (RuntimeException error) {
            android.util.Log.w("PulseAudioRoute", "Communicatiemodus instellen mislukt", error);
        }
        try {
            audioManager.registerAudioDeviceCallback(deviceCallback, mainHandler);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) registerModernRouteListener();
        } catch (RuntimeException error) {
            android.util.Log.w("PulseAudioRoute", "Audioroute-listener registreren mislukt", error);
        }
        reconcile(null);
    }

    void stop() {
        if (!started || audioManager == null) return;
        started = false;
        try {
            audioManager.unregisterAudioDeviceCallback(deviceCallback);
        } catch (RuntimeException ignored) {}
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            unregisterModernRouteListener();
            try {
                audioManager.clearCommunicationDevice();
            } catch (RuntimeException error) {
                android.util.Log.w("PulseAudioRoute", "Communicatieroute vrijgeven mislukt", error);
            }
        } else {
            clearLegacyRoute();
        }
        if (ownsAudioMode) {
            try {
                if (audioManager.getMode() == AudioManager.MODE_IN_COMMUNICATION) {
                    audioManager.setMode(previousAudioMode);
                }
            } catch (RuntimeException error) {
                android.util.Log.w("PulseAudioRoute", "Audiomodus herstellen mislukt", error);
            }
        }
        ownsAudioMode = false;
        routes = Collections.emptyList();
        selectedRouteId = null;
        userRouteId = null;
    }

    List<PulseAudioRoute> getRoutes() {
        return new ArrayList<>(routes);
    }

    String getSelectedLabel() {
        for (PulseAudioRoute route : routes) {
            if (route.selected) return route.label;
        }
        return "Automatisch";
    }

    boolean selectRoute(int routeId) {
        if (!started || !PulseAudioRoutePolicy.contains(routes, routeId)) return false;
        userRouteId = routeId;
        reconcile(null);
        return selectedRouteId != null && selectedRouteId == routeId;
    }

    void useAutomaticRoute() {
        userRouteId = null;
        selectedRouteId = null;
        reconcile(null);
    }

    boolean isAutomatic() {
        return userRouteId == null;
    }

    void refresh() {
        mainHandler.post(() -> reconcile(null));
    }

    private void reconcile(Integer newlyConnectedRouteId) {
        if (!started || audioManager == null) return;
        List<PulseAudioRoute> available = buildRoutes();
        if (available.isEmpty()) {
            publish(available, null);
            return;
        }
        if (!PulseAudioRoutePolicy.contains(available, userRouteId)) userRouteId = null;
        if (!PulseAudioRoutePolicy.contains(available, selectedRouteId)) selectedRouteId = null;

        Integer systemRouteId = currentSystemRouteId(available);
        Integer currentForPolicy = selectedRouteId;
        if (currentForPolicy == null) {
            PulseAudioRoute systemRoute = findRoute(available, systemRouteId);
            currentForPolicy = systemRoute != null && systemRoute.isExternal() ? systemRoute.id : null;
        }
        int desiredRouteId = PulseAudioRoutePolicy.choose(
            available,
            currentForPolicy,
            userRouteId,
            newlyConnectedRouteId,
            videoCall
        );
        if (desiredRouteId >= 0 && (systemRouteId == null || systemRouteId != desiredRouteId)) {
            if (!applyRoute(desiredRouteId)) {
                android.util.Log.w("PulseAudioRoute", "Audioroute kon niet worden geselecteerd: " + desiredRouteId);
            }
        }
        Integer appliedRouteId = currentSystemRouteId(available);
        selectedRouteId = PulseAudioRoutePolicy.contains(available, appliedRouteId)
            ? appliedRouteId
            : desiredRouteId >= 0 ? desiredRouteId : null;
        publish(available, selectedRouteId);
    }

    private void publish(List<PulseAudioRoute> available, Integer selectedId) {
        List<PulseAudioRoute> snapshot = new ArrayList<>();
        String selectedLabel = "Automatisch";
        for (PulseAudioRoute route : available) {
            boolean selected = selectedId != null && route.id == selectedId;
            PulseAudioRoute item = route.withSelected(selected);
            snapshot.add(item);
            if (selected) selectedLabel = route.label;
        }
        routes = Collections.unmodifiableList(snapshot);
        if (listener != null) listener.onRoutesChanged(getRoutes(), selectedLabel);
    }

    private List<PulseAudioRoute> buildRoutes() {
        List<AudioDeviceInfo> devices = availableOutputDevices();
        List<PulseAudioRoute> result = new ArrayList<>();
        for (AudioDeviceInfo device : devices) {
            PulseAudioRoute.Kind kind = kindFor(device.getType());
            if (kind == null || containsId(result, device.getId())) continue;
            result.add(new PulseAudioRoute(device.getId(), kind, labelFor(device, kind), false));
        }
        return result;
    }

    private List<AudioDeviceInfo> availableOutputDevices() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return modernCommunicationDevices();
        AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
        List<AudioDeviceInfo> result = new ArrayList<>();
        if (devices != null) Collections.addAll(result, devices);
        return result;
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private List<AudioDeviceInfo> modernCommunicationDevices() {
        try {
            return new ArrayList<>(audioManager.getAvailableCommunicationDevices());
        } catch (RuntimeException error) {
            android.util.Log.w("PulseAudioRoute", "Communicatieapparaten ophalen mislukt", error);
            return Collections.emptyList();
        }
    }

    private Integer currentSystemRouteId(List<PulseAudioRoute> available) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return modernCurrentRouteId();
        return legacyCurrentRouteId(available);
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private Integer modernCurrentRouteId() {
        AudioDeviceInfo device = audioManager.getCommunicationDevice();
        return device == null ? null : device.getId();
    }

    @SuppressWarnings("deprecation")
    private Integer legacyCurrentRouteId(List<PulseAudioRoute> available) {
        if (audioManager.isBluetoothScoOn()) {
            PulseAudioRoute bluetooth = findKind(available, PulseAudioRoute.Kind.BLUETOOTH);
            if (bluetooth != null) return bluetooth.id;
        }
        if (audioManager.isSpeakerphoneOn()) {
            PulseAudioRoute speaker = findKind(available, PulseAudioRoute.Kind.SPEAKER);
            if (speaker != null) return speaker.id;
        }
        PulseAudioRoute wired = findKind(available, PulseAudioRoute.Kind.WIRED);
        if (wired != null) return wired.id;
        PulseAudioRoute usb = findKind(available, PulseAudioRoute.Kind.USB);
        if (usb != null) return usb.id;
        PulseAudioRoute earpiece = findKind(available, PulseAudioRoute.Kind.EARPIECE);
        if (earpiece != null) return earpiece.id;
        PulseAudioRoute speaker = findKind(available, PulseAudioRoute.Kind.SPEAKER);
        return speaker == null ? null : speaker.id;
    }

    private boolean applyRoute(int routeId) {
        AudioDeviceInfo target = findDevice(routeId);
        if (target == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                return audioManager.setCommunicationDevice(target);
            }
            return applyLegacyRoute(kindFor(target.getType()));
        } catch (RuntimeException error) {
            android.util.Log.w("PulseAudioRoute", "Audioroute toepassen mislukt", error);
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private boolean applyLegacyRoute(PulseAudioRoute.Kind kind) {
        if (kind == null) return false;
        if (kind == PulseAudioRoute.Kind.BLUETOOTH) {
            audioManager.setSpeakerphoneOn(false);
            audioManager.startBluetoothSco();
            audioManager.setBluetoothScoOn(true);
            return true;
        }
        if (audioManager.isBluetoothScoOn()) {
            audioManager.setBluetoothScoOn(false);
            audioManager.stopBluetoothSco();
        }
        audioManager.setSpeakerphoneOn(kind == PulseAudioRoute.Kind.SPEAKER);
        return true;
    }

    @SuppressWarnings("deprecation")
    private void clearLegacyRoute() {
        try {
            if (audioManager.isBluetoothScoOn()) {
                audioManager.setBluetoothScoOn(false);
                audioManager.stopBluetoothSco();
            }
            audioManager.setSpeakerphoneOn(false);
        } catch (RuntimeException error) {
            android.util.Log.w("PulseAudioRoute", "Legacy audioroute vrijgeven mislukt", error);
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private void registerModernRouteListener() {
        AudioManager.OnCommunicationDeviceChangedListener routeListener = device -> {
            selectedRouteId = device == null ? null : device.getId();
            mainHandler.post(() -> reconcile(null));
        };
        communicationDeviceListener = routeListener;
        audioManager.addOnCommunicationDeviceChangedListener(
            ContextCompat.getMainExecutor(context),
            routeListener
        );
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private void unregisterModernRouteListener() {
        if (!(communicationDeviceListener instanceof AudioManager.OnCommunicationDeviceChangedListener)) return;
        try {
            audioManager.removeOnCommunicationDeviceChangedListener(
                (AudioManager.OnCommunicationDeviceChangedListener) communicationDeviceListener
            );
        } catch (RuntimeException ignored) {}
        communicationDeviceListener = null;
    }

    private Integer preferredExternalId(AudioDeviceInfo[] devices) {
        if (devices == null) return null;
        Integer result = null;
        for (AudioDeviceInfo device : devices) {
            if (device == null || !device.isSink()) continue;
            PulseAudioRoute.Kind kind = kindFor(device.getType());
            if (kind == PulseAudioRoute.Kind.BLUETOOTH
                || kind == PulseAudioRoute.Kind.WIRED
                || kind == PulseAudioRoute.Kind.USB) {
                result = device.getId();
            }
        }
        return result;
    }

    private AudioDeviceInfo findDevice(int routeId) {
        for (AudioDeviceInfo device : availableOutputDevices()) {
            if (device.getId() == routeId) return device;
        }
        return null;
    }

    private PulseAudioRoute findRoute(List<PulseAudioRoute> available, Integer routeId) {
        if (routeId == null) return null;
        for (PulseAudioRoute route : available) {
            if (route.id == routeId) return route;
        }
        return null;
    }

    private PulseAudioRoute findKind(List<PulseAudioRoute> available, PulseAudioRoute.Kind kind) {
        for (PulseAudioRoute route : available) {
            if (route.kind == kind) return route;
        }
        return null;
    }

    private boolean containsId(List<PulseAudioRoute> available, int id) {
        for (PulseAudioRoute route : available) {
            if (route.id == id) return true;
        }
        return false;
    }

    @SuppressLint("InlinedApi")
    private PulseAudioRoute.Kind kindFor(int deviceType) {
        switch (deviceType) {
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE:
                return PulseAudioRoute.Kind.EARPIECE;
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
                return PulseAudioRoute.Kind.SPEAKER;
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
            case AudioDeviceInfo.TYPE_BLE_HEADSET:
            case AudioDeviceInfo.TYPE_HEARING_AID:
                return PulseAudioRoute.Kind.BLUETOOTH;
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                return PulseAudioRoute.Kind.WIRED;
            case AudioDeviceInfo.TYPE_USB_DEVICE:
            case AudioDeviceInfo.TYPE_USB_ACCESSORY:
            case AudioDeviceInfo.TYPE_USB_HEADSET:
                return PulseAudioRoute.Kind.USB;
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
            case AudioDeviceInfo.TYPE_BLE_SPEAKER:
                return null;
            default:
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PulseAudioRoute.Kind.OTHER : null;
        }
    }

    private String labelFor(AudioDeviceInfo device, PulseAudioRoute.Kind kind) {
        String base;
        switch (kind) {
            case EARPIECE:
                return "Telefoon";
            case SPEAKER:
                return "Luidspreker";
            case BLUETOOTH:
                base = "Bluetooth";
                break;
            case WIRED:
                base = "Bekabelde headset";
                break;
            case USB:
                base = "USB-audio";
                break;
            default:
                base = "Audioapparaat";
                break;
        }
        CharSequence productName = device.getProductName();
        String product = productName == null ? "" : productName.toString().trim();
        return product.isEmpty() || product.equalsIgnoreCase(base) ? base : base + " - " + product;
    }
}
