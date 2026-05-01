import { registerPlugin } from '@capacitor/core';
import { isNativePulseEnvironment } from '../lib/platform/runtime';

const PulseAppUpdate = registerPlugin('PulseAppUpdate');

function isAndroidNative() {
  if (!isNativePulseEnvironment()) return false;
  try {
    return window.Capacitor?.getPlatform?.() === 'android' || window.Capacitor?.platform === 'android';
  } catch {
    return false;
  }
}

export async function fetchNativeUpdateStatus() {
  if (!isAndroidNative()) return null;
  try {
    const status = await PulseAppUpdate.getUpdateStatus();
    return status || null;
  } catch (error) {
    console.warn('[Pulse][Update] Native update status fout:', error?.message || error);
    return null;
  }
}

export async function fetchUpdatePolicy(backendUrl, clientVersionCode) {
  if (!backendUrl || !Number.isFinite(Number(clientVersionCode))) return null;
  try {
    const url = new URL(`${backendUrl}/api/app-update`);
    url.searchParams.set('clientVersionCode', String(clientVersionCode));
    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('[Pulse][Update] Update policy ophalen mislukt:', error?.message || error);
    return null;
  }
}

export async function startFlexibleUpdate() {
  return PulseAppUpdate.startFlexibleUpdate();
}

export async function startImmediateUpdate() {
  return PulseAppUpdate.startImmediateUpdate();
}

export async function completeFlexibleUpdate() {
  return PulseAppUpdate.completeFlexibleUpdate();
}

export async function addUpdateStatusListener(callback) {
  if (!isAndroidNative() || typeof callback !== 'function') return { remove: async () => {} };
  try {
    return await PulseAppUpdate.addListener('updateStatusChanged', callback);
  } catch {
    return { remove: async () => {} };
  }
}

