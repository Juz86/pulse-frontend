import { v2ApiClient } from './v2ApiClient';

function requireBrowserProvider(client) {
  if (!client || typeof client.status !== 'function' || typeof client.bootstrap !== 'function') {
    throw new Error('v2_browser_provider_invalid');
  }
  return client;
}

export async function registerBrowserE2eeV2Device({
  user,
  deviceId,
  signalDeviceId,
  deviceLabel = 'Pulse Browser E2EE QA',
  preKeyCount = 20,
  client,
  api = v2ApiClient,
} = {}) {
  if (!user?.uid) throw new Error('v2_auth_required');
  if (!deviceId) throw new Error('v2_device_id_required');
  const provider = requireBrowserProvider(client);
  const status = await provider.status();
  if (status?.wasmReady !== true || status?.privateMaterialExportable !== false) {
    throw new Error('v2_browser_provider_not_released');
  }

  const registration = await provider.bootstrap(preKeyCount);
  if (registration.signalDeviceId !== signalDeviceId
    || registration.privateMaterialExportable !== false) {
    throw new Error('v2_browser_registration_binding_mismatch');
  }
  const result = await api.registerDevice(user, {
    deviceId,
    signalDeviceId: registration.signalDeviceId,
    deviceLabel,
    platform: 'web',
    capabilities: registration.capabilities,
    registrationId: registration.registrationId,
    identityKey: registration.identityKey,
    signedPreKey: registration.signedPreKey,
    kyberPreKey: registration.kyberPreKey,
    oneTimePreKeys: registration.oneTimePreKeys,
  });
  return {
    deviceId: result.deviceId,
    signalDeviceId: registration.signalDeviceId,
    identityVersion: result.identityVersion,
    status: result.status,
  };
}
