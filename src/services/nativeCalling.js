import { isNativePulseEnvironment } from '../lib/platform/runtime';

export function isAndroidNativeCalling() {
  if (!isNativePulseEnvironment()) return false;
  try {
    return window?.Capacitor?.getPlatform?.() === 'android';
  } catch {
    return false;
  }
}

async function nativeCallPlugin() {
  const { registerPlugin } = await import('@capacitor/core');
  return registerPlugin('PulseIncomingCall');
}

export async function startNativeOutgoingCall({
  toUid,
  convId,
  contactName,
  callerName,
  isVideo,
  idToken,
}) {
  if (!isAndroidNativeCalling()) return null;
  if (!idToken) throw new Error('Je Pulse-sessie is verlopen. Meld je opnieuw aan om te bellen.');
  const plugin = await nativeCallPlugin();
  return plugin.startOutgoingCall({
    toUid,
    convId: convId || null,
    contactName: contactName || 'Contactpersoon',
    callerName: callerName || 'Pulse-gebruiker',
    isVideo: Boolean(isVideo),
    idToken,
  });
}

export async function presentNativeIncomingCall(data = {}) {
  if (!isAndroidNativeCalling()) return null;
  const fromUid = data.from || data.fromUid || null;
  const sessionId = data.sessionId || data.callSessionId || null;
  if (!fromUid || !sessionId) return null;
  const plugin = await nativeCallPlugin();
  return plugin.presentIncomingCall({
    sessionId,
    fromUid,
    callerName: data.callerName || 'Iemand',
    isVideo: Boolean(data.isVideo),
  });
}
