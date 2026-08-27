package com.pulsemessenger.chat;

import android.app.Activity;
import android.app.AlertDialog;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import java.util.List;

final class PulseAudioRouteDialog {
    interface Listener {
        void onRouteSelected(String label);
    }

    private final Activity activity;
    private final String sessionId;
    private final Listener listener;
    private final ArrayAdapter<String> adapter;
    private List<PulseAudioRoute> routes;
    private AlertDialog dialog;

    private PulseAudioRouteDialog(Activity activity, String sessionId, Listener listener) {
        this.activity = activity;
        this.sessionId = sessionId;
        this.listener = listener;
        this.adapter = new ArrayAdapter<>(activity, android.R.layout.select_dialog_singlechoice);
        this.routes = PulseNativeCallService.getAudioRoutes(sessionId);
    }

    static PulseAudioRouteDialog show(Activity activity, String sessionId, Listener listener) {
        if (activity == null || sessionId == null) return null;
        PulseAudioRouteDialog routeDialog = new PulseAudioRouteDialog(activity, sessionId, listener);
        routeDialog.showInternal();
        return routeDialog;
    }

    private void showInternal() {
        if (routes.isEmpty()) {
            Toast.makeText(activity, "Geen audio-uitvoer beschikbaar", Toast.LENGTH_SHORT).show();
            return;
        }
        replaceLabels();
        dialog = new AlertDialog.Builder(activity)
            .setTitle("Audio-uitvoer")
            .setSingleChoiceItems(adapter, checkedIndex(), (selectedDialog, which) -> {
                if (which == 0) {
                    PulseNativeCallService.useAutomaticAudioRoute(sessionId);
                } else if (which <= routes.size()) {
                    PulseNativeCallService.selectAudioRoute(sessionId, routes.get(which - 1).id);
                }
                if (listener != null) {
                    listener.onRouteSelected(PulseNativeCallService.getSelectedAudioRouteLabel(sessionId));
                }
                selectedDialog.dismiss();
            })
            .setNegativeButton("Annuleren", null)
            .create();
        dialog.show();
    }

    void refresh() {
        if (dialog == null || !dialog.isShowing()) return;
        routes = PulseNativeCallService.getAudioRoutes(sessionId);
        if (routes.isEmpty()) {
            dialog.dismiss();
            return;
        }
        replaceLabels();
        dialog.getListView().setItemChecked(checkedIndex(), true);
    }

    void dismiss() {
        if (dialog != null) dialog.dismiss();
    }

    private void replaceLabels() {
        adapter.clear();
        adapter.add("Automatisch");
        for (PulseAudioRoute route : routes) adapter.add(route.label);
        adapter.notifyDataSetChanged();
    }

    private int checkedIndex() {
        if (PulseNativeCallService.isAudioRouteAutomatic(sessionId)) return 0;
        for (int index = 0; index < routes.size(); index++) {
            if (routes.get(index).selected) return index + 1;
        }
        return -1;
    }
}
