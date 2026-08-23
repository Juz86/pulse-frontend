import {
  isRealtimePopupRelevant,
  normalizeSyncRequiredPayload,
  normalizeSyncRequiredDomains,
  REALTIME_EVENT_DOMAINS,
} from './useRealtimeSync';

describe('realtime sync event policy', () => {
  test('maps each emitted server domain event to an API list', () => {
    expect(REALTIME_EVENT_DOMAINS['message:received']).toEqual(['conversations']);
    expect(REALTIME_EVENT_DOMAINS['friend:accepted']).toEqual(['contacts', 'friendRequests']);
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
});
