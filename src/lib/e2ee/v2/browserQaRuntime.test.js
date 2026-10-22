import { startBrowserE2eeV2QaRuntime } from './browserQaRuntime';

function storage() {
  const values = new Map();
  return {
    getItem: jest.fn((key) => values.get(key) || null),
    setItem: jest.fn((key, value) => values.set(key, value)),
    removeItem: jest.fn((key) => values.delete(key)),
  };
}

function setup() {
  const client = {
    initialize: jest.fn().mockResolvedValue({ bootstrapped: false }),
    storeReceivedMessage: jest.fn().mockResolvedValue({ stored: true }),
    close: jest.fn(),
  };
  const api = {
    listDevices: jest.fn().mockResolvedValue([]),
    listMessageFeed: jest.fn().mockResolvedValue([]),
  };
  const messages = {
    retryOutbox: jest.fn().mockResolvedValue([]),
    sendText: jest.fn().mockResolvedValue({
      messageId: 'message-1',
      clientMessageId: 'client-1',
      acceptedAt: '2026-10-21T10:00:00.000Z',
    }),
    receiveAndAcknowledge: jest.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-2',
      plaintext: 'ontvangen',
      createdAt: '2026-10-21T10:01:00.000Z',
    }),
    listReceivedMessages: jest.fn().mockResolvedValue([]),
    clearReceivedMessages: jest.fn().mockResolvedValue({ cleared: 1 }),
  };
  const registerDevice = jest.fn().mockResolvedValue({
    deviceId: 'browser-device-a',
    signalDeviceId: 1,
    identityVersion: 1,
    status: 'REGISTERED',
  });
  return {
    api,
    client,
    messages,
    registerDevice,
    options: {
      user: { uid: 'user-a' },
      client,
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
      api,
      storage: storage(),
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
      bindSocketDevice: jest.fn(),
      assertConfiguration: jest.fn(),
      registerDevice,
      createMessageOrchestrator: jest.fn(() => messages),
      handleSecurityEvent: jest.fn().mockResolvedValue({
        action: 'remote_session_invalidated',
      }),
    },
  };
}

describe('browser E2EE v2 QA runtime', () => {
  test('initializes worker binding, registers and resumes the ciphertext outbox', async () => {
    const { client, messages, registerDevice, options } = setup();
    const runtime = await startBrowserE2eeV2QaRuntime(options);
    expect(client.initialize).toHaveBeenCalledWith({
      uid: 'user-a',
      deviceId: 'browser-qa-123e4567-e89b-42d3-a456-426614174000',
      signalDeviceId: 1,
    });
    expect(registerDevice).toHaveBeenCalledWith(expect.objectContaining({ client }));
    expect(messages.retryOutbox).toHaveBeenCalledWith({ user: options.user });
    expect(options.bindSocketDevice).toHaveBeenCalledWith('browser-device-a');
    expect(runtime).toMatchObject({ deviceId: 'browser-device-a', signalDeviceId: 1 });
  });

  test('stores sent plaintext only through encrypted worker history', async () => {
    const { client, messages, options } = setup();
    const runtime = await startBrowserE2eeV2QaRuntime(options);
    await runtime.sendText({
      conversationId: 'conversation-1',
      recipientUserId: 'user-b',
      plaintext: 'uitgaand',
      clientMessageId: 'client-1',
    });
    expect(messages.sendText).toHaveBeenCalledWith(expect.objectContaining({
      plaintext: 'uitgaand',
    }));
    expect(client.storeReceivedMessage).toHaveBeenCalledWith(expect.objectContaining({
      messageId: 'message-1',
      plaintext: 'uitgaand',
    }));
  });

  test('uses encrypted local history while the QA backend is offline', async () => {
    const { api, messages, options } = setup();
    const stored = [{
      conversationId: 'conversation-1',
      messageId: 'message-stored',
      plaintext: 'offline beschikbaar',
      createdAt: '2026-10-21T09:00:00.000Z',
    }];
    messages.listReceivedMessages.mockResolvedValue(stored);
    api.listMessageFeed.mockRejectedValue(new TypeError('Failed to fetch'));
    const runtime = await startBrowserE2eeV2QaRuntime(options);
    await expect(runtime.fetchTextMessages({ conversationId: 'conversation-1' }))
      .resolves.toEqual(stored);
    expect(messages.receiveAndAcknowledge).not.toHaveBeenCalled();
  });

  test('passes security events to the browser lifecycle and clears public binding', async () => {
    const { client, options } = setup();
    const runtime = await startBrowserE2eeV2QaRuntime(options);
    await runtime.handleSecurityEvent({ event: { type: 'identity_changed' } });
    expect(options.handleSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ client }));
    expect(runtime.invalidateLocalDevice({ reason: 'device_revoked' })).toEqual({
      invalidated: true,
      reason: 'device_revoked',
    });
    expect(options.bindSocketDevice).toHaveBeenLastCalledWith(null);
  });
});
