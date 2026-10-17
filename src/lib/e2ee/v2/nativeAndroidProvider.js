import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativePulseEnvironment } from '../../platform/runtime';

const PulseE2eeV2 = registerPlugin('PulseE2eeV2');

function requireAndroidProvider() {
  if (!isNativePulseEnvironment() || Capacitor.getPlatform() !== 'android') {
    const error = new Error('e2ee_native_provider_unavailable');
    error.code = 'e2ee_native_provider_unavailable';
    throw error;
  }
}

export async function getNativeE2eeV2Status() {
  if (!isNativePulseEnvironment() || Capacitor.getPlatform() !== 'android') {
    return {
      providerAvailable: false,
      provider: 'unavailable',
      privateMaterialExportable: false,
    };
  }
  return PulseE2eeV2.getStatus();
}

export async function bootstrapNativeE2eeV2Device(options) {
  requireAndroidProvider();
  return PulseE2eeV2.bootstrapDevice(options);
}

export async function encryptNativeE2eeV2Text(options) {
  requireAndroidProvider();
  return PulseE2eeV2.encryptText(options);
}

export async function decryptNativeE2eeV2Text(options) {
  requireAndroidProvider();
  return PulseE2eeV2.decryptText(options);
}

export async function listNativeE2eeV2SessionDevices(options) {
  requireAndroidProvider();
  return PulseE2eeV2.listSessionDevices(options);
}

export async function invalidateNativeE2eeV2RemoteDevice(options) {
  requireAndroidProvider();
  return PulseE2eeV2.invalidateRemoteDevice(options);
}

export async function clearNativeE2eeV2UserState(userId) {
  requireAndroidProvider();
  return PulseE2eeV2.clearUserState({ userId });
}
