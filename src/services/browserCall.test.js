import {
  BrowserCallMediaSession,
  browserCallErrorMessage,
  emitCallEvent,
  requestBrowserCallMedia,
  requestBrowserMicrophone,
} from './browserCall';

function mediaStream() {
  return {
    getTracks: jest.fn(() => [{ stop: jest.fn(), enabled: true }]),
    getAudioTracks: jest.fn(() => [{ enabled: true }]),
    getVideoTracks: jest.fn(() => [{ enabled: true }]),
  };
}

class FakePeerConnection {
  constructor(configuration) {
    this.configuration = configuration;
    this.connectionState = 'new';
    this.remoteDescription = null;
    this.addTrack = jest.fn();
    this.addIceCandidate = jest.fn().mockResolvedValue(undefined);
    this.createOffer = jest.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' });
    this.createAnswer = jest.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' });
    this.setLocalDescription = jest.fn().mockResolvedValue(undefined);
    this.setRemoteDescription = jest.fn(async (description) => {
      this.remoteDescription = description;
    });
    this.close = jest.fn();
    this.restartIce = jest.fn();
  }
}

function runtime() {
  return {
    RTCPeerConnection: FakePeerConnection,
    RTCIceCandidate: class FakeIceCandidate {
      constructor(value) { Object.assign(this, value); }
    },
    crypto: { randomUUID: jest.fn(() => 'message-123') },
  };
}

function relayingSocket() {
  return {
    connected: true,
    emit: jest.fn((event, payload, callback) => callback({ ok: true, status: 'RELAYED' })),
  };
}

describe('browserCall', () => {
  test('emits call protocol events with acknowledgement', async () => {
    const socket = relayingSocket();
    await expect(emitCallEvent(socket, 'call:v2:media', { sessionId: 'session-123' }))
      .resolves.toEqual({ ok: true, status: 'RELAYED' });
    expect(socket.emit).toHaveBeenCalledWith(
      'call:v2:media',
      { sessionId: 'session-123' },
      expect.any(Function)
    );
  });

  test('requests audio with browser processing enabled', async () => {
    const stream = mediaStream();
    const getUserMedia = jest.fn().mockResolvedValue(stream);
    await expect(requestBrowserMicrophone({ navigator: { mediaDevices: { getUserMedia } } }))
      .resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  });

  test('requests camera and microphone for a video call', async () => {
    const stream = mediaStream();
    const getUserMedia = jest.fn().mockResolvedValue(stream);
    await expect(requestBrowserCallMedia('video', { navigator: { mediaDevices: { getUserMedia } } }))
      .resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  });

  test('caller publishes an offer through the existing media event', async () => {
    const socket = relayingSocket();
    const session = {
      sessionId: 'session-123', callerUid: 'caller', calleeUid: 'callee', state: 'CONNECTING',
    };
    const media = new BrowserCallMediaSession({
      socket,
      session,
      localUid: 'caller',
      localStream: mediaStream(),
      runtime: runtime(),
    });

    await media.start([{ urls: ['stun:example.test'] }]);

    expect(socket.emit).toHaveBeenCalledWith(
      'call:v2:media',
      expect.objectContaining({
        sessionId: 'session-123', type: 'offer', description: 'offer-sdp',
      }),
      expect.any(Function)
    );
  });

  test('callee answers an offer and preserves early ICE candidates', async () => {
    const socket = relayingSocket();
    const session = {
      sessionId: 'session-123', callerUid: 'caller', calleeUid: 'callee', state: 'CONNECTING',
    };
    const media = new BrowserCallMediaSession({
      socket,
      session,
      localUid: 'callee',
      localStream: mediaStream(),
      runtime: runtime(),
    });
    await media.start([{ urls: ['stun:example.test'] }]);
    await media.handleSignal({
      sessionId: 'session-123',
      type: 'candidate',
      candidate: { mediaStreamId: 'audio', mediaLineIndex: 0, value: 'candidate-value' },
    });
    await media.handleSignal({ sessionId: 'session-123', type: 'offer', description: 'offer-sdp' });

    expect(media.connection.addIceCandidate).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith(
      'call:v2:media',
      expect.objectContaining({ type: 'answer', description: 'answer-sdp' }),
      expect.any(Function)
    );
  });

  test('maps media permission denial to actionable copy', () => {
    expect(browserCallErrorMessage({ name: 'NotAllowedError' }))
      .toBe('Geef Pulse toegang tot je microfoon om te bellen.');
    expect(browserCallErrorMessage({ name: 'NotAllowedError' }, 'video'))
      .toBe('Geef Pulse toegang tot je camera en microfoon om te videobellen.');
  });
});
