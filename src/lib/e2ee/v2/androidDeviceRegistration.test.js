import { registerAndroidE2eeV2Device } from './androidDeviceRegistration';

const USER = { uid: 'user-a', getIdToken: jest.fn() };
const KEY = 'AQIDBA==';

describe('Android E2EE v2 device registration', () => {
  test('remains fail-closed while real-device validation is pending', async () => {
    const bootstrapDevice = jest.fn();
    const api = { registerDevice: jest.fn() };

    await expect(registerAndroidE2eeV2Device({
      user: USER,
      deviceId: 'device-a1',
      signalDeviceId: 1,
      api,
      getStatus: jest.fn().mockResolvedValue({
        providerAvailable: false,
        privateMaterialExportable: false,
      }),
      bootstrapDevice,
    })).rejects.toThrow('v2_native_provider_not_released');

    expect(bootstrapDevice).not.toHaveBeenCalled();
    expect(api.registerDevice).not.toHaveBeenCalled();
  });

  test('registers only public bootstrap material after the provider gate opens', async () => {
    const bindLocalDeviceRegistration = jest.fn().mockResolvedValue({
      deviceId: 'device-a1',
      signalDeviceId: 1,
      identityVersion: 1,
    });
    const bootstrapDevice = jest.fn().mockResolvedValue({
      signalDeviceId: 1,
      registrationId: 42,
      identityKey: KEY,
      capabilities: { messageEncryption: true, hardwareBackedKeystore: true },
      signedPreKey: { keyId: 7, publicKey: KEY, signature: KEY },
      kyberPreKey: { keyId: 8, publicKey: KEY, signature: KEY },
      oneTimePreKeys: [{ keyId: 9, publicKey: KEY }],
      privateMaterialExportable: false,
    });
    const api = {
      registerDevice: jest.fn().mockResolvedValue({
        status: 'REGISTERED',
        deviceId: 'device-a1',
        identityVersion: 1,
      }),
    };

    await expect(registerAndroidE2eeV2Device({
      user: USER,
      deviceId: 'device-a1',
      signalDeviceId: 1,
      deviceLabel: 'Tablet',
      api,
      getStatus: jest.fn().mockResolvedValue({
        providerAvailable: true,
        privateMaterialExportable: false,
      }),
      bootstrapDevice,
      bindLocalDeviceRegistration,
    })).resolves.toEqual({
      deviceId: 'device-a1',
      signalDeviceId: 1,
      identityVersion: 1,
      status: 'REGISTERED',
    });

    expect(api.registerDevice).toHaveBeenCalledWith(USER, expect.objectContaining({
      deviceId: 'device-a1',
      platform: 'android',
      identityKey: KEY,
    }));
    expect(JSON.stringify(api.registerDevice.mock.calls[0][1])).not.toContain('private');
    expect(bindLocalDeviceRegistration).toHaveBeenCalledWith({
      userId: USER.uid,
      deviceId: 'device-a1',
      signalDeviceId: 1,
      identityVersion: 1,
    });
  });
});
