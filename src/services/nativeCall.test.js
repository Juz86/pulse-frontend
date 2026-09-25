import { isNativePulseEnvironment } from '../lib/platform/runtime';
import {
  getNativeCallCapabilities,
  nativeCallErrorMessage,
  startNativeAudioCall,
} from './nativeCall';

const mockGetCapabilities = jest.fn();
const mockStartAudioCall = jest.fn();
const mockGetPlatform = jest.fn(() => 'android');
const mockGetIdToken = jest.fn();

jest.mock('../firebase', () => ({
  auth: {
    currentUser: {
      uid: 'caller-uid',
      getIdToken: (...args) => mockGetIdToken(...args),
    },
  },
}));

jest.mock('./socket', () => ({
  BACKEND_URL: 'https://api.pulse.test',
}));

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: (...args) => mockGetPlatform(...args),
  },
  registerPlugin: () => ({
    getCapabilities: (...args) => mockGetCapabilities(...args),
    startAudioCall: (...args) => mockStartAudioCall(...args),
  }),
}));

jest.mock('../lib/platform/runtime', () => ({
  isNativePulseEnvironment: jest.fn(() => true),
}));

describe('nativeCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPlatform.mockReturnValue('android');
    mockGetIdToken.mockResolvedValue('web-id-token');
    isNativePulseEnvironment.mockReturnValue(true);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: 'a'.repeat(43) }),
    });
  });

  test('hides native calling when the installed plugin is unavailable', async () => {
    mockGetCapabilities.mockRejectedValueOnce(new Error('not implemented'));

    await expect(getNativeCallCapabilities()).resolves.toEqual({ audio: false, video: false });
  });

  test('starts an audio call with a unique request and normalized target', async () => {
    mockStartAudioCall.mockResolvedValueOnce({ ok: true, status: 'starting' });

    await startNativeAudioCall({ calleeUid: ' callee ', displayName: ' Contact ' });

    expect(mockStartAudioCall).toHaveBeenCalledWith(expect.objectContaining({
      callerUid: 'caller-uid',
      calleeUid: 'callee',
      displayName: 'Contact',
      bootstrapCode: 'a'.repeat(43),
      requestId: expect.any(String),
    }));
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.pulse.test/api/calling/v2/native-auth/bootstrap',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer web-id-token' }),
      }),
    );
  });

  test('does not start Android calling when bootstrap exchange fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: 'native_auth_unavailable' }),
    });

    await expect(startNativeAudioCall({ calleeUid: 'callee', displayName: 'Contact' }))
      .rejects.toMatchObject({ code: 'native_auth_unavailable' });
    expect(mockStartAudioCall).not.toHaveBeenCalled();
  });

  test('maps permission errors to a useful message', () => {
    expect(nativeCallErrorMessage({ code: 'microphone_permission_denied' }))
      .toBe('Microfoontoegang is nodig om te bellen.');
  });
});
