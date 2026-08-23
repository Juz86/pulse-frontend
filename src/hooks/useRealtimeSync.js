import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';

// One authoritative mapping from a domain event to the cached API collections
// it invalidates.  UI-specific handlers may still apply an optimistic update,
// but this makes the server the source of truth shortly afterwards.
export const REALTIME_EVENT_DOMAINS = Object.freeze({
  'message:new': ['conversations'],
  'message:received': ['conversations'],
  'message:edited': ['conversations'],
  'message:deleted': ['conversations'],
  'message:reaction': ['conversations'],
  'message:status': ['conversations'],

  'conversation:created': ['conversations'],
  'conversation:member_added': ['conversations'],
  'conversation:member_removed': ['conversations'],
  'conversation:renamed': ['conversations'],
  'conversation:admins_updated': ['conversations'],
  'conversation:admin_promotion_requested': ['conversations'],
  'conversation:hardCleared': ['conversations'],
  'conversation:dissolved': ['conversations'],

  'friend:request': ['friendRequests'],
  'friend:request:cancelled': ['friendRequests'],
  'friend:accepted': ['contacts', 'friendRequests'],
  'user:updated': ['contacts', 'conversations'],

  'contact:blocked-by-parent': ['contacts', 'blockedContacts', 'conversations'],
  'contact:unblocked-by-parent': ['contacts', 'blockedContacts', 'conversations'],
  'contact:removed-by-parent': ['contacts', 'blockedContacts', 'conversations'],

  'account:paused': ['conversations', 'contacts'],
  'account:resumed': ['conversations', 'contacts'],
});

// Pop-ups are deliberately limited to events that require an immediate user
// decision or announce a direct social action.  State-only events should update
// silently; showing a toast for every socket replay is especially noisy after
// reconnecting.
export function isRealtimePopupRelevant(eventName, payload = {}, userId = null) {
  if (eventName === 'friend:request' || eventName === 'friend:accepted') return true;
  if (eventName === 'conversation:admin_promotion_requested') {
    return !userId || payload?.request?.targetUid === userId;
  }
  if (eventName === 'conversation:admins_updated') {
    return !!userId && payload?.promotedUid === userId;
  }
  return false;
}

const RELOAD_DEBOUNCE_MS = 80;

/**
 * Keeps API-backed lists in sync with every known domain event.  It is kept
 * separate from useChat so event-specific UI behaviour does not decide which
 * cached data is eventually authoritative.
 */
export default function useRealtimeSync({
  user,
  loadConversations,
  loadContacts,
  loadFriendRequests,
  loadBlockedContacts,
}) {
  const loadersRef = useRef({
    conversations: loadConversations,
    contacts: loadContacts,
    friendRequests: loadFriendRequests,
    blockedContacts: loadBlockedContacts,
  });

  useEffect(() => {
    loadersRef.current = {
      conversations: loadConversations,
      contacts: loadContacts,
      friendRequests: loadFriendRequests,
      blockedContacts: loadBlockedContacts,
    };
  }, [loadBlockedContacts, loadContacts, loadConversations, loadFriendRequests]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user?.uid) return undefined;
    const timers = new Map();

    const refresh = (domains, immediately = false) => {
      domains.forEach((domain) => {
        const existingTimer = timers.get(domain);
        if (existingTimer) clearTimeout(existingTimer);

        const run = () => {
          timers.delete(domain);
          // A failed refresh is handled by the existing loaders; a socket
          // event must never produce an unhandled promise rejection.
          loadersRef.current[domain]?.({ force: true })?.catch?.(() => {});
        };
        if (immediately) run();
        else timers.set(domain, setTimeout(run, RELOAD_DEBOUNCE_MS));
      });
    };

    const handlers = Object.entries(REALTIME_EVENT_DOMAINS).map(([eventName, domains]) => {
      const handler = () => refresh(domains);
      socket.on(eventName, handler);
      return [eventName, handler];
    });

    // A reconnect is an invalidation boundary: events that occurred while the
    // device was offline may not have been replayed by Socket.IO.
    const onConnect = () => refresh(['conversations', 'contacts', 'friendRequests', 'blockedContacts'], true);
    socket.on('connect', onConnect);

    return () => {
      handlers.forEach(([eventName, handler]) => socket.off(eventName, handler));
      socket.off('connect', onConnect);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [user?.uid]);
}
