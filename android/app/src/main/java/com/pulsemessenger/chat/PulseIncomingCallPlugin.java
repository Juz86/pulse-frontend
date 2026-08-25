package com.pulsemessenger.chat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PulseIncomingCall")
public class PulseIncomingCallPlugin extends Plugin {
    @PluginMethod
    public void consumePendingCall(PluginCall call) {
        call.resolve(PulseIncomingCallStore.consume(getContext()));
    }
}
