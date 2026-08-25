import { isNativePulseEnvironment } from '../lib/platform/runtime';

function isAndroidNative() {
  if (!isNativePulseEnvironment()) return false;
  try {
    return window?.Capacitor?.getPlatform?.() === 'android';
  } catch {
    return false;
  }
}

export function classifyNativeIncomingCall(existingIncomingCall, sessionId, callInProgress) {
  if (existingIncomingCall?.sessionId === sessionId) return 'existing';
  if (existingIncomingCall || callInProgress) return 'busy';
  return 'rehydrate';
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

export async function addNativeIncomingCallActionListener(listener) {
  if (!isAndroidNative() || typeof listener !== 'function') return null;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const PulseIncomingCall = registerPlugin('PulseIncomingCall');
    return await PulseIncomingCall.addListener('pendingCallChanged', listener);
  } catch (error) {
    console.warn('[Pulse][Call] Native oproepactie-listener registreren mislukt:', error?.message || error);
    return null;
  }
}

export async function ensureNativeIncomingCallAccess() {
  if (!isAndroidNative()) return null;

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const PulseIncomingCall = registerPlugin('PulseIncomingCall');
    return await PulseIncomingCall.ensureCallNotificationAccess();
  } catch (error) {
    console.warn('[Pulse][Call] Native oproeptoegang controleren mislukt:', error?.message || error);
    return null;
  }
}
