package com.pulsemessenger.chat;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import java.util.Locale;

public class PulseNativeAudioCallActivity extends Activity {
    private String sessionId;
    private TextView statusView;
    private BroadcastReceiver callReceiver;

    static void show(Context context, String sessionId, String callerName) {
        if (context == null || sessionId == null) return;
        Intent intent = new Intent(context, PulseNativeAudioCallActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId)
            .putExtra(PulseTelecomManager.EXTRA_CALLER_NAME, callerName);
        try {
            context.startActivity(intent);
        } catch (RuntimeException error) {
            android.util.Log.w("PulseNativeCall", "Actief oproepscherm kon niet openen", error);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().setStatusBarColor(0xff0b1020);
        getWindow().setNavigationBarColor(Color.BLACK);
        readIntent(getIntent());
        setContentView(buildContent());
        registerCallReceiver();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
    }

    private void readIntent(Intent intent) {
        sessionId = intent == null ? null : intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID);
    }

    private View buildContent() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff0b1020);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(24), dp(72), dp(24), dp(42));

        String name = getIntent().getStringExtra(PulseTelecomManager.EXTRA_CALLER_NAME);
        if (name == null || name.trim().isEmpty()) name = "Pulse-oproep";
        TextView caller = text(name, 34, Color.WHITE);
        caller.setGravity(Gravity.CENTER);
        content.addView(caller, matchWrap());

        statusView = text(PulseNativeCallService.isConnected(sessionId) ? "Verbonden" : "Verbinden...", 18, 0xffc6c8d2);
        statusView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = matchWrap();
        statusParams.topMargin = dp(10);
        content.addView(statusView, statusParams);

        TextView avatar = text(initial(name), 72, Color.WHITE);
        avatar.setGravity(Gravity.CENTER);
        GradientDrawable avatarBackground = new GradientDrawable();
        avatarBackground.setShape(GradientDrawable.OVAL);
        avatarBackground.setColor(0xff6c4ed6);
        avatar.setBackground(avatarBackground);
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(dp(210), dp(210));
        avatarParams.topMargin = dp(96);
        content.addView(avatar, avatarParams);

        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER);
        ImageButton microphone = control(R.drawable.pulse_mic_on, "Microfoon uitschakelen", 0xff343849);
        microphone.setOnClickListener(view -> {
            boolean enabled = PulseNativeCallService.toggleMicrophone(sessionId);
            microphone.setImageResource(enabled ? R.drawable.pulse_mic_on : R.drawable.pulse_mic_off);
            microphone.setContentDescription(enabled ? "Microfoon uitschakelen" : "Microfoon inschakelen");
        });
        controls.addView(microphone, controlParams());

        ImageButton end = control(R.drawable.pulse_call_decline, "Ophangen", 0xffef233c);
        end.setOnClickListener(view -> {
            PulseNativeCallService.stop(this, sessionId, true);
            finish();
        });
        controls.addView(end, controlParams());
        LinearLayout.LayoutParams controlsParams = matchWrap();
        controlsParams.topMargin = dp(110);
        content.addView(controls, controlsParams);

        root.addView(content, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        return root;
    }

    private void registerCallReceiver() {
        callReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String eventSessionId = intent == null ? null : intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID);
                if (sessionId == null || !sessionId.equals(eventSessionId)) return;
                if (PulseNativeCallService.ACTION_NATIVE_CALL_CONNECTED.equals(intent.getAction())) {
                    statusView.setText("Verbonden");
                } else if (PulseNativeCallService.ACTION_NATIVE_CALL_RECONNECTING.equals(intent.getAction())) {
                    statusView.setText("Opnieuw verbinden...");
                } else {
                    finish();
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(PulseNativeCallService.ACTION_NATIVE_CALL_CONNECTED);
        filter.addAction(PulseNativeCallService.ACTION_NATIVE_CALL_RECONNECTING);
        filter.addAction(PulseNativeCallService.ACTION_NATIVE_CALL_FINISHED);
        ContextCompat.registerReceiver(this, callReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private ImageButton control(int icon, String description, int color) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(icon);
        button.setColorFilter(Color.WHITE);
        button.setContentDescription(description);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) button.setTooltipText(description);
        button.setPadding(dp(18), dp(18), dp(18), dp(18));
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(color);
        button.setBackground(background);
        return button;
    }

    private LinearLayout.LayoutParams controlParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(72), dp(72));
        params.setMargins(dp(18), 0, dp(18), 0);
        return params;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private TextView text(String value, int sizeSp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setLetterSpacing(0f);
        return view;
    }

    private String initial(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isEmpty() ? "P" : trimmed.substring(0, 1).toUpperCase(Locale.ROOT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        if (callReceiver != null) unregisterReceiver(callReceiver);
        super.onDestroy();
    }
}
