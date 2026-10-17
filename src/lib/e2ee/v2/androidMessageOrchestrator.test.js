import {
  receiveAndroidE2eeV2Text,
  sendAndroidE2eeV2Text,
} from './androidMessageOrchestrator';

const USER = { uid: 'user-a', getIdToken: jest.fn() };
const KEY = 'AQIDBA==';
const UUIDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];

function status(available = true) {
  return { providerAvailable: available, privateMaterialExportable: false };
}

function bundleClaim(recipientUserId, devices) {
  return {
    recipientUserId,
    devices: devices.map(({ deviceId, signalDeviceId }) => ({
      deviceId,
      signalDeviceId,
      registrationId: 40 + signalDeviceId,
      identityKey: KEY,
      identityVersion: 1,
      signedPreKey: { keyId: 10, publicKey: KEY, signature: KEY },
      kyberPreKey: { keyId: 11, publicKey: KEY, signature: KEY },
      oneTimePreKey: { keyId: 12, publicKey: KEY },
    })),
  };
}

function baseSend(overrides = {}) {
  return {
    user: USER,
    localDeviceId: 'device-a1',
    localSignalDeviceId: 1,
    conversationId: 'conversation-1',
    recipientUserId: 'user-b',
    plaintext: 'Wat doe je?',
    getStatus: jest.fn().mockResolvedValue(status()),
    ...overrides,
  };
}

describe('Android E2EE v2 message orchestrator', () => {
  test('stops before sessions or network while the provider gate is closed', async () => {
    const listSessionDevices = jest.fn();
    const api = { sendMessage: jest.fn() };

    await expect(sendAndroidE2eeV2Text(baseSend({
      api,
      getStatus: jest.fn().mockResolvedValue(status(false)),
      listSessionDevices,
    }))).rejects.toThrow('v2_native_provider_not_released');

    expect(listSessionDevices).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  test('claims once and creates per-device prekey envelopes for a new conversation', async () => {
    const api = {
      claimRecipientBundles: jest.fn().mockResolvedValue(bundleClaim('user-b', [
        { deviceId: 'device-b1', signalDeviceId: 2 },
      ])),
      claimOwnDeviceBundles: jest.fn().mockResolvedValue(bundleClaim('user-a', [
        { deviceId: 'device-a2', signalDeviceId: 3 },
      ])),
      sendMessage: jest.fn().mockResolvedValue({ ok: true, messageId: UUIDS[2] }),
    };
    const listSessionDevices = jest.fn().mockResolvedValue({ devices: [] });
    const encryptText = jest.fn()
      .mockResolvedValueOnce({ envelopeType: 'prekey', ciphertext: 'Ym9i' })
      .mockResolvedValueOnce({ envelopeType: 'prekey', ciphertext: 'b3du' });
    const nextUuid = jest.fn()
      .mockReturnValueOnce(UUIDS[0])
      .mockReturnValueOnce(UUIDS[1])
      .mockReturnValueOnce(UUIDS[2]);

    await expect(sendAndroidE2eeV2Text(baseSend({
      api,
      listSessionDevices,
      encryptText,
      nextUuid,
    }))).resolves.toMatchObject({ messageId: UUIDS[2] });

    expect(encryptText).toHaveBeenCalledTimes(2);
    expect(encryptText).toHaveBeenNthCalledWith(1, expect.objectContaining({
      remoteUserId: 'user-b',
      remoteDeviceId: 'device-b1',
      remoteSignalDeviceId: 2,
      remoteIdentityVersion: 1,
      remoteBundle: expect.objectContaining({ signalDeviceId: 2 }),
    }));
    expect(api.sendMessage).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({
        clientMessageId: UUIDS[2],
        recipientEnvelopes: expect.arrayContaining([
          expect.objectContaining({ recipientDeviceId: 'device-b1' }),
          expect.objectContaining({ recipientDeviceId: 'device-a2' }),
        ]),
      }),
      expect.arrayContaining([
        { userId: 'user-b', deviceId: 'device-b1' },
        { userId: 'user-a', deviceId: 'device-a2' },
      ]),
    );
  });

  test('reuses sessions and refreshes the device set only after a backend mismatch', async () => {
    const mismatch = Object.assign(new Error('v2_recipient_set_mismatch'), {
      code: 'v2_recipient_set_mismatch',
    });
    const api = {
      claimRecipientBundles: jest.fn().mockResolvedValue(bundleClaim('user-b', [
        { deviceId: 'device-b1', signalDeviceId: 2 },
        { deviceId: 'device-b2', signalDeviceId: 4 },
      ])),
      claimOwnDeviceBundles: jest.fn().mockResolvedValue(bundleClaim('user-a', [])),
      sendMessage: jest.fn()
        .mockRejectedValueOnce(mismatch)
        .mockResolvedValueOnce({ ok: true, messageId: UUIDS[0] }),
    };
    const listSessionDevices = jest.fn()
      .mockResolvedValueOnce({
        devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
      })
      .mockResolvedValueOnce({ devices: [] });
    const encryptText = jest.fn()
      .mockResolvedValueOnce({ envelopeType: 'message', ciphertext: 'ZXhpc3Rpbmc=' })
      .mockResolvedValueOnce({ envelopeType: 'prekey', ciphertext: 'bmV3' });
    const nextUuid = jest.fn()
      .mockReturnValueOnce(UUIDS[0])
      .mockReturnValueOnce(UUIDS[1])
      .mockReturnValueOnce(UUIDS[2]);

    await sendAndroidE2eeV2Text(baseSend({
      api,
      listSessionDevices,
      encryptText,
      nextUuid,
    }));

    expect(api.claimRecipientBundles).toHaveBeenCalledTimes(1);
    expect(encryptText).toHaveBeenCalledTimes(2);
    expect(encryptText).toHaveBeenNthCalledWith(1, expect.not.objectContaining({ remoteBundle: expect.anything() }));
    expect(encryptText).toHaveBeenNthCalledWith(2, expect.objectContaining({
      remoteDeviceId: 'device-b2',
      remoteBundle: expect.any(Object),
    }));
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
    expect(api.sendMessage.mock.calls[1][1].recipientEnvelopes).toEqual([
      expect.objectContaining({ recipientDeviceId: 'device-b1', ciphertext: 'ZXhpc3Rpbmc=' }),
      expect.objectContaining({ recipientDeviceId: 'device-b2', ciphertext: 'bmV3' }),
    ]);
  });

  test('fetches only the local envelope and supplies sender Signal addressing to native decrypt', async () => {
    const envelope = {
      protocol: 'pulse_e2ee_v2',
      protocolVersion: 2,
      messageId: 'message-1',
      conversationId: 'conversation-1',
      clientMessageId: UUIDS[0],
      senderUserId: 'user-b',
      senderDeviceId: 'device-b1',
      senderSignalDeviceId: 2,
      senderIdentityVersion: 1,
      recipientUserId: 'user-a',
      recipientDeviceId: 'device-a1',
      messageType: 'text',
      envelopeType: 'prekey',
      ciphertext: 'ZW5jcnlwdGVk',
      createdAt: '2026-10-17T12:00:00.000Z',
    };
    const api = { fetchEnvelope: jest.fn().mockResolvedValue(envelope) };
    const decryptText = jest.fn().mockResolvedValue({ plaintext: 'Hallo' });

    await expect(receiveAndroidE2eeV2Text({
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      conversationId: 'conversation-1',
      messageId: 'message-1',
      api,
      getStatus: jest.fn().mockResolvedValue(status()),
      decryptText,
    })).resolves.toMatchObject({ plaintext: 'Hallo', senderSignalDeviceId: 2 });

    expect(decryptText).toHaveBeenCalledWith({
      userId: 'user-a',
      localSignalDeviceId: 1,
      remoteUserId: 'user-b',
      remoteDeviceId: 'device-b1',
      remoteSignalDeviceId: 2,
      remoteIdentityVersion: 1,
      envelopeType: 'prekey',
      ciphertext: 'ZW5jcnlwdGVk',
    });
  });
});
