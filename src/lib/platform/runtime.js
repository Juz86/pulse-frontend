export const PULSE_WEB_CALLS_UNAVAILABLE_TITLE = 'Bellen is alleen beschikbaar in de app';
export const PULSE_WEB_CALLS_UNAVAILABLE_MESSAGE = 'Bellen en videobellen zijn alleen beschikbaar in de Pulse app.';
export const PULSE_WEB_CALLS_UNAVAILABLE_HINT = 'Open Pulse op je telefoon of tablet om veilig te bellen of videobellen.';

export function isNativePulseEnvironment() {
  if (typeof window === 'undefined') return false;

  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    if (window.Capacitor?.platform && window.Capacitor.platform !== 'web') return true;
    if (window.ReactNativeWebView) return true;
    if (window.webkit?.messageHandlers?.capacitor) return true;
  } catch {
    return false;
  }

  return false;
}

export function isPulseWebBrowser() {
  return !isNativePulseEnvironment();
}
