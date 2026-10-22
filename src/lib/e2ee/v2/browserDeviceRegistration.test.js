import { registerBrowserE2eeV2Device } from './browserDeviceRegistration';

const USER = { uid: 'user-a', getIdToken: jest.fn() };
const KEY = 'AQIDBA==';

function registration() {
  return {
    signalDeviceId: 3,
    registrationId: 42,
    identityKey: KEY,
    capabilities: { messageEncryption: true, hardwareBackedKeystore: false },
    signedPreKey: { keyId: 7, publicKey: KEY, signature: KEY },
    kyberPreKey: { keyId: 8, publicKey: KEY, signature: KEY },
    oneTimePreKeys: [{ keyId: 9, publicKey: KEY }],
    privateMaterialExportable: false,
  };
}

describe('browser E2EE v2 device registration', () => {
  test('registers only public browser bootstrap material', async () => {
    const client = {
      status: jest.fn().mockResolvedValue({
        wasmReady: true,
        privateMaterialExportable: false,
      }),
      bootstrap: jest.fn().mockResolvedValue(registration()),
    };
    const api = {
      registerDevice: jest.fn().mockResolvedValue({
        status: 'REGISTERED',
        deviceId: 'browser-device-a',
        identityVersion: 1,
      }),
    };
    await expect(registerBrowserE2eeV2Device({
      user: USER,
      deviceId: 'browser-device-a',
      signalDeviceId: 3,
      client,
      api,
    })).resolves.toEqual({
      status: 'REGISTERED',
      deviceId: 'browser-device-a',
      signalDeviceId: 3,
      identityVersion: 1,
    });
    expect(api.registerDevice).toHaveBeenCalledWith(USER, expect.objectContaining({
      platform: 'web',
      identityKey: KEY,
      capabilities: expect.objectContaining({ hardwareBackedKeystore: false }),
    }));
    expect(JSON.stringify(api.registerDevice.mock.calls[0][1])).not.toContain('privateMaterial');
  });

  test('fails before bootstrap while the browser WASM gate is closed', async () => {
    const client = {
      status: jest.fn().mockResolvedValue({ wasmReady: false }),
      bootstrap: jest.fn(),
    };
    const api = { registerDevice: jest.fn() };
    await expect(registerBrowserE2eeV2Device({
      user: USER,
      deviceId: 'browser-device-a',
      signalDeviceId: 3,
      client,
      api,
    })).rejects.toThrow('v2_browser_provider_not_released');
    expect(client.bootstrap).not.toHaveBeenCalled();
    expect(api.registerDevice).not.toHaveBeenCalled();
  });

  test('rejects a bootstrap bound to a different Signal device id', async () => {
    const client = {
      status: jest.fn().mockResolvedValue({
        wasmReady: true,
        privateMaterialExportable: false,
      }),
      bootstrap: jest.fn().mockResolvedValue(registration()),
    };
    const api = { registerDevice: jest.fn() };
    await expect(registerBrowserE2eeV2Device({
      user: USER,
      deviceId: 'browser-device-a',
      signalDeviceId: 4,
      client,
      api,
    })).rejects.toThrow('v2_browser_registration_binding_mismatch');
    expect(api.registerDevice).not.toHaveBeenCalled();
  });
});
