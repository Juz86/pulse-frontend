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
