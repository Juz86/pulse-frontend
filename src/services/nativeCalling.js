import { isNativePulseEnvironment } from '../lib/platform/runtime';

export const NATIVE_CALL_ENGINES = Object.freeze({
  LEGACY: 'webrtc-v1',
  REALTIMEKIT: 'realtimekit-v2',
});

export function selectNativeCallEngine(realtimeKitCallsV2Enabled) {
  return realtimeKitCallsV2Enabled
    ? NATIVE_CALL_ENGINES.REALTIMEKIT
    : NATIVE_CALL_ENGINES.LEGACY;
}

function normalizeNativeCallEngine(callEngine) {
  return callEngine === NATIVE_CALL_ENGINES.REALTIMEKIT
    ? NATIVE_CALL_ENGINES.REALTIMEKIT
    : NATIVE_CALL_ENGINES.LEGACY;
}

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
  callEngine = NATIVE_CALL_ENGINES.LEGACY,
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
    callEngine: normalizeNativeCallEngine(callEngine),
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
    callEngine: normalizeNativeCallEngine(data.callEngine || data.offer?.engine),
  });
}
