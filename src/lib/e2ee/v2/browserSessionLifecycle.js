import { handleAndroidE2eeV2SecurityEvent } from './androidSessionLifecycle';

function requireBrowserProvider(client) {
  if (!client
    || typeof client.status !== 'function'
    || typeof client.invalidateRemoteDevice !== 'function'
    || typeof client.revoke !== 'function') {
    throw new Error('v2_browser_provider_invalid');
  }
  return client;
}

export function handleBrowserE2eeV2SecurityEvent(options = {}) {
  const provider = requireBrowserProvider(options.client);
  return handleAndroidE2eeV2SecurityEvent({
    ...options,
    getStatus: async () => {
      const status = await provider.status();
      return {
        ...status,
        providerAvailable: status?.wasmReady === true && status?.bootstrapped === true,
        privateMaterialExportable: false,
      };
    },
    invalidateRemoteDevice: (payload) => provider.invalidateRemoteDevice(payload),
    clearUserState: () => provider.revoke(),
    providerUnavailableCode: 'v2_browser_provider_not_released',
  });
}
