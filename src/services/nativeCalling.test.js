import { registerPlugin } from '@capacitor/core';
import {
  isAndroidNativeCalling,
  NATIVE_CALL_ENGINES,
  presentNativeIncomingCall,
  selectNativeCallEngine,
  startNativeOutgoingCall,
} from './nativeCalling';

jest.mock('@capacitor/core', () => ({ registerPlugin: jest.fn() }));

describe('Android native calling bridge', () => {
  beforeEach(() => {
    registerPlugin.mockReset();
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };
  });

  afterEach(() => {
    delete window.Capacitor;
  });

  test('selects native calling only for Android native builds', () => {
    expect(isAndroidNativeCalling()).toBe(true);
    window.Capacitor.getPlatform = () => 'web';
    expect(isAndroidNativeCalling()).toBe(false);
  });

  test('selects RealtimeKit only when its feature flag is enabled', () => {
    expect(selectNativeCallEngine(false)).toBe(NATIVE_CALL_ENGINES.LEGACY);
    expect(selectNativeCallEngine(undefined)).toBe(NATIVE_CALL_ENGINES.LEGACY);
    expect(selectNativeCallEngine(true)).toBe(NATIVE_CALL_ENGINES.REALTIMEKIT);
  });

  test('starts outgoing video without browser getUserMedia', async () => {
    const startOutgoingCall = jest.fn().mockResolvedValue({ sessionId: 'call-1', native: true });
    registerPlugin.mockReturnValue({ startOutgoingCall });

    await startNativeOutgoingCall({
      toUid: 'peer-1',
      convId: null,
      contactName: 'Yousef',
      callerName: 'Habibi',
      isVideo: true,
      backendUrl: 'https://api.example.test',
      idToken: 'web-id-token-outgoing',
    });

    expect(startOutgoingCall).toHaveBeenCalledWith({
      toUid: 'peer-1',
      convId: null,
      contactName: 'Yousef',
      callerName: 'Habibi',
      isVideo: true,
      idToken: 'web-id-token-outgoing',
      callEngine: 'webrtc-v1',
    });
  });

  test('rejects a native call without an authenticated web session', async () => {
    const startOutgoingCall = jest.fn();
    registerPlugin.mockReturnValue({ startOutgoingCall });

    await expect(startNativeOutgoingCall({
      toUid: 'peer-1',
      contactName: 'Yousef',
      callerName: 'Habibi',
      isVideo: false,
      backendUrl: 'https://api.example.test',
      idToken: '',
    })).rejects.toThrow('Pulse-sessie is verlopen');

    expect(startOutgoingCall).not.toHaveBeenCalled();
  });

  test('routes an outgoing native call through RealtimeKit v2 when selected', async () => {
    const startOutgoingCall = jest.fn().mockResolvedValue({ sessionId: 'call-v2', native: true });
    registerPlugin.mockReturnValue({ startOutgoingCall });

    await startNativeOutgoingCall({
      toUid: 'peer-v2',
      contactName: 'Habiba',
      callerName: 'Yousef',
      isVideo: false,
      idToken: 'web-id-token-v2',
      callEngine: NATIVE_CALL_ENGINES.REALTIMEKIT,
    });

    expect(startOutgoingCall).toHaveBeenCalledWith(expect.objectContaining({
      toUid: 'peer-v2',
      callEngine: 'realtimekit-v2',
    }));
  });

  test('falls back to the legacy engine for unknown native engine values', async () => {
    const startOutgoingCall = jest.fn().mockResolvedValue({ sessionId: 'call-safe', native: true });
    registerPlugin.mockReturnValue({ startOutgoingCall });

    await startNativeOutgoingCall({
      toUid: 'peer-safe',
      contactName: 'Habiba',
      callerName: 'Yousef',
      isVideo: true,
      idToken: 'web-id-token-safe',
      callEngine: 'unknown-engine',
    });

    expect(startOutgoingCall).toHaveBeenCalledWith(expect.objectContaining({
      callEngine: 'webrtc-v1',
    }));
  });

  test('forwards foreground socket offers to native Telecom', async () => {
    const presentIncomingCall = jest.fn().mockResolvedValue({ shown: true });
    registerPlugin.mockReturnValue({ presentIncomingCall });

    await presentNativeIncomingCall({
      from: 'peer-2',
      sessionId: 'call-2',
      callerName: 'Yousef',
      isVideo: false,
      callEngine: 'webrtc-v1',
    });

    expect(presentIncomingCall).toHaveBeenCalledWith({
      sessionId: 'call-2',
      fromUid: 'peer-2',
      callerName: 'Yousef',
      isVideo: false,
      callEngine: 'webrtc-v1',
    });
  });

  test('preserves RealtimeKit engine metadata for incoming native calls', async () => {
    const presentIncomingCall = jest.fn().mockResolvedValue({ shown: true });
    registerPlugin.mockReturnValue({ presentIncomingCall });

    await presentNativeIncomingCall({
      fromUid: 'peer-3',
      sessionId: 'call-3',
      callerName: 'Habiba',
      isVideo: true,
      callEngine: 'realtimekit-v2',
    });

    expect(presentIncomingCall).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'call-3',
      callEngine: 'realtimekit-v2',
    }));
  });
});
