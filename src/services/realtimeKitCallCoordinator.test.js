import {
  createRealtimeKitCallCoordinator,
  isRealtimeKitV2Offer,
  REALTIMEKIT_CALL_STATES,
} from './realtimeKitCallCoordinator';

function fakeSocket() {
  const listeners = new Map();
  const emitted = [];
  return {
    connected: true,
    emitted,
    on: jest.fn((event, handler) => listeners.set(event, handler)),
    off: jest.fn((event) => listeners.delete(event)),
    emit: jest.fn((event, payload, acknowledgement) => {
      emitted.push({ event, payload });
      if (typeof acknowledgement === 'function') acknowledgement({ ok: true, sessionId: payload.sessionId });
    }),
    trigger(event, payload) { listeners.get(event)?.(payload); },
  };
}

function fakeMedia() {
  return {
    leave: jest.fn().mockResolvedValue(),
    getLocalStream: jest.fn(() => ({ id: 'local-stream' })),
    getRemoteStreams: jest.fn(() => new Map()),
    setMicrophoneEnabled: jest.fn().mockResolvedValue(),
    setCameraEnabled: jest.fn().mockResolvedValue(),
  };
}

describe('RealtimeKit v2 call coordinator', () => {
  test('recognizes only explicit v2 invitations', () => {
    expect(isRealtimeKitV2Offer({ offer: { engine: 'realtimekit-v2' } })).toBe(true);
    expect(isRealtimeKitV2Offer({ callEngine: 'realtimekit-v2' })).toBe(true);
    expect(isRealtimeKitV2Offer({ offer: { type: 'offer' } })).toBe(false);
  });

  test('starts one outgoing invitation and activates on the matching answer', async () => {
    const socket = fakeSocket();
    const media = fakeMedia();
    const states = [];
    const coordinator = createRealtimeKitCallCoordinator({
      socket,
      fetchCredentials: jest.fn().mockResolvedValue({ authToken: 'participant-token' }),
      startMedia: jest.fn().mockResolvedValue(media),
      onStateChange: (state) => states.push(state),
    });

    await coordinator.startOutgoing({
      toUid: 'callee', callerName: 'Caller', isVideo: true, idToken: 'firebase-token',
    });
    expect(socket.emitted.find(({ event }) => event === 'call:offer').payload.offer)
      .toEqual({ engine: 'realtimekit-v2' });
    expect(coordinator.state).toBe(REALTIMEKIT_CALL_STATES.RINGING);

    socket.trigger('call:answer', {
      sessionId: coordinator.sessionId,
      answer: { engine: 'realtimekit-v2' },
    });
    expect(coordinator.state).toBe(REALTIMEKIT_CALL_STATES.CONNECTING);
    expect(states).toContain(REALTIMEKIT_CALL_STATES.PREPARING);
    await coordinator.end();
    expect(media.leave).toHaveBeenCalledTimes(1);
  });

  test('joins media before acknowledging an incoming call', async () => {
    const socket = fakeSocket();
    const media = fakeMedia();
    const startMedia = jest.fn().mockResolvedValue(media);
    const coordinator = createRealtimeKitCallCoordinator({
      socket,
      fetchCredentials: jest.fn().mockResolvedValue({ authToken: 'participant-token' }),
      startMedia,
    });

    await coordinator.answerIncoming({
      incoming: {
        sessionId: 'call_incoming_123', from: 'caller', isVideo: false,
        offer: { engine: 'realtimekit-v2' },
      },
      idToken: 'firebase-token',
      name: 'Callee',
    });

    expect(startMedia).toHaveBeenCalledWith(expect.objectContaining({ isVideo: false }));
    expect(socket.emitted.find(({ event }) => event === 'call:answer').payload.answer)
      .toEqual({ engine: 'realtimekit-v2' });
    expect(coordinator.state).toBe(REALTIMEKIT_CALL_STATES.ACTIVE);
    await coordinator.end();
  });
});
