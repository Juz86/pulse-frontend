package com.pulsemessenger.chat;

final class PulseCallWindowProfile {
    enum SizeClass { COMPACT, MEDIUM, EXPANDED }

    final SizeClass sizeClass;
    final boolean landscape;
    final int availableWidthDp;
    final int availableHeightDp;
    final int contentWidthDp;
    final int controlSizeDp;
    final int controlGapDp;
    final int avatarSizeDp;
    final int previewWidthDp;
    final int previewHeightDp;

    private PulseCallWindowProfile(int widthDp, int heightDp) {
        availableWidthDp = Math.max(1, widthDp);
        availableHeightDp = Math.max(1, heightDp);
        landscape = availableWidthDp > availableHeightDp;
        if (availableWidthDp >= 840) {
            sizeClass = SizeClass.EXPANDED;
        } else if (availableWidthDp >= 600) {
            sizeClass = SizeClass.MEDIUM;
        } else {
            sizeClass = SizeClass.COMPACT;
        }

        contentWidthDp = Math.min(
            Math.max(availableWidthDp - 32, 1),
            sizeClass == SizeClass.EXPANDED ? 760 : sizeClass == SizeClass.MEDIUM ? 640 : 560
        );
        controlSizeDp = sizeClass == SizeClass.COMPACT ? 56 : 64;
        controlGapDp = sizeClass == SizeClass.COMPACT ? 8 : 12;
        avatarSizeDp = landscape && availableHeightDp < 600
            ? 132
            : sizeClass == SizeClass.COMPACT ? 176 : sizeClass == SizeClass.MEDIUM ? 208 : 224;
        previewWidthDp = sizeClass == SizeClass.COMPACT ? 160 : sizeClass == SizeClass.MEDIUM ? 224 : 280;
        previewHeightDp = Math.round(previewWidthDp * 9f / 16f);
    }

    static PulseCallWindowProfile from(int widthDp, int heightDp) {
        return new PulseCallWindowProfile(widthDp, heightDp);
    }

    boolean useTwoPaneAudioLayout() {
        return landscape && availableWidthDp >= 600 && availableHeightDp <= 720;
    }

    boolean useTwoPaneIncomingLayout() {
        return landscape && availableWidthDp >= 600;
    }

    boolean fitRemoteVideo() {
        return landscape || sizeClass != SizeClass.COMPACT;
    }
}
