import { isRealtimePopupRelevant, REALTIME_EVENT_DOMAINS } from './useRealtimeSync';

describe('realtime sync event policy', () => {
  test('maps each emitted server domain event to an API list', () => {
    expect(REALTIME_EVENT_DOMAINS['message:received']).toEqual(['conversations']);
    expect(REALTIME_EVENT_DOMAINS['friend:accepted']).toEqual(['contacts', 'friendRequests']);
    expect(REALTIME_EVENT_DOMAINS['contact:blocked-by-parent']).toEqual([
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
});
