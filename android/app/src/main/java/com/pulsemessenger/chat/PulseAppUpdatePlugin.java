package com.pulsemessenger.chat;

import android.content.pm.PackageManager;
import android.os.Build;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.InstallState;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

@CapacitorPlugin(name = "PulseAppUpdate")
public class PulseAppUpdatePlugin extends Plugin {

    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateListener;
    private ActivityResultLauncher<IntentSenderRequest> activityLauncher;
    private int currentFlowType = AppUpdateType.FLEXIBLE;

    @Override
    public void load() {
        super.load();
        appUpdateManager = AppUpdateManagerFactory.create(getContext());

        installStateListener = this::emitInstallState;
        appUpdateManager.registerListener(installStateListener);

        activityLauncher = bridge.registerForActivityResult(
            new androidx.activity.result.contract.ActivityResultContracts.StartIntentSenderForResult(),
            result -> {
                JSObject payload = new JSObject();
                payload.put("type", "flowResult");
                payload.put("resultCode", result.getResultCode());
                payload.put("flowType", currentFlowType == AppUpdateType.IMMEDIATE ? "immediate" : "flexible");
                notifyListeners("updateStatusChanged", payload);
            }
        );
    }

    @Override
    protected void handleOnDestroy() {
        if (appUpdateManager != null && installStateListener != null) {
            appUpdateManager.unregisterListener(installStateListener);
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getUpdateStatus(PluginCall call) {
        try {
            appUpdateManager.getAppUpdateInfo()
                .addOnSuccessListener(info -> call.resolve(toUpdateStatus(info)))
                .addOnFailureListener(error -> {
                    JSObject payload = new JSObject();
                    payload.put("ok", false);
                    payload.put("error", "play_update_info_unavailable");
                    payload.put("message", safeMessage(error));
                    payload.put("installedFromPlay", isInstalledFromPlay());
                    payload.put("clientVersionCode", getClientVersionCode());
                    call.resolve(payload);
                });
        } catch (Exception error) {
            JSObject payload = new JSObject();
            payload.put("ok", false);
            payload.put("error", "play_update_init_failed");
            payload.put("message", safeMessage(error));
            payload.put("installedFromPlay", isInstalledFromPlay());
            payload.put("clientVersionCode", getClientVersionCode());
            call.resolve(payload);
        }
    }

    @PluginMethod
    public void startFlexibleUpdate(PluginCall call) {
        startUpdateFlow(call, AppUpdateType.FLEXIBLE);
    }

    @PluginMethod
    public void startImmediateUpdate(PluginCall call) {
        startUpdateFlow(call, AppUpdateType.IMMEDIATE);
    }

    @PluginMethod
    public void completeFlexibleUpdate(PluginCall call) {
        try {
            appUpdateManager.completeUpdate()
                .addOnSuccessListener(unused -> {
                    JSObject payload = new JSObject();
                    payload.put("ok", true);
                    call.resolve(payload);
                })
                .addOnFailureListener(error -> call.reject("complete_update_failed", safeMessage(error)));
        } catch (Exception error) {
            call.reject("complete_update_exception", safeMessage(error));
        }
    }

    private void startUpdateFlow(PluginCall call, int flowType) {
        if (!isInstalledFromPlay()) {
            call.reject("not_installed_from_play");
            return;
        }

        currentFlowType = flowType;
        appUpdateManager.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                boolean allowed = info.isUpdateTypeAllowed(flowType);
                if (!allowed) {
                    call.reject("update_type_not_allowed");
                    return;
                }

                try {
                    appUpdateManager.startUpdateFlowForResult(
                        info,
                        activityLauncher,
                        com.google.android.play.core.appupdate.AppUpdateOptions.newBuilder(flowType).build()
                    );
                    JSObject payload = new JSObject();
                    payload.put("ok", true);
                    payload.put("flowType", flowType == AppUpdateType.IMMEDIATE ? "immediate" : "flexible");
                    call.resolve(payload);
                } catch (Exception error) {
                    call.reject("start_update_flow_failed", safeMessage(error));
                }
            })
            .addOnFailureListener(error -> call.reject("update_info_failed", safeMessage(error)));
    }

    @NonNull
    private JSObject toUpdateStatus(AppUpdateInfo info) {
        JSObject payload = new JSObject();
        payload.put("ok", true);
        payload.put("installedFromPlay", isInstalledFromPlay());
        payload.put("clientVersionCode", getClientVersionCode());
        payload.put("availableVersionCode", info.availableVersionCode());
        payload.put("updateAvailability", info.updateAvailability());
        payload.put("installStatus", info.installStatus());
        payload.put("isUpdateAvailable", info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE);
        payload.put("isUpdateInProgress", info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS);
        payload.put("isFlexibleAllowed", info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
        payload.put("isImmediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
        return payload;
    }

    private void emitInstallState(InstallState state) {
        JSObject payload = new JSObject();
        payload.put("type", "installState");
        payload.put("installStatus", state.installStatus());
        payload.put("bytesDownloaded", state.bytesDownloaded());
        payload.put("totalBytesToDownload", state.totalBytesToDownload());
        payload.put("isDownloaded", state.installStatus() == InstallStatus.DOWNLOADED);
        notifyListeners("updateStatusChanged", payload);
    }

    private long getClientVersionCode() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).getLongVersionCode();
            }
            return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionCode;
        } catch (Exception ignored) {
            return -1;
        }
    }

    private boolean isInstalledFromPlay() {
        try {
            PackageManager pm = getContext().getPackageManager();
            String installer;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                installer = pm.getInstallSourceInfo(getContext().getPackageName()).getInstallingPackageName();
            } else {
                installer = pm.getInstallerPackageName(getContext().getPackageName());
            }
            return "com.android.vending".equals(installer);
        } catch (Exception ignored) {
            return false;
        }
    }

    private String safeMessage(Throwable error) {
        if (error == null || error.getMessage() == null) return "unknown_error";
        return String.valueOf(error.getMessage());
    }
}
