import { Capacitor, registerPlugin } from '@capacitor/core';
import { auth } from '../firebase';
import { isNativePulseEnvironment } from '../lib/platform/runtime';
import { BACKEND_URL } from './socket';

const PulseCall = registerPlugin('PulseCall');

function isAndroidNative() {
  if (!isNativePulseEnvironment()) return false;
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export async function getNativeCallCapabilities() {
  if (!isAndroidNative()) return { audio: false, video: false };
  try {
    const capabilities = await PulseCall.getCapabilities();
    return {
      audio: capabilities?.audio === true,
      video: capabilities?.video === true,
      protocolVersion: Number(capabilities?.protocolVersion || 0),
      microphonePermission: capabilities?.microphonePermission || 'prompt',
    };
  } catch {
    return { audio: false, video: false };
  }
}

async function requestNativeAuthBootstrap(user, suppliedIdToken) {
  if (!user?.uid) {
    const error = new Error('native_auth_required');
    error.code = 'native_auth_required';
    throw error;
  }
  const idToken = suppliedIdToken || await user.getIdToken();
  const response = await fetch(`${BACKEND_URL}/api/calling/v2/native-auth/bootstrap`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const bootstrap = await response.json().catch(() => ({}));
  if (!response.ok || typeof bootstrap.code !== 'string') {
    const error = new Error(bootstrap.error || 'native_auth_unavailable');
    error.code = bootstrap.error || 'native_auth_unavailable';
    throw error;
  }
  return bootstrap.code;
}

export async function syncNativeCallIdentity({ user = auth.currentUser, idToken } = {}) {
  if (!isAndroidNative()) return { ok: false, skipped: true };
  const bootstrapCode = await requestNativeAuthBootstrap(user, idToken);
  return PulseCall.syncIdentity({
    callerUid: user.uid,
    bootstrapCode,
  });
}

export async function clearNativeCallIdentity() {
  if (!isAndroidNative()) return { ok: false, skipped: true };
  return PulseCall.clearIdentity();
}

export async function addNativeCallStatusListener(callback) {
  if (!isAndroidNative() || typeof callback !== 'function') return { remove: async () => {} };
  try {
    return await PulseCall.addListener('callStatusChanged', callback);
  } catch {
    return { remove: async () => {} };
  }
}

export async function startNativeAudioCall({ calleeUid, displayName }) {
  if (!isAndroidNative()) {
    const error = new Error('native_call_unavailable');
    error.code = 'native_call_unavailable';
    throw error;
  }
  if (!calleeUid || !String(calleeUid).trim() || !displayName || !String(displayName).trim()) {
    const error = new Error('invalid_call_target');
    error.code = 'invalid_call_target';
    throw error;
  }
  const currentUser = auth.currentUser;
  const bootstrapCode = await requestNativeAuthBootstrap(currentUser);

  return PulseCall.startAudioCall({
    requestId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    callerUid: currentUser.uid,
    calleeUid: String(calleeUid).trim(),
    displayName: String(displayName).trim(),
    bootstrapCode,
  });
}

export function nativeCallErrorMessage(error) {
  const code = error?.code || error?.message;
  switch (code) {
    case 'microphone_permission_denied':
      return 'Microfoontoegang is nodig om te bellen.';
    case 'call_already_active':
      return 'Er is al een actief gesprek.';
    case 'call_rate_limited':
      return 'Je hebt in korte tijd te vaak gebeld. Probeer het later opnieuw.';
    case 'app_not_foreground':
      return 'Open Pulse om een gesprek te starten.';
    case 'invalid_call_target':
      return 'Dit contact kan niet worden gebeld.';
    case 'android_version_unsupported':
      return 'Bellen wordt niet ondersteund op deze Android-versie.';
    case 'native_auth_required':
      return 'Meld je opnieuw aan om te kunnen bellen.';
    case 'native_auth_code_invalid':
    case 'native_auth_unavailable':
      return 'De beveiligde oproepverbinding is tijdelijk niet beschikbaar.';
    case 'call_signaling_unavailable':
    case 'signaling_error':
      return 'De oproepverbinding met Pulse is verbroken.';
    case 'media_error':
      return 'De audioverbinding kon niet worden opgebouwd.';
    case 'telecom_error':
      return 'Android kon de oproep niet registreren.';
    case 'call_rejected':
      return 'De oproep is door de belservice geweigerd.';
    default:
      return 'De oproep kon niet worden gestart.';
  }
}
