import { registerPlugin } from '@capacitor/core';
import {
  addNativeIncomingCallActionListener,
  classifyNativeIncomingCall,
  consumeNativeIncomingCall,
} from './nativeIncomingCall';

jest.mock('@capacitor/core', () => ({
  registerPlugin: jest.fn(),
}));

describe('native incoming call bridge', () => {
  beforeEach(() => {
    window.Capacitor = {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
    };
    registerPlugin.mockReset();
  });

  afterEach(() => {
    delete window.Capacitor;
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

  test('reuses the matching ringing call instead of rejecting it as busy', () => {
    expect(classifyNativeIncomingCall({ sessionId: 'call-1' }, 'call-1', true)).toBe('existing');
    expect(classifyNativeIncomingCall({ sessionId: 'call-2' }, 'call-1', true)).toBe('busy');
    expect(classifyNativeIncomingCall(null, 'call-1', false)).toBe('rehydrate');
  });
});
