import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativePulseEnvironment } from '../lib/platform/runtime';

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
  return PulseCall.startAudioCall({
    requestId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    calleeUid: String(calleeUid).trim(),
    displayName: String(displayName).trim(),
  });
}

export function nativeCallErrorMessage(error) {
  const code = error?.code || error?.message;
  switch (code) {
    case 'microphone_permission_denied':
      return 'Microfoontoegang is nodig om te bellen.';
    case 'call_already_active':
      return 'Er is al een actief gesprek.';
    case 'app_not_foreground':
      return 'Open Pulse om een gesprek te starten.';
    case 'invalid_call_target':
      return 'Dit contact kan niet worden gebeld.';
    case 'android_version_unsupported':
      return 'Bellen wordt niet ondersteund op deze Android-versie.';
    default:
      return 'De oproep kon niet worden gestart.';
  }
}
