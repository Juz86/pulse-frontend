import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  default as useRealtimeSync,
  isRealtimePopupRelevant,
  normalizeSyncRequiredPayload,
  normalizeSyncRequiredDomains,
  REALTIME_EVENT_DOMAINS,
  REALTIME_RESUME_DOMAINS,
  shouldRefreshRealtimeOnVisibility,
} from './useRealtimeSync';

function RealtimeSyncHarness(props) {
  useRealtimeSync(props);
  return null;
}

function createSocket({ connected = false } = {}) {
  const handlers = new Map();
  return {
    connected,
    on: jest.fn((eventName, handler) => {
      const current = handlers.get(eventName) || [];
      handlers.set(eventName, [...current, handler]);
    }),
    off: jest.fn((eventName, handler) => {
      handlers.set(eventName, (handlers.get(eventName) || []).filter((entry) => entry !== handler));
    }),
    dispatch(eventName, payload) {
      (handlers.get(eventName) || []).forEach((handler) => handler(payload));
    },
  };
}

function createHookProps(overrides = {}) {
  return {
    user: { uid: 'user-1' },
    socket: null,
    loadConversations: jest.fn().mockResolvedValue(undefined),
    loadContacts: jest.fn().mockResolvedValue(undefined),
    loadFriendRequests: jest.fn().mockResolvedValue(undefined),
    loadBlockedContacts: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('realtime sync event policy', () => {
  test('maps each emitted server domain event to an API list', () => {
    expect(REALTIME_EVENT_DOMAINS['message:received']).toEqual(['conversations']);
    expect(REALTIME_EVENT_DOMAINS['call-history:updated']).toEqual(['conversations']);
    expect(REALTIME_EVENT_DOMAINS['friend:accepted']).toEqual(['contacts', 'friendRequests']);
    expect(REALTIME_EVENT_DOMAINS['friend:declined']).toEqual(['friendRequests']);
    expect(REALTIME_EVENT_DOMAINS['friend:request:reminder']).toEqual(['friendRequests']);
    expect(REALTIME_EVENT_DOMAINS['contacts:updated']).toEqual([
      'contacts', 'blockedContacts', 'conversations',
    ]);
    expect(REALTIME_EVENT_DOMAINS['contact-requests:updated']).toEqual(['friendRequests']);
    expect(REALTIME_EVENT_DOMAINS['contact:blocked-by-parent']).toEqual([
      'contacts', 'blockedContacts', 'conversations',
    ]);
    expect(REALTIME_EVENT_DOMAINS['contact:policy_updated']).toEqual([
      'contacts', 'blockedContacts', 'conversations',
    ]);
  });

  test('only surfaces direct actions as pop-ups', () => {
    expect(isRealtimePopupRelevant('friend:request', {}, 'child-1')).toBe(true);
    expect(isRealtimePopupRelevant('conversation:admins_updated', { promotedUid: 'child-1' }, 'child-1')).toBe(true);
    expect(isRealtimePopupRelevant('conversation:admins_updated', { promotedUid: 'another-child' }, 'child-1')).toBe(false);
    expect(isRealtimePopupRelevant('conversation:renamed', {}, 'child-1')).toBe(false);
    expect(isRealtimePopupRelevant('message:edited', {}, 'child-1')).toBe(false);
  });

  test('accepts only known domains from the server sync fallback', () => {
    expect(normalizeSyncRequiredDomains(['contacts', 'unknown', 'contacts'])).toEqual(['contacts']);
    expect(normalizeSyncRequiredDomains([])).toEqual([
      'conversations', 'contacts', 'friendRequests', 'blockedContacts',
    ]);
  });

  test('uses a safe full sync for a newer server protocol', () => {
    expect(normalizeSyncRequiredPayload({ protocolVersion: 2, domains: ['contacts'] })).toEqual({
      protocolVersion: 2,
      requiresFullSync: true,
      domains: ['conversations', 'contacts', 'friendRequests', 'blockedContacts'],
    });
    expect(normalizeSyncRequiredPayload({})).toMatchObject({
      protocolVersion: 1,
      requiresFullSync: false,
    });
  });

  test('refreshes conversations when the app becomes visible again', () => {
    expect(REALTIME_RESUME_DOMAINS).toEqual(['conversations']);
    expect(shouldRefreshRealtimeOnVisibility('visible')).toBe(true);
    expect(shouldRefreshRealtimeOnVisibility('hidden')).toBe(false);
  });
});

describe('realtime sync lifecycle', () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
    jest.restoreAllMocks();
  });

  test('attaches realtime listeners when the socket becomes available after mount', async () => {
    const props = createHookProps();
    const socket = createSocket({ connected: true });
    jest.spyOn(console, 'info').mockImplementation(() => {});

    act(() => root.render(<RealtimeSyncHarness {...props} />));
    expect(props.loadConversations).not.toHaveBeenCalled();

    await act(async () => {
      root.render(<RealtimeSyncHarness {...props} socket={socket} />);
      await Promise.resolve();
    });

    expect(socket.on).toHaveBeenCalledWith('message:received', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('call-history:updated', expect.any(Function));
    expect(props.loadConversations).toHaveBeenCalledWith({ force: true });
  });

  test('refreshes conversations on resume even before a socket exists', async () => {
    const props = createHookProps();
    jest.spyOn(console, 'info').mockImplementation(() => {});

    act(() => root.render(<RealtimeSyncHarness {...props} />));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(props.loadConversations).toHaveBeenCalledWith({ force: true });
  });
});
