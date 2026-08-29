import { registerPlugin } from '@capacitor/core';
import {
  isAndroidNativeCalling,
  presentNativeIncomingCall,
  startNativeOutgoingCall,
} from './nativeCalling';

jest.mock('@capacitor/core', () => ({ registerPlugin: jest.fn() }));

describe('Android native calling bridge', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    registerPlugin.mockReset();
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ customToken: 'native-custom-token' }),
    });
  });

  afterEach(() => {
    delete window.Capacitor;
    global.fetch = originalFetch;
  });

  test('selects native calling only for Android native builds', () => {
    expect(isAndroidNativeCalling()).toBe(true);
    window.Capacitor.getPlatform = () => 'web';
    expect(isAndroidNativeCalling()).toBe(false);
  });

  test('starts outgoing video without browser getUserMedia', async () => {
    const startOutgoingCall = jest.fn().mockResolvedValue({ sessionId: 'call-1', native: true });
    const provisionCallAuth = jest.fn().mockResolvedValue({ ok: true, uid: 'caller-1' });
    registerPlugin.mockReturnValue({ startOutgoingCall, provisionCallAuth });

    await startNativeOutgoingCall({
      toUid: 'peer-1',
      convId: null,
      contactName: 'Yousef',
      callerName: 'Habibi',
      isVideo: true,
      backendUrl: 'https://api.example.test',
      idToken: 'web-id-token-outgoing',
    });

    expect(provisionCallAuth).toHaveBeenCalledWith({ customToken: 'native-custom-token' });
    expect(startOutgoingCall).toHaveBeenCalledWith({
      toUid: 'peer-1',
      convId: null,
      contactName: 'Yousef',
      callerName: 'Habibi',
      isVideo: true,
    });
  });

  test('does not start Telecom when native authentication fails', async () => {
    const startOutgoingCall = jest.fn();
    registerPlugin.mockReturnValue({ startOutgoingCall });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(startNativeOutgoingCall({
      toUid: 'peer-1',
      contactName: 'Yousef',
      callerName: 'Habibi',
      isVideo: false,
      backendUrl: 'https://api.example.test',
      idToken: 'web-id-token-failure',
    })).rejects.toThrow('Oproepbeveiliging kon niet worden voorbereid');

    expect(startOutgoingCall).not.toHaveBeenCalled();
  });

  test('forwards foreground socket offers to native Telecom', async () => {
    const presentIncomingCall = jest.fn().mockResolvedValue({ shown: true });
    registerPlugin.mockReturnValue({ presentIncomingCall });

    await presentNativeIncomingCall({
      from: 'peer-2',
      sessionId: 'call-2',
      callerName: 'Yousef',
      isVideo: false,
    });

    expect(presentIncomingCall).toHaveBeenCalledWith({
      sessionId: 'call-2',
      fromUid: 'peer-2',
      callerName: 'Yousef',
      isVideo: false,
    });
  });
});
