import { isNativePulseEnvironment } from '../lib/platform/runtime';

let nativeCallAuthState = {
  idToken: null,
  promise: null,
  result: null,
};
let nativeCallWebSession = {
  idToken: null,
  cachedAt: 0,
};

const NATIVE_CALL_AUTH_TIMEOUT_MS = 8000;
const NATIVE_CALL_ID_TOKEN_CACHE_MS = 45 * 60 * 1000;

export function cacheNativeCallIdToken(idToken) {
  if (!idToken) return;
  nativeCallWebSession = { idToken, cachedAt: Date.now() };
}

export function getCachedNativeCallIdToken() {
  if (!nativeCallWebSession.idToken) return null;
  if (Date.now() - nativeCallWebSession.cachedAt >= NATIVE_CALL_ID_TOKEN_CACHE_MS) {
    nativeCallWebSession = { idToken: null, cachedAt: 0 };
    return null;
  }
  return nativeCallWebSession.idToken;
}

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

export async function provisionNativeIncomingCallAuth(backendUrl, idToken) {
  if (!isAndroidNative() || !backendUrl || !idToken) return null;
  cacheNativeCallIdToken(idToken);

  if (nativeCallAuthState.idToken === idToken) {
    if (nativeCallAuthState.result?.ok) return nativeCallAuthState.result;
    if (nativeCallAuthState.promise) return nativeCallAuthState.promise;
  }

  const provisionPromise = provisionNativeCallAuth(backendUrl, idToken);
  nativeCallAuthState = { idToken, promise: provisionPromise, result: null };

  const result = await provisionPromise;
  if (nativeCallAuthState.promise === provisionPromise) {
    nativeCallAuthState = result?.ok
      ? { idToken, promise: null, result }
      : { idToken: null, promise: null, result: null };
  }
  return result;
}

async function provisionNativeCallAuth(backendUrl, idToken) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NATIVE_CALL_AUTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${backendUrl}/api/native-call-auth`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: response.status === 429 ? 'rate_limited' : `http_${response.status}`,
      };
    }
    const payload = await response.json();
    if (!payload?.customToken) return { ok: false, reason: 'token_missing' };

    const { registerPlugin } = await import('@capacitor/core');
    const PulseIncomingCall = registerPlugin('PulseIncomingCall');
    return await PulseIncomingCall.provisionCallAuth({ customToken: payload.customToken });
  } catch (error) {
    console.warn('[Pulse][Call] Native oproepauthenticatie mislukt:', error?.message || error);
    return {
      ok: false,
      reason: error?.name === 'AbortError' ? 'timeout' : 'network_error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requireNativeCallAuth(backendUrl, idToken) {
  const result = await provisionNativeIncomingCallAuth(backendUrl, idToken);
  if (!result?.ok) {
    if (result?.reason === 'rate_limited') {
      throw new Error('De oproepdienst heeft te veel verzoeken ontvangen. Probeer het over enkele seconden opnieuw.');
    }
    if (result?.reason === 'timeout') {
      throw new Error('De oproepdienst reageert niet. Controleer je internetverbinding en probeer opnieuw.');
    }
    if (result?.reason === 'http_401') {
      throw new Error('Je Pulse-sessie is verlopen. Meld je opnieuw aan om te bellen.');
    }
    throw new Error('Oproepbeveiliging kon niet worden voorbereid. Controleer je verbinding en probeer opnieuw.');
  }
  return result;
}

export async function clearNativeIncomingCallAuth() {
  nativeCallAuthState = { idToken: null, promise: null, result: null };
  nativeCallWebSession = { idToken: null, cachedAt: 0 };
  if (!isAndroidNative()) return;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    const PulseIncomingCall = registerPlugin('PulseIncomingCall');
    await PulseIncomingCall.clearCallAuth();
  } catch (error) {
    console.warn('[Pulse][Call] Native oproepauthenticatie wissen mislukt:', error?.message || error);
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
