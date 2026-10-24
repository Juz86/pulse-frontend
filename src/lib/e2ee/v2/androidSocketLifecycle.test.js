import { attachAndroidE2eeV2SocketLifecycle } from './androidSocketLifecycle';

function createSocket() {
  const handlers = new Map();
  return {
    handlers,
    on: jest.fn((event, handler) => handlers.set(event, handler)),
    off: jest.fn((event, handler) => {
      if (handlers.get(event) === handler) handlers.delete(event);
    }),
    emitIncoming(event, payload) {
      handlers.get(event)?.(payload);
    },
  };
}

const SECURITY_EVENT = {
  protocol: 'pulse_e2ee_v2',
  protocolVersion: 2,
  userId: 'user-b',
  deviceId: 'device-b1',
  signalDeviceId: 2,
  identityVersion: 2,
  type: 'identity_changed',
};

const MESSAGE_EVENT = {
  protocol: 'pulse_e2ee_v2',
  protocolVersion: 2,
  conversationId: 'conversation-1',
  messageId: 'message-1',
};
const GROUP_DISTRIBUTION_EVENT = {
  protocol: 'pulse_group_e2ee_v1',
  protocolVersion: 1,
  conversationId: 'group-1',
  epoch: 2,
  distributionId: '11111111-1111-4111-8111-111111111111',
};
const GROUP_MESSAGE_EVENT = {
  protocol: 'pulse_group_e2ee_v1',
  protocolVersion: 1,
  conversationId: 'group-1',
  messageId: '22222222-2222-4222-8222-222222222222',
};

function flushQueue() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Android E2EE v2 socket lifecycle', () => {
  test('attaches, serializes and detaches lifecycle handlers', async () => {
    const socket = createSocket();
    const calls = [];
    const handleSecurityEvent = jest.fn(async () => {
      calls.push('security');
      return { action: 'remote_session_invalidated' };
    });
    const receiveMessage = jest.fn(async () => {
      calls.push('message');
      return { id: 'message-1', plaintext: 'Hallo' };
    });
    const onMessage = jest.fn();

    const detach = attachAndroidE2eeV2SocketLifecycle({
      socket,
      user: { uid: 'user-a' },
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      handleSecurityEvent,
      receiveMessage,
      onMessage,
    });

    socket.emitIncoming('e2ee:identity-changed', SECURITY_EVENT);
    socket.emitIncoming('e2ee:v2:message-available', MESSAGE_EVENT);
    await flushQueue();

    expect(calls).toEqual(['security', 'message']);
    expect(onMessage).toHaveBeenCalledWith({ id: 'message-1', plaintext: 'Hallo' });
    detach();
    expect(socket.handlers.size).toBe(0);
  });

  test('deduplicates mirrored security events and repeated message signals', async () => {
    const socket = createSocket();
    const handleSecurityEvent = jest.fn().mockResolvedValue({
      action: 'remote_session_invalidated',
    });
    const receiveMessage = jest.fn().mockResolvedValue({ id: 'message-1' });

    attachAndroidE2eeV2SocketLifecycle({
      socket,
      user: { uid: 'user-a' },
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      handleSecurityEvent,
      receiveMessage,
    });

    socket.emitIncoming('e2ee:identity-changed', SECURITY_EVENT);
    socket.emitIncoming('e2ee:device-security', SECURITY_EVENT);
    socket.emitIncoming('e2ee:v2:message-available', MESSAGE_EVENT);
    socket.emitIncoming('e2ee:v2:message-available', MESSAGE_EVENT);
    await flushQueue();

    expect(handleSecurityEvent).toHaveBeenCalledTimes(1);
    expect(receiveMessage).toHaveBeenCalledTimes(1);
  });

  test('reports invalid events and allows retry after a processing failure', async () => {
    const socket = createSocket();
    const receiveMessage = jest.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({ id: 'message-1' });
    const onError = jest.fn();

    attachAndroidE2eeV2SocketLifecycle({
      socket,
      user: { uid: 'user-a' },
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      receiveMessage,
      onError,
    });

    socket.emitIncoming('e2ee:v2:message-available', { messageId: 'missing-header' });
    socket.emitIncoming('e2ee:v2:message-available', MESSAGE_EVENT);
    await flushQueue();
    socket.emitIncoming('e2ee:v2:message-available', MESSAGE_EVENT);
    await flushQueue();

    expect(onError).toHaveBeenCalledTimes(2);
    expect(receiveMessage).toHaveBeenCalledTimes(2);
  });

  test('surfaces local invalidation to the runtime coordinator', async () => {
    const socket = createSocket();
    const onLocalDeviceInvalidated = jest.fn();
    const handleSecurityEvent = jest.fn().mockResolvedValue({
      action: 'local_device_invalidated',
      requiresRegistration: true,
    });

    attachAndroidE2eeV2SocketLifecycle({
      socket,
      user: { uid: 'user-a' },
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      handleSecurityEvent,
      onLocalDeviceInvalidated,
    });
    socket.emitIncoming('e2ee:device-security', SECURITY_EVENT);
    await flushQueue();

    expect(onLocalDeviceInvalidated).toHaveBeenCalledWith(
      expect.objectContaining({ requiresRegistration: true }),
      SECURITY_EVENT,
    );
  });

  test('serializes and deduplicates group distribution and message events', async () => {
    const socket = createSocket();
    const calls = [];
    const receiveGroupDistribution = jest.fn(async () => calls.push('distribution'));
    const receiveGroupMessage = jest.fn(async () => {
      calls.push('message');
      return { plaintext: 'Hallo groep' };
    });
    const onGroupMessage = jest.fn();

    const detach = attachAndroidE2eeV2SocketLifecycle({
      socket,
      user: { uid: 'user-a' },
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      receiveGroupDistribution,
      receiveGroupMessage,
      onGroupMessage,
    });
    socket.emitIncoming('e2ee:group:distribution-available', GROUP_DISTRIBUTION_EVENT);
    socket.emitIncoming('e2ee:group:distribution-available', GROUP_DISTRIBUTION_EVENT);
    socket.emitIncoming('e2ee:group:message-available', GROUP_MESSAGE_EVENT);
    socket.emitIncoming('e2ee:group:message-available', GROUP_MESSAGE_EVENT);
    await flushQueue();

    expect(calls).toEqual(['distribution', 'message']);
    expect(onGroupMessage).toHaveBeenCalledWith({ plaintext: 'Hallo groep' });
    detach();
    expect(socket.handlers.size).toBe(0);
  });
});
