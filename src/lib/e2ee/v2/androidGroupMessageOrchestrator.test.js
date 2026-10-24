import {
  distributeAndroidGroupSenderKey,
  receiveAndroidGroupSenderKey,
  receiveAndroidGroupText,
  sendAndroidGroupText,
} from './androidGroupMessageOrchestrator';

const USER = { uid: 'user-a', getIdToken: jest.fn() };
const DISTRIBUTION_ID = '11111111-1111-4111-8111-111111111111';
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222';
const available = () => Promise.resolve({
  providerAvailable: true,
  privateMaterialExportable: false,
});

describe('Android group E2EE orchestrator', () => {
  test('creates one sender key and pairwise encrypts it for every target device', async () => {
    const api = { sendGroupDistribution: jest.fn().mockResolvedValue({ ok: true }) };
    const createDistribution = jest.fn().mockResolvedValue({ distribution: 'c2VuZGVyLWtleQ==' });
    const encryptText = jest.fn()
      .mockResolvedValueOnce({ envelopeType: 'prekey', ciphertext: 'Ym9i' })
      .mockResolvedValueOnce({ envelopeType: 'message', ciphertext: 'b3du' });
    const recipientTargets = [
      { userId: 'user-b', deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 },
      { userId: 'user-a', deviceId: 'device-a2', signalDeviceId: 3, identityVersion: 1 },
    ];

    await distributeAndroidGroupSenderKey({
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      localIdentityVersion: 1,
      conversationId: 'group-1',
      epoch: 4,
      distributionId: DISTRIBUTION_ID,
      recipientTargets,
      api,
      getStatus: available,
      createDistribution,
      encryptText,
    });

    expect(createDistribution).toHaveBeenCalledTimes(1);
    expect(encryptText).toHaveBeenCalledTimes(2);
    expect(api.sendGroupDistribution).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({
        protocol: 'pulse_group_e2ee_v1',
        epoch: 4,
        recipientEnvelopes: [
          expect.objectContaining({ recipientDeviceId: 'device-b1', ciphertext: 'Ym9i' }),
          expect.objectContaining({ recipientDeviceId: 'device-a2', ciphertext: 'b3du' }),
        ],
      }),
      [
        { userId: 'user-b', deviceId: 'device-b1' },
        { userId: 'user-a', deviceId: 'device-a2' },
      ],
    );
  });

  test('acknowledges a distribution only after native processing succeeds', async () => {
    const api = {
      fetchGroupDistribution: jest.fn().mockResolvedValue({
        senderUserId: 'user-b', senderDeviceId: 'device-b1', senderSignalDeviceId: 2,
        senderIdentityVersion: 1, envelopeType: 'prekey', ciphertext: 'ZW5jcnlwdGVk',
      }),
      acknowledgeGroupDistribution: jest.fn().mockResolvedValue({ ok: true }),
    };
    const decryptText = jest.fn().mockResolvedValue({ plaintext: 'c2VuZGVyLWtleQ==' });
    const processDistribution = jest.fn().mockResolvedValue({ processed: true });

    await receiveAndroidGroupSenderKey({
      user: USER, localDeviceId: 'device-a1', localSignalDeviceId: 1,
      conversationId: 'group-1', epoch: 4, distributionId: DISTRIBUTION_ID,
      api, getStatus: available, decryptText, processDistribution,
    });

    expect(processDistribution.mock.invocationCallOrder[0])
      .toBeLessThan(api.acknowledgeGroupDistribution.mock.invocationCallOrder[0]);

    processDistribution.mockRejectedValueOnce(new Error('invalid sender key'));
    await expect(receiveAndroidGroupSenderKey({
      user: USER, localDeviceId: 'device-a1', localSignalDeviceId: 1,
      conversationId: 'group-1', epoch: 4, distributionId: DISTRIBUTION_ID,
      api, getStatus: available, decryptText, processDistribution,
    })).rejects.toThrow('invalid sender key');
    expect(api.acknowledgeGroupDistribution).toHaveBeenCalledTimes(1);
  });

  test('sends native Sender Keys ciphertext with the bound epoch and distribution', async () => {
    const api = { sendGroupMessage: jest.fn().mockResolvedValue({ messageId: MESSAGE_ID }) };
    const encryptGroupText = jest.fn().mockResolvedValue({
      epoch: 4, distributionId: DISTRIBUTION_ID, ciphertext: 'Y2lwaGVydGV4dA==',
    });

    await sendAndroidGroupText({
      user: USER, localDeviceId: 'device-a1', localSignalDeviceId: 1,
      localIdentityVersion: 1, conversationId: 'group-1', epoch: 4,
      distributionId: DISTRIBUTION_ID, plaintext: 'Hallo groep', clientMessageId: MESSAGE_ID,
      api, getStatus: available, encryptGroupText,
    });

    expect(api.sendGroupMessage).toHaveBeenCalledWith(USER, expect.objectContaining({
      clientMessageId: MESSAGE_ID,
      ciphertext: 'Y2lwaGVydGV4dA==',
      messageType: 'text',
    }));
  });

  test('acknowledges a group message only after native decrypt succeeds', async () => {
    const api = {
      fetchGroupMessage: jest.fn().mockResolvedValue({
        senderUserId: 'user-b', senderSignalDeviceId: 2, epoch: 4,
        distributionId: DISTRIBUTION_ID, ciphertext: 'Y2lwaGVydGV4dA==',
      }),
      acknowledgeGroupMessage: jest.fn().mockResolvedValue({ ok: true }),
    };
    const decryptGroupText = jest.fn().mockResolvedValue({ plaintext: 'Hallo terug' });

    await expect(receiveAndroidGroupText({
      user: USER, localDeviceId: 'device-a1', localSignalDeviceId: 1,
      conversationId: 'group-1', messageId: MESSAGE_ID,
      api, getStatus: available, decryptGroupText,
    })).resolves.toMatchObject({ plaintext: 'Hallo terug' });
    expect(decryptGroupText.mock.invocationCallOrder[0])
      .toBeLessThan(api.acknowledgeGroupMessage.mock.invocationCallOrder[0]);
  });
});
