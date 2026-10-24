import { isNativePulseEnvironment } from '../../platform/runtime';
import {
  bootstrapNativeE2eeV2Device,
  bindNativeE2eeV2LocalDeviceRegistration,
  clearNativeE2eeV2TextMessageHistory,
  clearNativeE2eeV2UserState,
  createNativeE2eeV2GroupSenderKeyDistribution,
  decryptNativeE2eeV2GroupText,
  decryptNativeE2eeV2Text,
  encryptNativeE2eeV2GroupText,
  encryptNativeE2eeV2Text,
  getNativeE2eeV2Status,
  invalidateNativeE2eeV2RemoteDevice,
  invalidateNativeE2eeV2GroupSenderKey,
  listNativeE2eeV2TextMessages,
  listNativeE2eeV2SessionDevices,
  processNativeE2eeV2GroupSenderKeyDistribution,
  signNativeE2eeV2CallIdentityBinding,
  storeNativeE2eeV2TextMessage,
  verifyNativeE2eeV2CallIdentityBinding,
} from './nativeAndroidProvider';

const mockGetPlatform = jest.fn(() => 'android');
const mockGetStatus = jest.fn();
const mockBootstrapDevice = jest.fn();
const mockBindLocalDeviceRegistration = jest.fn();
const mockEncryptText = jest.fn();
const mockDecryptText = jest.fn();
const mockCreateGroupSenderKeyDistribution = jest.fn();
const mockProcessGroupSenderKeyDistribution = jest.fn();
const mockEncryptGroupText = jest.fn();
const mockDecryptGroupText = jest.fn();
const mockInvalidateGroupSenderKey = jest.fn();
const mockSignCallIdentityBinding = jest.fn();
const mockVerifyCallIdentityBinding = jest.fn();
const mockListSessionDevices = jest.fn();
const mockInvalidateRemoteDevice = jest.fn();
const mockStoreTextMessage = jest.fn();
const mockListTextMessages = jest.fn();
const mockClearTextMessageHistory = jest.fn();
const mockClearUserState = jest.fn();

jest.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: (...args) => mockGetPlatform(...args) },
  registerPlugin: () => ({
    getStatus: (...args) => mockGetStatus(...args),
    bootstrapDevice: (...args) => mockBootstrapDevice(...args),
    bindLocalDeviceRegistration: (...args) => mockBindLocalDeviceRegistration(...args),
    encryptText: (...args) => mockEncryptText(...args),
    decryptText: (...args) => mockDecryptText(...args),
    createGroupSenderKeyDistribution: (...args) => mockCreateGroupSenderKeyDistribution(...args),
    processGroupSenderKeyDistribution: (...args) => mockProcessGroupSenderKeyDistribution(...args),
    encryptGroupText: (...args) => mockEncryptGroupText(...args),
    decryptGroupText: (...args) => mockDecryptGroupText(...args),
    invalidateGroupSenderKey: (...args) => mockInvalidateGroupSenderKey(...args),
    signCallIdentityBinding: (...args) => mockSignCallIdentityBinding(...args),
    verifyCallIdentityBinding: (...args) => mockVerifyCallIdentityBinding(...args),
    listSessionDevices: (...args) => mockListSessionDevices(...args),
    invalidateRemoteDevice: (...args) => mockInvalidateRemoteDevice(...args),
    storeTextMessage: (...args) => mockStoreTextMessage(...args),
    listTextMessages: (...args) => mockListTextMessages(...args),
    clearTextMessageHistory: (...args) => mockClearTextMessageHistory(...args),
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
    mockBindLocalDeviceRegistration.mockResolvedValue({ deviceId: 'device-a1' });
    mockEncryptText.mockResolvedValue({ envelopeType: 'prekey', ciphertext: 'ciphertext' });
    mockDecryptText.mockResolvedValue({ plaintext: 'Hallo' });
    mockCreateGroupSenderKeyDistribution.mockResolvedValue({ distribution: 'sender-key' });
    mockProcessGroupSenderKeyDistribution.mockResolvedValue({ processed: true });
    mockEncryptGroupText.mockResolvedValue({
      envelopeType: 'sender_key',
      distributionId: 'distribution-1',
      epoch: 1,
      ciphertext: 'group-ciphertext',
    });
    mockDecryptGroupText.mockResolvedValue({ plaintext: 'Hallo groep' });
    mockInvalidateGroupSenderKey.mockResolvedValue({ invalidated: true });
    mockSignCallIdentityBinding.mockResolvedValue({ signature: 'signature' });
    mockVerifyCallIdentityBinding.mockResolvedValue({ verified: true });
    mockListSessionDevices.mockResolvedValue({
      devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
    });
    mockInvalidateRemoteDevice.mockResolvedValue({ invalidated: true });
    mockStoreTextMessage.mockResolvedValue({ stored: true, messageCount: 1 });
    mockListTextMessages.mockResolvedValue({ messages: [{ messageId: 'message-1' }] });
    mockClearTextMessageHistory.mockResolvedValue({ cleared: true, removedMessages: 1 });
    mockClearUserState.mockResolvedValue({ ok: true });

    await expect(bootstrapNativeE2eeV2Device({ userId: 'alice' }))
      .resolves.toEqual({ identityKey: 'public-key' });
    await expect(bindNativeE2eeV2LocalDeviceRegistration({ deviceId: 'device-a1' }))
      .resolves.toEqual({ deviceId: 'device-a1' });
    await expect(encryptNativeE2eeV2Text({ plaintext: 'Hallo' }))
      .resolves.toMatchObject({ envelopeType: 'prekey' });
    await expect(decryptNativeE2eeV2Text({ ciphertext: 'ciphertext' }))
      .resolves.toEqual({ plaintext: 'Hallo' });
    await expect(createNativeE2eeV2GroupSenderKeyDistribution({ groupId: 'group-1' }))
      .resolves.toEqual({ distribution: 'sender-key' });
    await expect(processNativeE2eeV2GroupSenderKeyDistribution({ distribution: 'sender-key' }))
      .resolves.toEqual({ processed: true });
    await expect(encryptNativeE2eeV2GroupText({ plaintext: 'Hallo groep' }))
      .resolves.toMatchObject({ envelopeType: 'sender_key', epoch: 1 });
    await expect(decryptNativeE2eeV2GroupText({ ciphertext: 'group-ciphertext' }))
      .resolves.toEqual({ plaintext: 'Hallo groep' });
    await expect(invalidateNativeE2eeV2GroupSenderKey({ distributionId: 'distribution-1' }))
      .resolves.toEqual({ invalidated: true });
    await expect(signNativeE2eeV2CallIdentityBinding({ binding: { sessionId: 'call-1' } }))
      .resolves.toEqual({ signature: 'signature' });
    await expect(verifyNativeE2eeV2CallIdentityBinding({ signature: 'signature' }))
      .resolves.toEqual({ verified: true });
    await expect(listNativeE2eeV2SessionDevices({ remoteUserId: 'user-b' }))
      .resolves.toEqual({
        devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
      });
    await expect(invalidateNativeE2eeV2RemoteDevice({ remoteDeviceId: 'device-b1' }))
      .resolves.toEqual({ invalidated: true });
    await expect(storeNativeE2eeV2TextMessage({ messageId: 'message-1' }))
      .resolves.toEqual({ stored: true, messageCount: 1 });
    await expect(listNativeE2eeV2TextMessages({ conversationId: 'conversation-1' }))
      .resolves.toEqual([{ messageId: 'message-1' }]);
    await expect(clearNativeE2eeV2TextMessageHistory({ conversationId: 'conversation-1' }))
      .resolves.toEqual({ cleared: true, removedMessages: 1 });
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
