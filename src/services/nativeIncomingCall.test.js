import { registerPlugin } from '@capacitor/core';
import {
  addNativeIncomingCallActionListener,
  classifyNativeIncomingCall,
  clearNativeIncomingCallAuth,
  consumeNativeIncomingCall,
  provisionNativeIncomingCallAuth,
} from './nativeIncomingCall';

jest.mock('@capacitor/core', () => ({
  registerPlugin: jest.fn(),
}));

describe('native incoming call bridge', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.Capacitor = {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
    };
    registerPlugin.mockReset();
  });

  afterEach(() => {
    delete window.Capacitor;
    global.fetch = originalFetch;
  });

  test('subscribes to pending Android call actions', async () => {
    const listener = jest.fn();
    const handle = { remove: jest.fn() };
    const addListener = jest.fn().mockResolvedValue(handle);
    registerPlugin.mockReturnValue({ addListener });

    await expect(addNativeIncomingCallActionListener(listener)).resolves.toBe(handle);
    expect(addListener).toHaveBeenCalledWith('pendingCallChanged', listener);
  });

  test('returns the pending answer action for a resumed WebView', async () => {
    const pendingCall = {
      sessionId: 'call-1',
      fromUid: 'caller-1',
      action: 'answer',
    };
    const consumePendingCall = jest.fn().mockResolvedValue(pendingCall);
    registerPlugin.mockReturnValue({ consumePendingCall });

    await expect(consumeNativeIncomingCall()).resolves.toEqual(pendingCall);
  });

  test('provisions persistent native Firebase auth through the backend', async () => {
    const provisionCallAuth = jest.fn().mockResolvedValue({ ok: true, uid: 'callee-1' });
    registerPlugin.mockReturnValue({ provisionCallAuth });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ customToken: 'native-custom-token' }),
    });

    await expect(provisionNativeIncomingCallAuth('https://api.example.test', 'web-id-token'))
      .resolves.toEqual({ ok: true, uid: 'callee-1' });
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.test/api/native-call-auth', {
      method: 'POST',
      headers: { Authorization: 'Bearer web-id-token' },
    });
    expect(provisionCallAuth).toHaveBeenCalledWith({ customToken: 'native-custom-token' });
  });

  test('deduplicates simultaneous native auth provisioning', async () => {
    let resolveProvision;
    const provisionCallAuth = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolveProvision = resolve;
    }));
    registerPlugin.mockReturnValue({ provisionCallAuth });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ customToken: 'shared-native-token' }),
    });

    const first = provisionNativeIncomingCallAuth('https://api.example.test', 'shared-web-token');
    const second = provisionNativeIncomingCallAuth('https://api.example.test', 'shared-web-token');
    resolveProvision({ ok: true, uid: 'callee-1' });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, uid: 'callee-1' },
      { ok: true, uid: 'callee-1' },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(provisionCallAuth).toHaveBeenCalledTimes(1);
  });

  test('clears the native Firebase session on logout', async () => {
    const clearCallAuth = jest.fn().mockResolvedValue(undefined);
    registerPlugin.mockReturnValue({ clearCallAuth });

    await clearNativeIncomingCallAuth();

    expect(clearCallAuth).toHaveBeenCalledTimes(1);
  });

  test('reuses the matching ringing call instead of rejecting it as busy', () => {
    expect(classifyNativeIncomingCall({ sessionId: 'call-1' }, 'call-1', true)).toBe('existing');
    expect(classifyNativeIncomingCall({ sessionId: 'call-2' }, 'call-1', true)).toBe('busy');
    expect(classifyNativeIncomingCall(null, 'call-1', false)).toBe('rehydrate');
  });
});
