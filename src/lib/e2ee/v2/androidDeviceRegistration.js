import {
  bootstrapNativeE2eeV2Device,
  bindNativeE2eeV2LocalDeviceRegistration,
  getNativeE2eeV2Status,
} from './nativeAndroidProvider';
import { v2ApiClient } from './v2ApiClient';

export async function registerAndroidE2eeV2Device({
  user,
  deviceId,
  signalDeviceId,
  deviceLabel = 'Pulse Android',
  preKeyCount = 20,
  api = v2ApiClient,
  getStatus = getNativeE2eeV2Status,
  bootstrapDevice = bootstrapNativeE2eeV2Device,
  bindLocalDeviceRegistration = bindNativeE2eeV2LocalDeviceRegistration,
} = {}) {
  if (!user?.uid) throw new Error('v2_auth_required');
  if (!deviceId) throw new Error('v2_device_id_required');

  const status = await getStatus();
  if (status?.providerAvailable !== true || status?.privateMaterialExportable !== false) {
    throw new Error('v2_native_provider_not_released');
  }

  const registration = await bootstrapDevice({
    userId: user.uid,
    signalDeviceId,
    preKeyCount,
  });
  const result = await api.registerDevice(user, {
    deviceId,
    signalDeviceId: registration.signalDeviceId,
    deviceLabel,
    platform: 'android',
    capabilities: registration.capabilities,
    registrationId: registration.registrationId,
    identityKey: registration.identityKey,
    signedPreKey: registration.signedPreKey,
    kyberPreKey: registration.kyberPreKey,
    oneTimePreKeys: registration.oneTimePreKeys,
  });

  await bindLocalDeviceRegistration({
    userId: user.uid,
    deviceId: result.deviceId,
    signalDeviceId: registration.signalDeviceId,
    identityVersion: result.identityVersion,
  });

  return {
    deviceId: result.deviceId,
    signalDeviceId: registration.signalDeviceId,
    identityVersion: result.identityVersion,
    status: result.status,
  };
}
