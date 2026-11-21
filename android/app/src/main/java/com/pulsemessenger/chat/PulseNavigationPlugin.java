package com.pulsemessenger.chat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PulseNavigation")
public class PulseNavigationPlugin extends Plugin {
    private static volatile PulseNavigationPlugin instance;
    private volatile boolean interceptBackButton;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
    }

    @PluginMethod
    public void setBackNavigationEnabled(PluginCall call) {
        interceptBackButton = call.getBoolean("enabled", false);
        JSObject result = new JSObject();
        result.put("enabled", interceptBackButton);
        call.resolve(result);
    }

    public static boolean dispatchBackButton() {
        PulseNavigationPlugin plugin = instance;
        if (plugin == null || !plugin.interceptBackButton) return false;
        plugin.notifyListeners("backButton", new JSObject());
        return true;
    }
}
