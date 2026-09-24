import { isNativePulseEnvironment } from '../lib/platform/runtime';
import {
  getNativeCallCapabilities,
  nativeCallErrorMessage,
  startNativeAudioCall,
} from './nativeCall';

const mockGetCapabilities = jest.fn();
const mockStartAudioCall = jest.fn();
const mockGetPlatform = jest.fn(() => 'android');

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
    isNativePulseEnvironment.mockReturnValue(true);
  });

  test('hides native calling when the installed plugin is unavailable', async () => {
    mockGetCapabilities.mockRejectedValueOnce(new Error('not implemented'));

    await expect(getNativeCallCapabilities()).resolves.toEqual({ audio: false, video: false });
  });

  test('starts an audio call with a unique request and normalized target', async () => {
    mockStartAudioCall.mockResolvedValueOnce({ ok: true, status: 'starting' });

    await startNativeAudioCall({ calleeUid: ' callee ', displayName: ' Contact ' });

    expect(mockStartAudioCall).toHaveBeenCalledWith(expect.objectContaining({
      calleeUid: 'callee',
      displayName: 'Contact',
      requestId: expect.any(String),
    }));
  });

  test('maps permission errors to a useful message', () => {
    expect(nativeCallErrorMessage({ code: 'microphone_permission_denied' }))
      .toBe('Microfoontoegang is nodig om te bellen.');
  });
});
