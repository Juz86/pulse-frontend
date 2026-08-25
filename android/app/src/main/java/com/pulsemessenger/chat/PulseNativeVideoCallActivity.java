package com.pulsemessenger.chat;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import org.webrtc.RendererCommon;
import org.webrtc.SurfaceViewRenderer;

public class PulseNativeVideoCallActivity extends Activity {
    private static final int CONTROL_SIZE_DP = 58;
    private static final int ATTACH_RETRIES = 40;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private SurfaceViewRenderer remoteRenderer;
    private SurfaceViewRenderer localRenderer;
    private TextView statusView;
    private String sessionId;
    private boolean renderersReleased;
    private int attachAttempts;
    private BroadcastReceiver callReceiver;

    static void show(Context context, String sessionId, String callerName) {
        if (context == null || sessionId == null) return;
        Intent intent = new Intent(context, PulseNativeVideoCallActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId)
            .putExtra(PulseTelecomManager.EXTRA_CALLER_NAME, callerName);
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        readIntent(getIntent());
        setContentView(buildContent());
        registerCallReceiver();
        attachRenderersWhenReady();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
        attachAttempts = 0;
        attachRenderersWhenReady();
    }

    private void readIntent(Intent intent) {
        sessionId = intent == null ? null : intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID);
    }

    private View buildContent() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        remoteRenderer = new SurfaceViewRenderer(this);
        remoteRenderer.init(PulseNativeCallService.sharedEglContext(), null);
        remoteRenderer.setEnableHardwareScaler(true);
        remoteRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL);
        root.addView(remoteRenderer, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.VERTICAL);
        heading.setGravity(Gravity.CENTER);
        heading.setPadding(dp(20), dp(18), dp(20), dp(18));
        heading.setBackgroundColor(0x66000000);
        TextView caller = text(
            getIntent().getStringExtra(PulseTelecomManager.EXTRA_CALLER_NAME) == null
                ? "Pulse-videogesprek"
                : getIntent().getStringExtra(PulseTelecomManager.EXTRA_CALLER_NAME),
            21,
            Color.WHITE
        );
        caller.setGravity(Gravity.CENTER);
        statusView = text("Verbinden...", 15, 0xffdddddd);
        statusView.setGravity(Gravity.CENTER);
        heading.addView(caller);
        heading.addView(statusView);
        FrameLayout.LayoutParams headingParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.TOP
        );
        root.addView(heading, headingParams);

        localRenderer = new SurfaceViewRenderer(this);
        localRenderer.init(PulseNativeCallService.sharedEglContext(), null);
        localRenderer.setEnableHardwareScaler(true);
        localRenderer.setMirror(true);
        localRenderer.setZOrderMediaOverlay(true);
        localRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL);
        localRenderer.setBackgroundColor(0xff242424);
        FrameLayout.LayoutParams localParams = new FrameLayout.LayoutParams(dp(116), dp(164), Gravity.TOP | Gravity.END);
        localParams.setMargins(dp(16), dp(100), dp(16), 0);
        root.addView(localRenderer, localParams);

        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER);
        controls.setPadding(dp(10), dp(16), dp(10), dp(24));
        controls.setBackgroundColor(0x99000000);

        ImageButton microphone = control(R.drawable.pulse_mic_on, "Microfoon uitschakelen", 0xff3b3b3b);
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

        ImageButton camera = control(R.drawable.pulse_camera_on, "Camera uitschakelen", 0xff3b3b3b);
        camera.setOnClickListener(view -> {
            boolean enabled = PulseNativeCallService.toggleCamera(sessionId);
            camera.setImageResource(enabled ? R.drawable.pulse_camera_on : R.drawable.pulse_camera_off);
            camera.setContentDescription(enabled ? "Camera uitschakelen" : "Camera inschakelen");
        });
        controls.addView(camera, controlParams());

        ImageButton switchCamera = control(R.drawable.pulse_camera_switch, "Camera wisselen", 0xff3b3b3b);
        switchCamera.setOnClickListener(view -> PulseNativeCallService.switchCamera(sessionId));
        controls.addView(switchCamera, controlParams());

        FrameLayout.LayoutParams controlBarParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM
        );
        root.addView(controls, controlBarParams);
        return root;
    }

    private void attachRenderersWhenReady() {
        if (renderersReleased || sessionId == null) return;
        if (PulseNativeCallService.attachVideoRenderers(sessionId, remoteRenderer, localRenderer)) {
            if (PulseNativeCallService.isConnected(sessionId)) statusView.setText("Verbonden");
            return;
        }
        if (++attachAttempts < ATTACH_RETRIES) handler.postDelayed(this::attachRenderersWhenReady, 250L);
    }

    private void registerCallReceiver() {
        callReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String eventSessionId = intent == null ? null : intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID);
                if (sessionId == null || eventSessionId == null || !sessionId.equals(eventSessionId)) return;
                if (PulseNativeCallService.ACTION_NATIVE_CALL_CONNECTED.equals(intent.getAction())) {
                    statusView.setText("Verbonden");
                } else {
                    finish();
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(PulseNativeCallService.ACTION_NATIVE_CALL_CONNECTED);
        filter.addAction(PulseNativeCallService.ACTION_NATIVE_CALL_FINISHED);
        ContextCompat.registerReceiver(this, callReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private ImageButton control(int icon, String description, int color) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(icon);
        button.setColorFilter(Color.WHITE);
        button.setContentDescription(description);
        button.setTooltipText(description);
        button.setPadding(dp(16), dp(16), dp(16), dp(16));
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(color);
        button.setBackground(background);
        return button;
    }

    private LinearLayout.LayoutParams controlParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(CONTROL_SIZE_DP), dp(CONTROL_SIZE_DP));
        params.setMargins(dp(8), 0, dp(8), 0);
        return params;
    }

    private TextView text(String value, int sizeSp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setLetterSpacing(0f);
        return view;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (callReceiver != null) unregisterReceiver(callReceiver);
        if (!renderersReleased) {
            renderersReleased = true;
            PulseNativeCallService.detachVideoRenderers(sessionId, remoteRenderer, localRenderer);
            remoteRenderer.release();
            localRenderer.release();
        }
        super.onDestroy();
    }
}
