import RealtimeKitClient from '@cloudflare/realtimekit';
import {
  fetchRealtimeKitCallCredentials,
  startRealtimeKitCall,
} from './realtimeKitCalling';

jest.mock('@cloudflare/realtimekit', () => ({
  __esModule: true,
  default: { init: jest.fn() },
}));

function eventTarget(values = []) {
  const listeners = new Map();
  const map = new Map(values);
  map.on = jest.fn((event, handler) => listeners.set(event, handler));
  map.off = jest.fn((event) => listeners.delete(event));
  map.emit = (event, value) => listeners.get(event)?.(value);
  return map;
}

function participant(id = 'remote-1') {
  const listeners = new Map();
  return {
    id,
    audioTrack: { id: `${id}-audio`, readyState: 'live' },
    videoTrack: { id: `${id}-video`, readyState: 'live' },
    videoEnabled: true,
    on: jest.fn((event, handler) => listeners.set(event, handler)),
    off: jest.fn((event) => listeners.delete(event)),
    emit: (event, value) => listeners.get(event)?.(value),
  };
}

describe('RealtimeKit Call Engine v2 web client', () => {
  const OriginalMediaStream = global.MediaStream;

  beforeAll(() => {
    global.MediaStream = class MediaStreamMock {
      constructor(tracks) { this.tracks = tracks; }
      getTracks() { return this.tracks; }
    };
  });

  afterAll(() => {
    global.MediaStream = OriginalMediaStream;
  });

  afterEach(() => jest.clearAllMocks());

  test('retrieves a scoped participant token from Railway', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        engine: 'realtimekit-v2',
        authToken: 'participant-token',
        sessionId: 'session-12345678',
        isVideo: true,
      }),
    });

    await expect(fetchRealtimeKitCallCredentials({
      sessionId: 'session-12345678',
      idToken: 'firebase-token',
      name: 'Yousef',
      backendUrl: 'https://api.example.test/',
      fetchImpl,
    })).resolves.toEqual({
      engine: 'realtimekit-v2',
      authToken: 'participant-token',
      sessionId: 'session-12345678',
      isVideo: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/api/calls/realtimekit/session/session-12345678/join',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer firebase-token' }),
      }),
    );
  });

  test('joins once, publishes media, toggles devices and leaves idempotently', async () => {
    const remote = participant();
    const joined = eventTarget([[remote.id, remote]]);
    const meeting = {
      join: jest.fn().mockResolvedValue(),
      leave: jest.fn().mockResolvedValue(),
      participants: { joined },
      self: {
        audioEnabled: true,
        videoEnabled: true,
        audioTrack: { id: 'local-audio', readyState: 'live' },
        videoTrack: { id: 'local-video', readyState: 'live' },
        enableAudio: jest.fn().mockResolvedValue(),
        disableAudio: jest.fn().mockResolvedValue(),
        enableVideo: jest.fn().mockResolvedValue(),
        disableVideo: jest.fn().mockResolvedValue(),
      },
    };
    RealtimeKitClient.init.mockResolvedValue(meeting);
    const onRemoteStream = jest.fn();

    const call = await startRealtimeKitCall({
      authToken: 'participant-token',
      isVideo: true,
      onRemoteStream,
    });

    expect(RealtimeKitClient.init).toHaveBeenCalledWith(expect.objectContaining({
      authToken: 'participant-token',
      defaults: { audio: true, video: true },
    }));
    expect(meeting.join).toHaveBeenCalledTimes(1);
    expect(onRemoteStream).toHaveBeenCalledWith(expect.any(MediaStream), remote);
    expect(call.getLocalStream().getTracks()).toHaveLength(2);

    await call.setMicrophoneEnabled(false);
    await call.setCameraEnabled(false);
    expect(meeting.self.disableAudio).toHaveBeenCalledTimes(1);
    expect(meeting.self.disableVideo).toHaveBeenCalledTimes(1);

    await call.leave();
    await call.leave();
    expect(meeting.leave).toHaveBeenCalledTimes(1);
  });
});
