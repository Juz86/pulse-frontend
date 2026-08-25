package com.pulsemessenger.chat;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class PulseIncomingCallActivity extends Activity {
    private Intent callIntent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        callIntent = getIntent();
        showCallScreen();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        callIntent = intent;
        showCallScreen();
    }

    private void showCallScreen() {
        String callerName = callIntent.getStringExtra("callerName");
        if (callerName == null || callerName.trim().isEmpty()) callerName = "Iemand";
        boolean isVideo = callIntent.getBooleanExtra("isVideo", false);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(28), dp(40), dp(28), dp(40));
        root.setBackgroundColor(Color.rgb(9, 8, 18));

        TextView appName = text("Pulse", 18, Color.rgb(190, 178, 255));
        TextView name = text(callerName, 34, Color.WHITE);
        TextView status = text(isVideo ? "Inkomend videogesprek" : "Inkomende spraakoproep", 18, Color.rgb(220, 216, 238));
        root.addView(appName, layoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT, 0, 0, 0, 24));
        root.addView(name, layoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT, 0, 0, 0, 10));
        root.addView(status, layoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT, 0, 0, 0, 56));

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        Button decline = actionButton("Weigeren", Color.rgb(199, 42, 70));
        Button answer = actionButton("Beantwoorden", Color.rgb(34, 197, 94));
        actions.addView(decline, new LinearLayout.LayoutParams(0, dp(56), 1f));
        LinearLayout.LayoutParams answerParams = new LinearLayout.LayoutParams(0, dp(56), 1f);
        answerParams.setMargins(dp(16), 0, 0, 0);
        actions.addView(answer, answerParams);
        root.addView(actions, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        setContentView(root);

        decline.setOnClickListener(v -> performAction(PulseIncomingCallStore.ACTION_DECLINE));
        answer.setOnClickListener(v -> performAction(PulseIncomingCallStore.ACTION_ANSWER));
    }

    private void performAction(String action) {
        Intent intent = new Intent(this, PulseCallActionReceiver.class)
            .setAction(action)
            .putExtras(callIntent.getExtras() == null ? new Bundle() : callIntent.getExtras());
        sendBroadcast(intent);
        finish();
    }

    private TextView text(String value, int sizeSp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private Button actionButton(String label, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(16);
        GradientDrawable background = new GradientDrawable();
        background.setColor(color);
        background.setCornerRadius(dp(18));
        button.setBackground(background);
        return button;
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
