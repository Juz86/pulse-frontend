import { registerPlugin } from '@capacitor/core';
import { isNativePulseEnvironment } from '../lib/platform/runtime';

const PulseWebUpdate = registerPlugin('PulseWebUpdate');

function isAndroidNative() {
  if (!isNativePulseEnvironment()) return false;
  try {
    return window.Capacitor?.getPlatform?.() === 'android' || window.Capacitor?.platform === 'android';
  } catch {
    return false;
  }
}

export async function markNativeWebBundleHealthy() {
  if (!isAndroidNative()) return null;
  try {
    return await PulseWebUpdate.markBundleHealthy();
  } catch (error) {
    console.warn('[Pulse][Native web update] Gezonde bundle kon niet worden bevestigd:', error?.message || error);
    return null;
  }
}

export async function stageNativeWebUpdate() {
  if (!isAndroidNative()) return null;
  try {
    return await PulseWebUpdate.stageUpdate();
  } catch (error) {
    // Een OTA-update is altijd optioneel: de ingebouwde appbundle blijft werken.
    console.warn('[Pulse][Native web update] Controleren op web-update mislukt:', error?.message || error);
    return null;
  }
}
