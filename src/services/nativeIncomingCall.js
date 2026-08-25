import { isNativePulseEnvironment } from '../lib/platform/runtime';

function isAndroidNative() {
  if (!isNativePulseEnvironment()) return false;
  try {
    return window?.Capacitor?.getPlatform?.() === 'android';
  } catch {
    return false;
  }
}

export async function consumeNativeIncomingCall() {
  if (!isAndroidNative()) return null;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const PulseIncomingCall = registerPlugin('PulseIncomingCall');
    const call = await PulseIncomingCall.consumePendingCall();
    return call?.sessionId && call?.fromUid ? call : null;
  } catch (error) {
    console.warn('[Pulse][Call] Native oproepactie ophalen mislukt:', error?.message || error);
    return null;
  }
}
