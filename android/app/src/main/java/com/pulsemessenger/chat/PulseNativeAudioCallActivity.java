package com.pulsemessenger.chat;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.Locale;

public class PulseNativeAudioCallActivity extends Activity {
    private String sessionId;
    private TextView statusView;
    private ImageButton audioRouteButton;
    private PulseAudioRouteDialog audioRouteDialog;
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
        rebuildContent();
        registerCallReceiver();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
        rebuildContent();
    }

    private void readIntent(Intent intent) {
        sessionId = intent == null ? null : intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID);
    }

    private void rebuildContent() {
        setContentView(buildContent());
    }

    private View buildContent() {
        Configuration configuration = getResources().getConfiguration();
        PulseCallWindowProfile profile = PulseCallWindowProfile.from(
            configuration.screenWidthDp,
            configuration.screenHeightDp
        );
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff0b1020);
        applySystemBarInsets(root);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(profile.useTwoPaneAudioLayout() ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(dp(24), dp(24), dp(24), dp(24));

        String name = getIntent().getStringExtra(PulseTelecomManager.EXTRA_CALLER_NAME);
        if (name == null || name.trim().isEmpty()) name = "Pulse-oproep";
        LinearLayout identity = buildIdentity(profile, name);
        LinearLayout controls = buildControls(profile);
        if (profile.useTwoPaneAudioLayout()) {
            content.addView(identity, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f));
            LinearLayout.LayoutParams controlsParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );
            controlsParams.setMargins(dp(24), 0, dp(24), 0);
            content.addView(controls, controlsParams);
        } else {
            content.addView(identity, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
            content.addView(controls, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ));
        }

        FrameLayout.LayoutParams contentParams = new FrameLayout.LayoutParams(
            dp(profile.contentWidthDp),
            FrameLayout.LayoutParams.MATCH_PARENT,
            Gravity.CENTER
        );
        root.addView(content, contentParams);
        return root;
    }

    private LinearLayout buildIdentity(PulseCallWindowProfile profile, String name) {
        LinearLayout identity = new LinearLayout(this);
        identity.setOrientation(LinearLayout.VERTICAL);
        identity.setGravity(Gravity.CENTER);
        TextView caller = text(name, 34, Color.WHITE);
        caller.setGravity(Gravity.CENTER);
        caller.setMaxLines(2);
        identity.addView(caller, matchWrap());

        statusView = text(PulseNativeCallService.isConnected(sessionId) ? "Verbonden" : "Verbinden...", 18, 0xffc6c8d2);
        statusView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = matchWrap();
        statusParams.topMargin = dp(10);
        identity.addView(statusView, statusParams);

        TextView avatar = text(initial(name), 72, Color.WHITE);
        avatar.setGravity(Gravity.CENTER);
        GradientDrawable avatarBackground = new GradientDrawable();
        avatarBackground.setShape(GradientDrawable.OVAL);
        avatarBackground.setColor(0xff6c4ed6);
        avatar.setBackground(avatarBackground);
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(
            dp(profile.avatarSizeDp),
            dp(profile.avatarSizeDp)
        );
        avatarParams.topMargin = dp(profile.landscape ? 20 : 36);
        identity.addView(avatar, avatarParams);
        return identity;
    }

    private LinearLayout buildControls(PulseCallWindowProfile profile) {
        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER);
        boolean microphoneEnabled = PulseNativeCallService.isMicrophoneEnabled(sessionId);
        ImageButton microphone = control(
            microphoneEnabled ? R.drawable.pulse_mic_on : R.drawable.pulse_mic_off,
            microphoneEnabled ? "Microfoon uitschakelen" : "Microfoon inschakelen",
            0xff343849
        );
        microphone.setOnClickListener(view -> {
            boolean enabled = PulseNativeCallService.toggleMicrophone(sessionId);
            microphone.setImageResource(enabled ? R.drawable.pulse_mic_on : R.drawable.pulse_mic_off);
            microphone.setContentDescription(enabled ? "Microfoon uitschakelen" : "Microfoon inschakelen");
        });
        ImageButton end = control(R.drawable.pulse_call_decline, "Ophangen", 0xffef233c);
        end.setOnClickListener(view -> {
            PulseCallCoordinator.end(this, sessionId, true);
            finish();
        });
        String routeLabel = PulseNativeCallService.getSelectedAudioRouteLabel(sessionId);
        audioRouteButton = control(
            R.drawable.pulse_audio_route,
            "Audio-uitvoer: " + routeLabel,
            0xff343849
        );
        audioRouteButton.setOnClickListener(view -> audioRouteDialog = PulseAudioRouteDialog.show(
            this,
            sessionId,
            this::updateAudioRouteButton
        ));
        controls.addView(microphone, controlParams(profile));
        controls.addView(audioRouteButton, controlParams(profile));
        controls.addView(end, controlParams(profile));
        return controls;
    }

    private void updateAudioRouteButton(String label) {
        if (audioRouteButton == null) return;
        String description = "Audio-uitvoer: " + (label == null ? "Automatisch" : label);
        audioRouteButton.setContentDescription(description);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) audioRouteButton.setTooltipText(description);
    }

    private void applySystemBarInsets(View root) {
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return windowInsets;
        });
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        rebuildContent();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_ESCAPE && event.getAction() == KeyEvent.ACTION_UP) {
            moveTaskToBack(true);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void registerCallReceiver() {
        callReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String eventSessionId = intent == null ? null : intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID);
                if (sessionId == null || !sessionId.equals(eventSessionId)) return;
                if (PulseNativeCallService.ACTION_AUDIO_ROUTES_CHANGED.equals(intent.getAction())) {
                    updateAudioRouteButton(intent.getStringExtra(PulseNativeCallService.EXTRA_AUDIO_ROUTE_LABEL));
                    if (audioRouteDialog != null) audioRouteDialog.refresh();
                } else if (PulseNativeCallService.ACTION_NATIVE_CALL_CONNECTED.equals(intent.getAction())) {
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
        filter.addAction(PulseNativeCallService.ACTION_AUDIO_ROUTES_CHANGED);
        ContextCompat.registerReceiver(this, callReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private ImageButton control(int icon, String description, int color) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(icon);
        button.setColorFilter(Color.WHITE);
        button.setContentDescription(description);
        button.setFocusable(true);
        button.setClickable(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) button.setTooltipText(description);
        button.setPadding(dp(18), dp(18), dp(18), dp(18));
        button.setBackground(focusableCircle(color));
        return button;
    }

    private StateListDrawable focusableCircle(int color) {
        StateListDrawable states = new StateListDrawable();
        states.addState(new int[] { android.R.attr.state_focused }, circle(blendWithWhite(color)));
        states.addState(new int[] { android.R.attr.state_pressed }, circle(blendWithWhite(color)));
        states.addState(new int[0], circle(color));
        return states;
    }

    private GradientDrawable circle(int color) {
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(color);
        return background;
    }

    private int blendWithWhite(int color) {
        return Color.rgb(
            (Color.red(color) + 255) / 2,
            (Color.green(color) + 255) / 2,
            (Color.blue(color) + 255) / 2
        );
    }

    private LinearLayout.LayoutParams controlParams(PulseCallWindowProfile profile) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            dp(profile.controlSizeDp),
            dp(profile.controlSizeDp)
        );
        params.setMargins(dp(profile.controlGapDp), 0, dp(profile.controlGapDp), 0);
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
        if (audioRouteDialog != null) audioRouteDialog.dismiss();
        if (callReceiver != null) unregisterReceiver(callReceiver);
        super.onDestroy();
    }
}
