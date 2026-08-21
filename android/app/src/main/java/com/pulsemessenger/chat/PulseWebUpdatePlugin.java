package com.pulsemessenger.chat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "PulseWebUpdate")
public class PulseWebUpdatePlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void stageUpdate(PluginCall call) {
        worker.execute(() -> {
            try {
                PulseWebUpdateManager.Result result = PulseWebUpdateManager.stageLatest(getContext());
                JSObject response = new JSObject();
                response.put("ok", true);
                response.put("enabled", result.enabled);
                response.put("staged", result.staged);
                response.put("current", result.current);
                response.put("version", result.version);
                response.put("requiresRestart", result.staged);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("native_web_update_failed", error.getMessage(), error);
            }
        });
    }

    @PluginMethod
    public void markBundleHealthy(PluginCall call) {
        PulseWebUpdateManager.markHealthy(getContext());
        JSObject response = new JSObject();
        response.put("ok", true);
        call.resolve(response);
    }

    @Override
    protected void handleOnDestroy() {
        worker.shutdownNow();
        super.handleOnDestroy();
    }
}
