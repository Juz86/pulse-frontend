package com.pulsemessenger.chat;

import android.Manifest;
import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Rational;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.annotation.RequiresApi;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.cloudflare.realtimekit.platform.VideoView;

import org.webrtc.RendererCommon;
import org.webrtc.SurfaceViewRenderer;

public class PulseNativeVideoCallActivity extends Activity {
    private static final int ATTACH_RETRIES = 40;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private SurfaceViewRenderer remoteRenderer;
    private SurfaceViewRenderer localRenderer;
    private FrameLayout remoteVideoContainer;
    private FrameLayout localVideoContainer;
    private VideoView realtimeKitRemoteView;
    private VideoView realtimeKitLocalView;
    private FrameLayout rootView;
    private TextView statusView;
    private LinearLayout headingView;
    private LinearLayout controlsView;
    private ImageButton cameraButton;
    private ImageButton switchCameraButton;
    private ImageButton audioRouteButton;
    private PulseAudioRouteDialog audioRouteDialog;
    private String sessionId;
    private boolean realtimeKitCall;
    private boolean renderersReleased;
    private int attachAttempts;
    private BroadcastReceiver callReceiver;
    private boolean enteringPictureInPicture;
    private static final int CAMERA_PERMISSION_REQUEST = 2104;
    private final PulseRealtimeKitSession.VideoListener realtimeKitVideoListener =
        (remoteView, localView) -> runOnUiThread(() -> bindRealtimeKitVideoViews(remoteView, localView));

    static void show(Context context, String sessionId, String callerName, String callEngine) {
        if (context == null || sessionId == null) return;
        Intent intent = new Intent(context, PulseNativeVideoCallActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(PulseTelecomManager.EXTRA_SESSION_ID, sessionId)
            .putExtra(PulseTelecomManager.EXTRA_CALLER_NAME, callerName)
            .putExtra(PulseTelecomManager.EXTRA_CALL_ENGINE, callEngine);
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
        applyResponsiveLayout();
        rootView.addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
            if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) {
                updatePictureInPictureParams();
            }
        });
        registerCallReceiver();
        attachVideoWhenReady();
        updatePictureInPictureParams();
        remoteVideoContainer.post(this::updatePictureInPictureParams);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
        attachAttempts = 0;
        attachVideoWhenReady();
    }

    private void readIntent(Intent intent) {
        sessionId = intent == null ? null : intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID);
        realtimeKitCall = intent != null && PulseRealtimeKitCredentialsClient.ENGINE.equals(
            intent.getStringExtra(PulseTelecomManager.EXTRA_CALL_ENGINE)
        );
        PulseNativeCallService.attachRealtimeKitHost(this, sessionId);
    }

    private View buildContent() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        rootView = root;
        applySystemBarInsets(root);

        remoteVideoContainer = new FrameLayout(this);
        root.addView(remoteVideoContainer, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        if (!realtimeKitCall) {
            remoteRenderer = new SurfaceViewRenderer(this);
            remoteRenderer.init(PulseNativeCallService.sharedEglContext(), null);
            remoteRenderer.setEnableHardwareScaler(true);
            remoteRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_BALANCED);
            remoteVideoContainer.addView(remoteRenderer, matchParentParams());
        }

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
        caller.setMaxLines(2);
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
        headingView = heading;

        localVideoContainer = new FrameLayout(this);
        localVideoContainer.setBackgroundColor(0xff242424);
        if (!realtimeKitCall) {
            localRenderer = new SurfaceViewRenderer(this);
            localRenderer.init(PulseNativeCallService.sharedEglContext(), null);
            localRenderer.setEnableHardwareScaler(true);
            localRenderer.setMirror(PulseNativeCallService.isCurrentCameraFront(sessionId));
            localRenderer.setZOrderMediaOverlay(true);
            localRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL);
            localVideoContainer.addView(localRenderer, matchParentParams());
        }
        FrameLayout.LayoutParams localParams = new FrameLayout.LayoutParams(dp(160), dp(90), Gravity.TOP | Gravity.END);
        localParams.setMargins(dp(16), dp(92), dp(16), 0);
        root.addView(localVideoContainer, localParams);

        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER);
        controls.setPadding(dp(10), dp(16), dp(10), dp(24));
        controls.setBackgroundColor(0x99000000);

        boolean microphoneEnabled = PulseNativeCallService.isMicrophoneEnabled(sessionId);
        ImageButton microphone = control(
            microphoneEnabled ? R.drawable.pulse_mic_on : R.drawable.pulse_mic_off,
            microphoneEnabled ? "Microfoon uitschakelen" : "Microfoon inschakelen",
            0xff3b3b3b
        );
        microphone.setOnClickListener(view -> {
            boolean enabled = PulseNativeCallService.toggleMicrophone(sessionId);
            microphone.setImageResource(enabled ? R.drawable.pulse_mic_on : R.drawable.pulse_mic_off);
            microphone.setContentDescription(enabled ? "Microfoon uitschakelen" : "Microfoon inschakelen");
        });
        controls.addView(microphone, controlParams());

        String routeLabel = PulseNativeCallService.getSelectedAudioRouteLabel(sessionId);
        audioRouteButton = control(
            R.drawable.pulse_audio_route,
            "Audio-uitvoer: " + routeLabel,
            0xff3b3b3b
        );
        audioRouteButton.setOnClickListener(view -> audioRouteDialog = PulseAudioRouteDialog.show(
            this,
            sessionId,
            this::updateAudioRouteButton
        ));
        controls.addView(audioRouteButton, controlParams());

        ImageButton end = control(R.drawable.pulse_call_decline, "Ophangen", 0xffef233c);
        end.setOnClickListener(view -> {
            PulseCallCoordinator.end(this, sessionId, true);
            finish();
        });
        controls.addView(end, controlParams());

        boolean cameraEnabled = PulseNativeCallService.isCameraEnabledByUser(sessionId);
        cameraButton = control(
            cameraEnabled ? R.drawable.pulse_camera_on : R.drawable.pulse_camera_off,
            cameraEnabled ? "Camera uitschakelen" : "Camera inschakelen",
            0xff3b3b3b
        );
        cameraButton.setOnClickListener(view -> {
            if (!PulseNativeCallService.isCameraEnabledByUser(sessionId)
                && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] { Manifest.permission.CAMERA }, CAMERA_PERMISSION_REQUEST);
                return;
            }
            updateCameraButton(PulseNativeCallService.toggleCamera(sessionId));
        });
        controls.addView(cameraButton, controlParams());

        switchCameraButton = control(R.drawable.pulse_camera_switch, "Camera wisselen", 0xff3b3b3b);
        switchCameraButton.setOnClickListener(view -> PulseNativeCallService.switchCamera(sessionId));
        controls.addView(switchCameraButton, controlParams());

        FrameLayout.LayoutParams controlBarParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM
        );
        root.addView(controls, controlBarParams);
        controlsView = controls;
        return root;
    }

    private void applyResponsiveLayout() {
        if (rootView == null) return;
        Configuration configuration = getResources().getConfiguration();
        PulseCallWindowProfile profile = PulseCallWindowProfile.from(
            configuration.screenWidthDp,
            configuration.screenHeightDp
        );
        if (remoteRenderer != null) {
            remoteRenderer.setScalingType(
                profile.fitRemoteVideo()
                    ? RendererCommon.ScalingType.SCALE_ASPECT_FIT
                    : RendererCommon.ScalingType.SCALE_ASPECT_FILL
            );
        }

        headingView.setPadding(dp(20), dp(profile.landscape ? 10 : 16), dp(20), dp(profile.landscape ? 10 : 16));
        FrameLayout.LayoutParams previewParams = (FrameLayout.LayoutParams) localVideoContainer.getLayoutParams();
        previewParams.width = dp(profile.previewWidthDp);
        previewParams.height = dp(profile.previewHeightDp);
        previewParams.gravity = Gravity.TOP | Gravity.END;
        previewParams.setMargins(dp(16), dp(profile.landscape ? 72 : 92), dp(16), 0);
        localVideoContainer.setLayoutParams(previewParams);

        controlsView.setPadding(dp(12), dp(10), dp(12), dp(12));
        FrameLayout.LayoutParams controlsParams = (FrameLayout.LayoutParams) controlsView.getLayoutParams();
        controlsParams.width = FrameLayout.LayoutParams.WRAP_CONTENT;
        controlsParams.height = FrameLayout.LayoutParams.WRAP_CONTENT;
        controlsParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        controlsView.setLayoutParams(controlsParams);
        int videoControlSize = profile.sizeClass == PulseCallWindowProfile.SizeClass.COMPACT ? 50
            : profile.sizeClass == PulseCallWindowProfile.SizeClass.MEDIUM ? 58 : 64;
        int videoControlGap = profile.sizeClass == PulseCallWindowProfile.SizeClass.COMPACT ? 3 : 6;
        for (int index = 0; index < controlsView.getChildCount(); index++) {
            View control = controlsView.getChildAt(index);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(videoControlSize), dp(videoControlSize));
            params.setMargins(dp(videoControlGap), 0, dp(videoControlGap), 0);
            control.setLayoutParams(params);
        }
        switchCameraButton.setVisibility(PulseNativeCallService.canSwitchCamera(sessionId) ? View.VISIBLE : View.GONE);
        if (localRenderer != null) {
            localRenderer.setMirror(PulseNativeCallService.isCurrentCameraFront(sessionId));
        }
        rootView.requestLayout();
        updatePictureInPictureParams();
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

    private void updateCameraButton(boolean enabled) {
        if (cameraButton == null) return;
        cameraButton.setImageResource(enabled ? R.drawable.pulse_camera_on : R.drawable.pulse_camera_off);
        cameraButton.setContentDescription(enabled ? "Camera uitschakelen" : "Camera inschakelen");
    }

    private void updateAudioRouteButton(String label) {
        if (audioRouteButton == null) return;
        String description = "Audio-uitvoer: " + (label == null ? "Automatisch" : label);
        audioRouteButton.setContentDescription(description);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) audioRouteButton.setTooltipText(description);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST
            && grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            updateCameraButton(PulseNativeCallService.toggleCamera(sessionId));
        }
    }

    private void attachVideoWhenReady() {
        if (renderersReleased || sessionId == null) return;
        boolean attached = realtimeKitCall
            ? PulseNativeCallService.attachRealtimeKitVideoHost(this, sessionId, realtimeKitVideoListener)
            : PulseNativeCallService.attachVideoRenderers(sessionId, remoteRenderer, localRenderer);
        if (attached) {
            if (PulseNativeCallService.isConnected(sessionId)) statusView.setText("Verbonden");
            applyResponsiveLayout();
            return;
        }
        if (++attachAttempts < ATTACH_RETRIES) handler.postDelayed(this::attachVideoWhenReady, 250L);
    }

    private void bindRealtimeKitVideoViews(VideoView remoteView, VideoView localView) {
        if (!realtimeKitCall || renderersReleased) return;
        realtimeKitRemoteView = replaceRealtimeKitView(
            remoteVideoContainer,
            realtimeKitRemoteView,
            remoteView,
            false
        );
        realtimeKitLocalView = replaceRealtimeKitView(
            localVideoContainer,
            realtimeKitLocalView,
            localView,
            true
        );
        updateRealtimeKitRendering();
        updatePictureInPictureParams();
    }

    private VideoView replaceRealtimeKitView(
        FrameLayout container,
        VideoView current,
        VideoView replacement,
        boolean overlay
    ) {
        if (current == replacement) return current;
        if (current != null) {
            current.stopVideoRender();
            if (current.getParent() instanceof ViewGroup) {
                ((ViewGroup) current.getParent()).removeView(current);
            }
        }
        container.removeAllViews();
        if (replacement != null) {
            if (replacement.getParent() instanceof ViewGroup) {
                ((ViewGroup) replacement.getParent()).removeView(replacement);
            }
            replacement.setZOrderMediaOverlay(overlay);
            container.addView(replacement, matchParentParams());
        }
        return replacement;
    }

    private void updateRealtimeKitRendering() {
        if (!realtimeKitCall) return;
        boolean pictureInPicture = isInPictureInPicture();
        boolean activityVisible = !isFinishing() && !isDestroyed()
            && getWindow().getDecorView().getWindowVisibility() == View.VISIBLE;
        if (realtimeKitRemoteView != null) {
            if (activityVisible || pictureInPicture) realtimeKitRemoteView.renderVideo();
            else realtimeKitRemoteView.stopVideoRender();
        }
        if (realtimeKitLocalView != null) {
            if (activityVisible && !pictureInPicture) realtimeKitLocalView.renderVideo();
            else realtimeKitLocalView.stopVideoRender();
        }
    }

    private FrameLayout.LayoutParams matchParentParams() {
        return new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
    }

    private void registerCallReceiver() {
        callReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String eventSessionId = intent == null ? null : intent.getStringExtra(PulseTelecomManager.EXTRA_SESSION_ID);
                if (sessionId == null || eventSessionId == null || !sessionId.equals(eventSessionId)) return;
                if (PulseNativeCallService.ACTION_AUDIO_ROUTES_CHANGED.equals(intent.getAction())) {
                    updateAudioRouteButton(intent.getStringExtra(PulseNativeCallService.EXTRA_AUDIO_ROUTE_LABEL));
                    if (audioRouteDialog != null) audioRouteDialog.refresh();
                } else if (PulseNativeCallService.ACTION_NATIVE_CALL_CONNECTED.equals(intent.getAction())) {
                    statusView.setText("Verbonden");
                    applyResponsiveLayout();
                } else if (PulseNativeCallService.ACTION_NATIVE_CALL_RECONNECTING.equals(intent.getAction())) {
                    statusView.setText("Opnieuw verbinden...");
                } else {
                    showTerminalError(intent);
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

    private void showTerminalError(Intent intent) {
        String error = intent == null ? null : intent.getStringExtra("error");
        if (error != null && !error.trim().isEmpty()) {
            Toast.makeText(this, error, Toast.LENGTH_LONG).show();
        }
    }

    private void updatePictureInPictureParams() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !supportsPictureInPicture()) return;
        updatePictureInPictureParamsApi26();
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private void updatePictureInPictureParamsApi26() {
        try {
            setPictureInPictureParams(buildPictureInPictureParams());
        } catch (RuntimeException error) {
            android.util.Log.w("PulseNativeVideo", "PiP-parameters instellen mislukt", error);
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private PictureInPictureParams buildPictureInPictureParams() {
        int width = remoteVideoContainer == null ? 0 : remoteVideoContainer.getWidth();
        int height = remoteVideoContainer == null ? 0 : remoteVideoContainer.getHeight();
        if (width <= 0 || height <= 0) {
            Configuration configuration = getResources().getConfiguration();
            width = Math.max(1, configuration.screenWidthDp);
            height = Math.max(1, configuration.screenHeightDp);
        }
        float ratio = (float) width / (float) height;
        Rational aspectRatio = ratio > 2.39f
            ? new Rational(239, 100)
            : ratio < (1f / 2.39f) ? new Rational(100, 239) : new Rational(width, height);
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
            .setAspectRatio(aspectRatio);
        Rect sourceRect = new Rect();
        if (remoteVideoContainer != null
            && remoteVideoContainer.getGlobalVisibleRect(sourceRect)
            && !sourceRect.isEmpty()) {
            builder.setSourceRectHint(sourceRect);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(true);
            builder.setSeamlessResizeEnabled(true);
        }
        return builder.build();
    }

    private boolean supportsPictureInPicture() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    private boolean enterPictureInPictureIfPossible() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || !supportsPictureInPicture()
            || !PulseNativeCallService.isActive(sessionId)) return false;
        return enterPictureInPictureApi26();
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private boolean enterPictureInPictureApi26() {
        try {
            enteringPictureInPicture = enterPictureInPictureMode(buildPictureInPictureParams());
            if (enteringPictureInPicture) {
                PulseNativeCallService.updateVideoPresentation(sessionId, false, true);
            }
            return enteringPictureInPicture;
        } catch (RuntimeException error) {
            android.util.Log.w("PulseNativeVideo", "PiP starten mislukt", error);
            return false;
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (!supportsPictureInPicture() || !PulseNativeCallService.isActive(sessionId)) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return;
        enterPictureInPictureIfPossible();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        enteringPictureInPicture = isInPictureInPictureMode;
        if (headingView != null) headingView.setVisibility(isInPictureInPictureMode ? View.GONE : View.VISIBLE);
        if (controlsView != null) controlsView.setVisibility(isInPictureInPictureMode ? View.GONE : View.VISIBLE);
        if (localVideoContainer != null) {
            localVideoContainer.setVisibility(isInPictureInPictureMode ? View.GONE : View.VISIBLE);
        }
        if (isInPictureInPictureMode) {
            PulseNativeCallService.updateVideoPresentation(sessionId, false, true);
        }
        updateRealtimeKitRendering();
        applyResponsiveLayout();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyResponsiveLayout();
    }

    @Override
    public void onMultiWindowModeChanged(boolean isInMultiWindowMode, Configuration newConfig) {
        super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig);
        handleMultiWindowModeChanged();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onMultiWindowModeChanged(boolean isInMultiWindowMode) {
        super.onMultiWindowModeChanged(isInMultiWindowMode);
        handleMultiWindowModeChanged();
    }

    private void handleMultiWindowModeChanged() {
        applyResponsiveLayout();
        if (!isInPictureInPicture() && !isFinishing()) {
            PulseNativeCallService.updateVideoPresentation(sessionId, true, false);
        }
    }

    private boolean isInPictureInPicture() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N || !isInPictureInPictureMode()) {
            enteringPictureInPicture = false;
            PulseNativeCallService.updateVideoPresentation(sessionId, true, false);
        }
        updateRealtimeKitRendering();
    }

    @Override
    protected void onStop() {
        boolean inPictureInPicture = isInPictureInPicture();
        boolean visibleInMultiWindow = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
            && isInMultiWindowMode()
            && getWindow().getDecorView().getWindowVisibility() == View.VISIBLE;
        if (!inPictureInPicture && !enteringPictureInPicture && !visibleInMultiWindow && !isChangingConfigurations()) {
            PulseNativeCallService.updateVideoPresentation(sessionId, false, false);
        }
        if (!inPictureInPicture && !visibleInMultiWindow) {
            if (realtimeKitRemoteView != null) realtimeKitRemoteView.stopVideoRender();
            if (realtimeKitLocalView != null) realtimeKitLocalView.stopVideoRender();
        }
        super.onStop();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_ESCAPE && event.getAction() == KeyEvent.ACTION_UP) {
            if (!enterPictureInPictureIfPossible()) moveTaskToBack(true);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private ImageButton control(int icon, String description, int color) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(icon);
        button.setColorFilter(Color.WHITE);
        button.setContentDescription(description);
        button.setFocusable(true);
        button.setClickable(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) button.setTooltipText(description);
        button.setPadding(dp(16), dp(16), dp(16), dp(16));
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

    private LinearLayout.LayoutParams controlParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(56), dp(56));
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
        if (audioRouteDialog != null) audioRouteDialog.dismiss();
        handler.removeCallbacksAndMessages(null);
        if (callReceiver != null) unregisterReceiver(callReceiver);
        if (!renderersReleased) {
            renderersReleased = true;
            if (realtimeKitCall) {
                PulseNativeCallService.detachRealtimeKitVideoHost(sessionId, realtimeKitVideoListener);
                if (realtimeKitRemoteView != null) realtimeKitRemoteView.stopVideoRender();
                if (realtimeKitLocalView != null) realtimeKitLocalView.stopVideoRender();
                if (remoteVideoContainer != null) remoteVideoContainer.removeAllViews();
                if (localVideoContainer != null) localVideoContainer.removeAllViews();
                realtimeKitRemoteView = null;
                realtimeKitLocalView = null;
            } else {
                PulseNativeCallService.detachVideoRenderers(sessionId, remoteRenderer, localRenderer);
                remoteRenderer.release();
                localRenderer.release();
            }
        }
        boolean inPictureInPicture = isInPictureInPicture();
        if (!inPictureInPicture && !isChangingConfigurations()) {
            PulseNativeCallService.updateVideoPresentation(sessionId, false, false);
        }
        super.onDestroy();
    }
}
