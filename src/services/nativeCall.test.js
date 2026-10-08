import { isNativePulseEnvironment } from '../lib/platform/runtime';
import {
  addNativeCallStatusListener,
  clearNativeCallIdentity,
  consumeNativeCallFollowUpAction,
  getNativeCallCapabilities,
  nativeCallErrorMessage,
  startNativeAudioCall,
  syncNativeCallIdentity,
} from './nativeCall';

const mockGetCapabilities = jest.fn();
const mockStartAudioCall = jest.fn();
const mockSyncIdentity = jest.fn();
const mockClearIdentity = jest.fn();
const mockConsumeFollowUpAction = jest.fn();
const mockAddListener = jest.fn();
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
    syncIdentity: (...args) => mockSyncIdentity(...args),
    clearIdentity: (...args) => mockClearIdentity(...args),
    consumeFollowUpAction: (...args) => mockConsumeFollowUpAction(...args),
    addListener: (...args) => mockAddListener(...args),
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

    await startNativeAudioCall({
      calleeUid: ' callee ',
      displayName: ' Contact ',
      photoURL: ' https://cdn.pulse.test/contact.jpg ',
    });

    expect(mockStartAudioCall).toHaveBeenCalledWith(expect.objectContaining({
      callerUid: 'caller-uid',
      calleeUid: 'callee',
      displayName: 'Contact',
      photoURL: 'https://cdn.pulse.test/contact.jpg',
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

  test('synchronizes web identity without requesting media permission', async () => {
    mockSyncIdentity.mockResolvedValueOnce({ ok: true, uid: 'caller-uid' });

    await expect(syncNativeCallIdentity({
      user: { uid: 'caller-uid', getIdToken: mockGetIdToken },
      idToken: 'already-fetched-token',
    })).resolves.toEqual({ ok: true, uid: 'caller-uid' });

    expect(mockGetIdToken).not.toHaveBeenCalled();
    expect(mockSyncIdentity).toHaveBeenCalledWith({
      callerUid: 'caller-uid',
      bootstrapCode: 'a'.repeat(43),
    });
  });

  test('clears the native identity on logout', async () => {
    mockClearIdentity.mockResolvedValueOnce({ ok: true });
    await expect(clearNativeCallIdentity()).resolves.toEqual({ ok: true });
    expect(mockClearIdentity).toHaveBeenCalledTimes(1);
  });

  test('normalizes a pending message action from the ended call screen', async () => {
    mockConsumeFollowUpAction.mockResolvedValueOnce({
      type: 'message',
      peerUid: 'caller-uid',
      displayName: 'Yushua',
    });

    await expect(consumeNativeCallFollowUpAction()).resolves.toEqual({
      type: 'message',
      peerUid: 'caller-uid',
      displayName: 'Yushua',
    });
  });

  test('maps permission errors to a useful message', () => {
    expect(nativeCallErrorMessage({ code: 'microphone_permission_denied' }))
      .toBe('Microfoontoegang is nodig om te bellen.');
  });

  test('subscribes to asynchronous native call status updates', async () => {
    const callback = jest.fn();
    const handle = { remove: jest.fn() };
    mockAddListener.mockResolvedValueOnce(handle);

    await expect(addNativeCallStatusListener(callback)).resolves.toBe(handle);
    expect(mockAddListener).toHaveBeenCalledWith('callStatusChanged', callback);
  });

  test.each([
    ['call_signaling_unavailable', 'De oproepverbinding met Pulse is verbroken.'],
    ['signaling_error', 'De oproepverbinding met Pulse is verbroken.'],
    ['media_error', 'De audioverbinding kon niet worden opgebouwd.'],
    ['telecom_error', 'Android kon de oproep niet registreren.'],
    ['call_rate_limited', 'Je hebt in korte tijd te vaak gebeld. Probeer het later opnieuw.'],
    ['call_rejected', 'De oproep is door de belservice geweigerd.'],
  ])('maps asynchronous %s failures to a useful message', (code, message) => {
    expect(nativeCallErrorMessage({ code })).toBe(message);
  });
});
