import { isNativePulseEnvironment } from '../../platform/runtime';
import {
  bootstrapNativeE2eeV2Device,
  clearNativeE2eeV2UserState,
  decryptNativeE2eeV2Text,
  encryptNativeE2eeV2Text,
  getNativeE2eeV2Status,
  invalidateNativeE2eeV2RemoteDevice,
  listNativeE2eeV2SessionDevices,
} from './nativeAndroidProvider';

const mockGetPlatform = jest.fn(() => 'android');
const mockGetStatus = jest.fn();
const mockBootstrapDevice = jest.fn();
const mockEncryptText = jest.fn();
const mockDecryptText = jest.fn();
const mockListSessionDevices = jest.fn();
const mockInvalidateRemoteDevice = jest.fn();
const mockClearUserState = jest.fn();

jest.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: (...args) => mockGetPlatform(...args) },
  registerPlugin: () => ({
    getStatus: (...args) => mockGetStatus(...args),
    bootstrapDevice: (...args) => mockBootstrapDevice(...args),
    encryptText: (...args) => mockEncryptText(...args),
    decryptText: (...args) => mockDecryptText(...args),
    listSessionDevices: (...args) => mockListSessionDevices(...args),
    invalidateRemoteDevice: (...args) => mockInvalidateRemoteDevice(...args),
    clearUserState: (...args) => mockClearUserState(...args),
  }),
}));

jest.mock('../../platform/runtime', () => ({
  isNativePulseEnvironment: jest.fn(() => true),
}));

describe('native Android E2EE v2 provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isNativePulseEnvironment.mockReturnValue(true);
    mockGetPlatform.mockReturnValue('android');
  });

  test('exposes only the narrow native bridge operations', async () => {
    mockBootstrapDevice.mockResolvedValue({ identityKey: 'public-key' });
    mockEncryptText.mockResolvedValue({ envelopeType: 'prekey', ciphertext: 'ciphertext' });
    mockDecryptText.mockResolvedValue({ plaintext: 'Hallo' });
    mockListSessionDevices.mockResolvedValue({
      devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
    });
    mockInvalidateRemoteDevice.mockResolvedValue({ invalidated: true });
    mockClearUserState.mockResolvedValue({ ok: true });

    await expect(bootstrapNativeE2eeV2Device({ userId: 'alice' }))
      .resolves.toEqual({ identityKey: 'public-key' });
    await expect(encryptNativeE2eeV2Text({ plaintext: 'Hallo' }))
      .resolves.toMatchObject({ envelopeType: 'prekey' });
    await expect(decryptNativeE2eeV2Text({ ciphertext: 'ciphertext' }))
      .resolves.toEqual({ plaintext: 'Hallo' });
    await expect(listNativeE2eeV2SessionDevices({ remoteUserId: 'user-b' }))
      .resolves.toEqual({
        devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
      });
    await expect(invalidateNativeE2eeV2RemoteDevice({ remoteDeviceId: 'device-b1' }))
      .resolves.toEqual({ invalidated: true });
    await expect(clearNativeE2eeV2UserState('alice')).resolves.toEqual({ ok: true });
    expect(mockClearUserState).toHaveBeenCalledWith({ userId: 'alice' });
  });

  test('does not expose the provider in a browser', async () => {
    isNativePulseEnvironment.mockReturnValue(false);

    await expect(getNativeE2eeV2Status()).resolves.toEqual({
      providerAvailable: false,
      provider: 'unavailable',
      privateMaterialExportable: false,
    });
    await expect(encryptNativeE2eeV2Text({ plaintext: 'Hallo' }))
      .rejects.toMatchObject({ code: 'e2ee_native_provider_unavailable' });
    expect(mockEncryptText).not.toHaveBeenCalled();
  });
});
