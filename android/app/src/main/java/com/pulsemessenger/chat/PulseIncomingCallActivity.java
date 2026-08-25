package com.pulsemessenger.chat;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

public class PulseIncomingCallActivity extends Activity {
    static final String EXTRA_REQUEST_ANSWER_PERMISSIONS = "requestAnswerPermissions";
    private static final int MEDIA_PERMISSION_REQUEST = 8401;
    private static final long RING_TIMEOUT_MS = 35_000L;

    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private final Runnable timeoutRunnable = this::finish;
    private Intent callIntent;
    private BroadcastReceiver finishedReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureCallWindow();
        registerFinishedReceiver();
        callIntent = getIntent();
        showCallScreen();
        scheduleTimeout();
        if (callIntent.getBooleanExtra(EXTRA_REQUEST_ANSWER_PERMISSIONS, false)) requestAnswerPermissions();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        callIntent = intent;
        showCallScreen();
        scheduleTimeout();
        if (callIntent.getBooleanExtra(EXTRA_REQUEST_ANSWER_PERMISSIONS, false)) requestAnswerPermissions();
    }

    @Override
    protected void onDestroy() {
        timeoutHandler.removeCallbacks(timeoutRunnable);
        if (finishedReceiver != null) unregisterReceiver(finishedReceiver);
        super.onDestroy();
    }

    private void configureCallWindow() {
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.BLACK);
    }

    private void registerFinishedReceiver() {
        finishedReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String activeSessionId = callIntent == null ? null : callIntent.getStringExtra("sessionId");
                String finishedSessionId = intent == null ? null : intent.getStringExtra("sessionId");
                if (activeSessionId == null || finishedSessionId == null || activeSessionId.equals(finishedSessionId)) {
                    finish();
                }
            }
        };
        IntentFilter filter = new IntentFilter(PulseIncomingCallNotifier.ACTION_CALL_FINISHED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(finishedReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            ContextCompat.registerReceiver(this, finishedReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        }
    }

    private void scheduleTimeout() {
        timeoutHandler.removeCallbacks(timeoutRunnable);
        timeoutHandler.postDelayed(timeoutRunnable, RING_TIMEOUT_MS);
    }

    private void showCallScreen() {
        String callerName = callIntent.getStringExtra("callerName");
        if (callerName == null || callerName.trim().isEmpty()) callerName = "Iemand";
        boolean isVideo = callIntent.getBooleanExtra("isVideo", false);

        FrameLayout scene = new FrameLayout(this);
        scene.setBackgroundColor(Color.rgb(8, 17, 24));
        ImageView background = new ImageView(this);
        background.setImageResource(R.drawable.pulse_call_background);
        background.setScaleType(ImageView.ScaleType.CENTER_CROP);
        background.setColorFilter(Color.rgb(18, 25, 35), PorterDuff.Mode.MULTIPLY);
        scene.addView(background, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(24), dp(42), dp(24), dp(34));
        root.setBackgroundColor(Color.TRANSPARENT);

        TextView appName = text("Pulse", 18, Color.rgb(194, 185, 239));
        TextView name = text(callerName, 36, Color.WHITE);
        name.setTypeface(name.getTypeface(), android.graphics.Typeface.BOLD);
        TextView status = text(isVideo ? "Inkomend videogesprek" : "Inkomende spraakoproep", 18, Color.rgb(190, 198, 205));

        root.addView(appName, layoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT, 0, 0, 0, 26));
        root.addView(name, layoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT, 0, 0, 0, 8));
        root.addView(status, layoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT, 0, 0, 0, 0));

        LinearLayout avatarSpace = new LinearLayout(this);
        avatarSpace.setGravity(Gravity.CENTER);
        TextView avatar = text(initials(callerName), 72, Color.WHITE);
        avatar.setTypeface(avatar.getTypeface(), android.graphics.Typeface.BOLD);
        avatar.setBackground(circle(Color.rgb(106, 78, 214)));
        avatarSpace.addView(avatar, new LinearLayout.LayoutParams(dp(220), dp(220)));
        root.addView(avatarSpace, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout decline = action("Weigeren", Color.rgb(240, 0, 58), R.drawable.pulse_call_decline, PulseIncomingCallStore.ACTION_DECLINE);
        LinearLayout answer = action("Beantwoorden", Color.rgb(28, 183, 97), R.drawable.pulse_call_answer, PulseIncomingCallStore.ACTION_ANSWER);
        actions.addView(decline, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        actions.addView(answer, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        root.addView(actions, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        scene.addView(root, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(scene);
    }

    private LinearLayout action(String label, int color, int iconResource, String action) {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);

        ImageButton button = new ImageButton(this);
        button.setImageResource(iconResource);
        button.setColorFilter(Color.WHITE);
        button.setPadding(dp(16), dp(16), dp(16), dp(16));
        button.setBackground(circle(color));
        button.setContentDescription(label);
        button.setOnClickListener(v -> performAction(action));
        container.addView(button, new LinearLayout.LayoutParams(dp(72), dp(72)));

        TextView text = text(label, 16, Color.WHITE);
        container.addView(text, layoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT, 0, 12, 0, 0));
        return container;
    }

    private void performAction(String action) {
        if (PulseIncomingCallStore.ACTION_ANSWER.equals(action)
            && !PulseTelecomManager.hasRequiredMediaPermissions(this, callIntent)) {
            requestAnswerPermissions();
            return;
        }
        Intent intent = new Intent(this, PulseCallActionReceiver.class)
            .setAction(action)
            .putExtras(callIntent.getExtras() == null ? new Bundle() : callIntent.getExtras());
        sendBroadcast(intent);
        finish();
    }

    private void requestAnswerPermissions() {
        boolean isVideo = callIntent != null && callIntent.getBooleanExtra("isVideo", false);
        String[] permissions = isVideo
            ? new String[] { Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA }
            : new String[] { Manifest.permission.RECORD_AUDIO };
        requestPermissions(permissions, MEDIA_PERMISSION_REQUEST);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != MEDIA_PERMISSION_REQUEST) return;
        if (PulseTelecomManager.hasRequiredMediaPermissions(this, callIntent)) {
            callIntent.removeExtra(EXTRA_REQUEST_ANSWER_PERMISSIONS);
            performAction(PulseIncomingCallStore.ACTION_ANSWER);
        }
    }

    private TextView text(String value, int sizeSp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        view.setLetterSpacing(0f);
        return view;
    }

    private GradientDrawable circle(int color) {
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(color);
        return background;
    }

    private String initials(String name) {
        if (name == null || name.trim().isEmpty()) return "P";
        String[] words = name.trim().split("\\s+");
        String first = words[0].substring(0, 1);
        String second = words.length > 1 ? words[words.length - 1].substring(0, 1) : "";
        return (first + second).toUpperCase();
    }

    private LinearLayout.LayoutParams layoutParams(int width, int height, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(width, height);
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
