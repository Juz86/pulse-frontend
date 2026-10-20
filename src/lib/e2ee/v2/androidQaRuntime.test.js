import {
  clearAndroidE2eeV2QaBinding,
  createAndroidE2eeV2QaBinding,
  readAndroidE2eeV2QaBinding,
  startAndroidE2eeV2QaRuntime,
} from './androidQaRuntime';

function createStorage() {
  const values = new Map();
  return {
    getItem: jest.fn((key) => values.get(key) || null),
    setItem: jest.fn((key, value) => values.set(key, value)),
    removeItem: jest.fn((key) => values.delete(key)),
  };
}

describe('Android E2EE v2 QA runtime', () => {
  test('persists public device routing metadata before registration retries', () => {
    const storage = createStorage();
    const first = createAndroidE2eeV2QaBinding({
      userId: 'user-a',
      registeredDevices: [{ signalDeviceId: 1 }, { signalDeviceId: 2 }],
      storage,
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
    });
    const second = createAndroidE2eeV2QaBinding({
      userId: 'user-a',
      registeredDevices: [],
      storage,
      randomUuid: () => 'unused',
    });

    expect(first).toEqual({
      deviceId: 'qa-123e4567-e89b-42d3-a456-426614174000',
      signalDeviceId: 3,
    });
    expect(second).toEqual(first);
    expect(readAndroidE2eeV2QaBinding('user-a', storage)).toEqual(first);
    clearAndroidE2eeV2QaBinding('user-a', storage);
    expect(readAndroidE2eeV2QaBinding('user-a', storage)).toBeNull();
  });

  test('invalidates the local binding and disconnects its socket audience', async () => {
    const storage = createStorage();
    const bindSocketDevice = jest.fn();
    const runtime = await startAndroidE2eeV2QaRuntime({
      user: { uid: 'user-a' },
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
      api: { listDevices: jest.fn().mockResolvedValue([]) },
      registerDevice: jest.fn().mockResolvedValue({
        deviceId: 'qa-device-a',
        signalDeviceId: 1,
        identityVersion: 1,
      }),
      storage,
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
      bindSocketDevice,
      assertConfiguration: jest.fn(),
    });

    expect(runtime.invalidateLocalDevice({ reason: 'device_revoked' })).toEqual({
      invalidated: true,
      reason: 'device_revoked',
    });
    expect(readAndroidE2eeV2QaBinding('user-a', storage)).toBeNull();
    expect(bindSocketDevice).toHaveBeenLastCalledWith(null);
  });

  test('registers, binds the socket and exposes v2 send and receive functions', async () => {
    const storage = createStorage();
    const user = { uid: 'user-a' };
    const api = {
      listDevices: jest.fn().mockResolvedValue([]),
      acknowledgeMessage: jest.fn().mockResolvedValue({ ok: true }),
      listMessageFeed: jest.fn().mockResolvedValue([{
        conversationId: 'conversation-1',
        messageId: 'message-1',
        createdAt: '2026-10-19T12:00:00.000Z',
      }]),
    };
    const registerDevice = jest.fn().mockResolvedValue({
      deviceId: 'qa-device-a',
      signalDeviceId: 1,
      identityVersion: 1,
      status: 'REGISTERED',
    });
    const bindSocketDevice = jest.fn();
    const assertConfiguration = jest.fn();
    const listStoredMessages = jest.fn().mockResolvedValue([]);
    const storeMessage = jest.fn().mockResolvedValue({ stored: true });
    const receiveMessage = jest.fn().mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      plaintext: 'veilig bericht',
      createdAt: '2026-10-19T12:00:00.000Z',
    });

    const runtime = await startAndroidE2eeV2QaRuntime({
      user,
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
      api,
      registerDevice,
      storage,
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
      bindSocketDevice,
      assertConfiguration,
      receiveMessage,
      listStoredMessages,
      storeMessage,
    });

    expect(assertConfiguration).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(registerDevice).toHaveBeenCalledWith(expect.objectContaining({
      user,
      deviceId: 'qa-123e4567-e89b-42d3-a456-426614174000',
      signalDeviceId: 1,
      api,
    }));
    expect(bindSocketDevice).toHaveBeenCalledWith('qa-device-a');
    expect(runtime).toMatchObject({
      deviceId: 'qa-device-a',
      signalDeviceId: 1,
      status: 'REGISTERED',
    });
    expect(typeof runtime.sendText).toBe('function');
    expect(typeof runtime.receiveTextMessage).toBe('function');
    await expect(runtime.fetchTextMessages({
      conversationId: 'conversation-1',
      limit: 30,
      offset: 0,
    })).resolves.toEqual([expect.objectContaining({
      messageId: 'message-1',
      plaintext: 'veilig bericht',
    })]);
    expect(api.listMessageFeed).toHaveBeenCalledWith(user, {
      conversationId: 'conversation-1',
      deviceId: 'qa-device-a',
      limit: 30,
      offset: 0,
    });
    expect(receiveMessage).toHaveBeenCalledWith(expect.objectContaining({
      localDeviceId: 'qa-device-a',
      localSignalDeviceId: 1,
      conversationId: 'conversation-1',
      messageId: 'message-1',
      api,
    }));
    expect(api.acknowledgeMessage).toHaveBeenCalledWith(user, {
      conversationId: 'conversation-1',
      messageId: 'message-1',
      deviceId: 'qa-device-a',
    });
    expect(storeMessage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-a',
      messageId: 'message-1',
      plaintext: 'veilig bericht',
    }));
    expect(storeMessage.mock.invocationCallOrder[0])
      .toBeLessThan(api.acknowledgeMessage.mock.invocationCallOrder[0]);

    await runtime.receiveTextMessage({
      conversationId: 'conversation-1',
      messageId: 'message-1',
    });
    expect(receiveMessage).toHaveBeenCalledTimes(1);
    expect(api.acknowledgeMessage).toHaveBeenCalledTimes(1);
  });

  test('restores encrypted native history without decrypting it again', async () => {
    const user = { uid: 'user-a' };
    const storedMessage = {
      conversationId: 'conversation-1',
      messageId: 'message-stored',
      clientMessageId: 'client-stored',
      senderUserId: 'user-b',
      senderDeviceId: 'device-b',
      messageType: 'text',
      plaintext: 'hersteld bericht',
      createdAt: '2026-10-19T12:00:00.000Z',
    };
    const api = {
      listDevices: jest.fn().mockResolvedValue([]),
      listMessageFeed: jest.fn().mockResolvedValue([]),
      acknowledgeMessage: jest.fn(),
    };
    const receiveMessage = jest.fn();
    const runtime = await startAndroidE2eeV2QaRuntime({
      user,
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
      api,
      registerDevice: jest.fn().mockResolvedValue({
        deviceId: 'qa-device-a',
        signalDeviceId: 1,
      }),
      storage: createStorage(),
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
      bindSocketDevice: jest.fn(),
      assertConfiguration: jest.fn(),
      receiveMessage,
      listStoredMessages: jest.fn().mockResolvedValue([storedMessage]),
      storeMessage: jest.fn(),
    });

    await expect(runtime.fetchTextMessages({ conversationId: 'conversation-1' }))
      .resolves.toEqual([storedMessage]);
    expect(receiveMessage).not.toHaveBeenCalled();
    expect(api.acknowledgeMessage).not.toHaveBeenCalled();
  });

  test('uses native history when the message feed is offline but not on authorization errors', async () => {
    const storedMessage = {
      conversationId: 'conversation-1',
      messageId: 'message-stored',
      senderUserId: 'user-b',
      senderDeviceId: 'device-b',
      messageType: 'text',
      plaintext: 'offline beschikbaar',
      createdAt: '2026-10-19T12:00:00.000Z',
    };
    const setup = async (feedError) => startAndroidE2eeV2QaRuntime({
      user: { uid: 'user-a' },
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
      api: {
        listDevices: jest.fn().mockResolvedValue([]),
        listMessageFeed: jest.fn().mockRejectedValue(feedError),
      },
      registerDevice: jest.fn().mockResolvedValue({
        deviceId: 'qa-device-a',
        signalDeviceId: 1,
      }),
      storage: createStorage(),
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
      bindSocketDevice: jest.fn(),
      assertConfiguration: jest.fn(),
      listStoredMessages: jest.fn().mockResolvedValue([storedMessage]),
      storeMessage: jest.fn(),
    });

    const offlineRuntime = await setup(new TypeError('Failed to fetch'));
    await expect(offlineRuntime.fetchTextMessages({ conversationId: 'conversation-1' }))
      .resolves.toEqual([storedMessage]);

    const forbidden = new Error('v2_forbidden');
    forbidden.status = 403;
    const forbiddenRuntime = await setup(forbidden);
    await expect(forbiddenRuntime.fetchTextMessages({ conversationId: 'conversation-1' }))
      .rejects.toBe(forbidden);
  });

  test('starts a legacy device binding offline and restores native history', async () => {
    const storage = createStorage();
    storage.setItem('pulse_e2ee_v2_qa_binding_user-a', JSON.stringify({
      deviceId: 'qa-123e4567-e89b-42d3-a456-426614174000',
      signalDeviceId: 1,
      identityVersion: 1,
    }));
    const storedMessage = {
      conversationId: 'conversation-1',
      messageId: 'message-stored',
      senderUserId: 'user-b',
      senderDeviceId: 'device-b',
      messageType: 'text',
      plaintext: 'koude start',
      createdAt: '2026-10-19T12:00:00.000Z',
    };
    const api = {
      listDevices: jest.fn(),
      listMessageFeed: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    };
    const registerDevice = jest.fn();
    const runtime = await startAndroidE2eeV2QaRuntime({
      user: { uid: 'user-a' },
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
      api,
      registerDevice,
      storage,
      bindSocketDevice: jest.fn(),
      assertConfiguration: jest.fn(),
      listStoredMessages: jest.fn().mockResolvedValue([storedMessage]),
      storeMessage: jest.fn(),
    });

    expect(runtime.status).toBe('REGISTERED_CACHED');
    expect(api.listDevices).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
    await expect(runtime.fetchTextMessages({ conversationId: 'conversation-1' }))
      .resolves.toEqual([storedMessage]);
  });

  test('stores sent plaintext in native encrypted history', async () => {
    const storeMessage = jest.fn().mockResolvedValue({ stored: true });
    const sendResult = {
      messageId: 'message-sent',
      clientMessageId: 'client-sent',
      acceptedAt: '2026-10-19T13:00:00.000Z',
    };
    const sendMessage = jest.fn().mockResolvedValue(sendResult);

    const runtimeWithSend = await startAndroidE2eeV2QaRuntime({
      user: { uid: 'user-a' },
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
      api: { listDevices: jest.fn().mockResolvedValue([]) },
      registerDevice: jest.fn().mockResolvedValue({
        deviceId: 'qa-device-a',
        signalDeviceId: 1,
      }),
      storage: createStorage(),
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
      bindSocketDevice: jest.fn(),
      assertConfiguration: jest.fn(),
      sendMessage,
      storeMessage,
      listStoredMessages: jest.fn(),
    });

    await expect(runtimeWithSend.sendText({
      conversationId: 'conversation-1',
      recipientUserId: 'user-b',
      plaintext: 'uitgaand bericht',
      clientMessageId: 'client-sent',
    })).resolves.toEqual(sendResult);
    expect(storeMessage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-a',
      messageId: 'message-sent',
      plaintext: 'uitgaand bericht',
    }));
  });
});
