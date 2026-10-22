import { createBrowserE2eeV2MessageOrchestrator } from './browserMessageOrchestrator';

const USER = { uid: 'user-a', getIdToken: jest.fn() };
const CLIENT_MESSAGE_ID = '11111111-1111-4111-8111-111111111111';
const KEY = 'AQIDBA==';

function claimedDevice() {
  return {
    deviceId: 'device-b1',
    signalDeviceId: 2,
    registrationId: 42,
    identityKey: KEY,
    identityVersion: 1,
    signedPreKey: { keyId: 10, publicKey: KEY, signature: KEY },
    kyberPreKey: { keyId: 11, publicKey: KEY, signature: KEY },
    oneTimePreKey: { keyId: 12, publicKey: KEY },
  };
}

function setup() {
  const client = {
    status: jest.fn().mockResolvedValue({
      wasmReady: true,
      bootstrapped: true,
      privateMaterialExportable: false,
    }),
    listSessionDevices: jest.fn().mockResolvedValue({ devices: [] }),
    encrypt: jest.fn().mockResolvedValue({ envelopeType: 'prekey', ciphertext: 'ZW5j' }),
    decrypt: jest.fn().mockResolvedValue({ plaintext: 'veilig bericht' }),
    saveOutbox: jest.fn().mockResolvedValue({ stored: true }),
    listOutbox: jest.fn().mockResolvedValue({ messages: [] }),
    removeOutbox: jest.fn().mockResolvedValue({ removed: true }),
    storeReceivedMessage: jest.fn().mockResolvedValue({ stored: true }),
    listReceivedMessages: jest.fn().mockResolvedValue({ messages: [] }),
    clearReceivedMessages: jest.fn().mockResolvedValue({ cleared: 0 }),
  };
  const api = {
    claimRecipientBundles: jest.fn().mockResolvedValue({
      recipientUserId: 'user-b',
      devices: [claimedDevice()],
    }),
    claimOwnDeviceBundles: jest.fn().mockResolvedValue({
      recipientUserId: 'user-a',
      devices: [],
    }),
    sendMessage: jest.fn().mockResolvedValue({
      messageId: 'message-1',
      clientMessageId: CLIENT_MESSAGE_ID,
    }),
    fetchEnvelope: jest.fn().mockResolvedValue({
      messageId: 'message-1',
      conversationId: 'conversation-1',
      senderUserId: 'user-b',
      senderDeviceId: 'device-b1',
      senderSignalDeviceId: 2,
      senderIdentityVersion: 1,
      envelopeType: 'prekey',
      ciphertext: 'ZW5j',
    }),
    acknowledgeMessage: jest.fn().mockResolvedValue({ ok: true }),
  };
  return {
    api,
    client,
    orchestrator: createBrowserE2eeV2MessageOrchestrator({
      client,
      api,
      nextUuid: () => '22222222-2222-4222-8222-222222222222',
    }),
  };
}

describe('browser E2EE v2 message orchestrator', () => {
  test('commits browser encryption under a stable per-target operation before send', async () => {
    const { api, client, orchestrator } = setup();
    await expect(orchestrator.sendText({
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      conversationId: 'conversation-1',
      recipientUserId: 'user-b',
      plaintext: 'veilig bericht',
      clientMessageId: CLIENT_MESSAGE_ID,
    })).resolves.toMatchObject({ messageId: 'message-1' });

    expect(client.encrypt).toHaveBeenCalledWith(expect.objectContaining({
      operationId: `send:${CLIENT_MESSAGE_ID}:user-b:device-b1`,
      remoteBundle: expect.objectContaining({ signalDeviceId: 2 }),
    }));
    expect(client.encrypt.mock.invocationCallOrder[0])
      .toBeLessThan(client.saveOutbox.mock.invocationCallOrder[0]);
    expect(client.saveOutbox.mock.invocationCallOrder[0])
      .toBeLessThan(api.sendMessage.mock.invocationCallOrder[0]);
    expect(api.sendMessage.mock.invocationCallOrder[0])
      .toBeLessThan(client.removeOutbox.mock.invocationCallOrder[0]);
    expect(client.saveOutbox).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.not.objectContaining({ plaintext: expect.anything() }),
    }));
  });

  test('returns decrypted plaintext only after the worker transaction resolves', async () => {
    const { client, orchestrator } = setup();
    await expect(orchestrator.receiveText({
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      conversationId: 'conversation-1',
      messageId: 'message-1',
    })).resolves.toMatchObject({ plaintext: 'veilig bericht' });

    expect(client.decrypt).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'receive:conversation-1:message-1',
      remoteDeviceId: 'device-b1',
    }));
  });

  test('acknowledges the backend only after the local decrypt commit resolves', async () => {
    const { api, client, orchestrator } = setup();
    await expect(orchestrator.receiveAndAcknowledge({
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      conversationId: 'conversation-1',
      messageId: 'message-1',
    })).resolves.toMatchObject({ plaintext: 'veilig bericht' });

    expect(client.decrypt.mock.invocationCallOrder[0])
      .toBeLessThan(client.storeReceivedMessage.mock.invocationCallOrder[0]);
    expect(client.storeReceivedMessage.mock.invocationCallOrder[0])
      .toBeLessThan(api.acknowledgeMessage.mock.invocationCallOrder[0]);
    expect(api.acknowledgeMessage).toHaveBeenCalledWith(USER, {
      conversationId: 'conversation-1',
      messageId: 'message-1',
      deviceId: 'device-a1',
    });
  });

  test('keeps ciphertext queued when sending fails and retries the exact payload', async () => {
    const { api, client, orchestrator } = setup();
    const networkError = new TypeError('Failed to fetch');
    api.sendMessage.mockRejectedValueOnce(networkError);
    await expect(orchestrator.sendText({
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      conversationId: 'conversation-1',
      recipientUserId: 'user-b',
      plaintext: 'veilig bericht',
      clientMessageId: CLIENT_MESSAGE_ID,
    })).rejects.toBe(networkError);
    expect(client.removeOutbox).not.toHaveBeenCalled();

    const pending = client.saveOutbox.mock.calls[0][0];
    client.listOutbox.mockResolvedValue({ messages: [pending] });
    api.sendMessage.mockResolvedValueOnce({ messageId: 'message-1' });
    await expect(orchestrator.retryOutbox({ user: USER }))
      .resolves.toEqual([{ messageId: 'message-1' }]);
    expect(api.sendMessage).toHaveBeenLastCalledWith(
      USER,
      pending.message,
      pending.expectedRecipientDevices,
    );
    expect(client.removeOutbox).toHaveBeenCalledWith({ clientMessageId: CLIENT_MESSAGE_ID });
  });

  test('restores received plaintext only through encrypted worker history', async () => {
    const { client, orchestrator } = setup();
    const stored = [{
      conversationId: 'conversation-1',
      messageId: 'message-1',
      plaintext: 'veilig bericht',
    }];
    client.listReceivedMessages.mockResolvedValue({ messages: stored });
    await expect(orchestrator.listReceivedMessages({ conversationId: 'conversation-1' }))
      .resolves.toEqual(stored);
    expect(client.listReceivedMessages).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
    });
  });

  test('does not reach the network when durable outbox storage fails', async () => {
    const { api, client, orchestrator } = setup();
    client.saveOutbox.mockRejectedValue(new Error('e2ee_browser_record_write_failed'));
    await expect(orchestrator.sendText({
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      conversationId: 'conversation-1',
      recipientUserId: 'user-b',
      plaintext: 'veilig bericht',
      clientMessageId: CLIENT_MESSAGE_ID,
    })).rejects.toThrow('e2ee_browser_record_write_failed');
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  test('fails closed while the isolated browser provider is not bootstrapped', async () => {
    const { client, orchestrator } = setup();
    client.status.mockResolvedValue({ wasmReady: true, bootstrapped: false });
    await expect(orchestrator.receiveText({
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      conversationId: 'conversation-1',
      messageId: 'message-1',
    })).rejects.toThrow('v2_browser_provider_not_released');
    expect(client.decrypt).not.toHaveBeenCalled();
  });
});
