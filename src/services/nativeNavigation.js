import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativePulseEnvironment } from '../lib/platform/runtime';

const PulseNavigation = registerPlugin('PulseNavigation');

function isAndroidNative() {
  if (!isNativePulseEnvironment()) return false;
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export async function setNativeChatBackEnabled(enabled) {
  if (!isAndroidNative()) return;
  try {
    await PulseNavigation.setBackNavigationEnabled({ enabled: Boolean(enabled) });
  } catch {
    // Browser navigation does not use the Android shell.
  }
}

export async function addNativeChatBackListener(callback) {
  if (!isAndroidNative() || typeof callback !== 'function') return { remove: async () => {} };
  try {
    return await PulseNavigation.addListener('backButton', callback);
  } catch {
    return { remove: async () => {} };
  }
}
