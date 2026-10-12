import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
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
  'call-history:updated': ['conversations'],

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
  'friend:declined': ['friendRequests'],
  'friend:request:reminder': ['friendRequests'],
  'friend:accepted': ['contacts', 'friendRequests'],
  // Native contact routes emit aggregate invalidations instead of the older
  // per-action socket events. Keep all contact-derived UI lists current.
  'contacts:updated': ['contacts', 'blockedContacts', 'conversations'],
  'contact-requests:updated': ['friendRequests'],
  'user:updated': ['contacts', 'conversations'],

  'contact:blocked-by-parent': ['contacts', 'blockedContacts', 'conversations'],
  'contact:unblocked-by-parent': ['contacts', 'blockedContacts', 'conversations'],
  'contact:removed-by-parent': ['contacts', 'blockedContacts', 'conversations'],
  'contact:policy_updated': ['contacts', 'blockedContacts', 'conversations'],

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
export const REALTIME_SYNC_PROTOCOL_VERSION = 1;
export const SYNCABLE_REALTIME_DOMAINS = Object.freeze([
  'conversations',
  'contacts',
  'friendRequests',
  'blockedContacts',
]);

export function normalizeSyncRequiredDomains(domains) {
  if (!Array.isArray(domains)) return [...SYNCABLE_REALTIME_DOMAINS];
  const accepted = domains.filter((domain) => SYNCABLE_REALTIME_DOMAINS.includes(domain));
  return accepted.length > 0 ? [...new Set(accepted)] : [...SYNCABLE_REALTIME_DOMAINS];
}

export function normalizeSyncRequiredPayload(payload = {}) {
  const protocolVersion = Number(payload?.protocolVersion || REALTIME_SYNC_PROTOCOL_VERSION);
  const requiresFullSync = protocolVersion > REALTIME_SYNC_PROTOCOL_VERSION;
  return {
    protocolVersion,
    // A newer server may introduce domains this client does not understand.
    // Full reconciliation is safer than relying on a partial event stream.
    requiresFullSync,
    domains: requiresFullSync
      ? [...SYNCABLE_REALTIME_DOMAINS]
      : normalizeSyncRequiredDomains(payload?.domains),
  };
}

function recordSyncSuccess({ domain, reason, durationMs }) {
  const details = { domain, reason, durationMs: Math.round(durationMs) };
  console.info('[Pulse][RealtimeSync] refreshed', details);
  Sentry.addBreadcrumb({
    category: 'realtime.sync',
    level: 'info',
    message: 'domain_refreshed',
    data: details,
  });
}

function recordSyncFailure({ domain, reason, durationMs, error }) {
  const details = { domain, reason, durationMs: Math.round(durationMs) };
  console.warn('[Pulse][RealtimeSync] refresh failed', details, error);
  Sentry.captureException(error, {
    tags: { subsystem: 'realtime_sync', domain },
    extra: details,
  });
}

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

    const refresh = (domains, { immediately = false, reason = 'domain_event' } = {}) => {
      domains.forEach((domain) => {
        const existingTimer = timers.get(domain);
        if (existingTimer) clearTimeout(existingTimer);

        const run = async () => {
          timers.delete(domain);
          const startedAt = performance.now();
          try {
            // A forced refresh ignores normal UI throttling. Its outcome is
            // observable without storing user or message data in telemetry.
            await loadersRef.current[domain]?.({ force: true });
            recordSyncSuccess({ domain, reason, durationMs: performance.now() - startedAt });
          } catch (error) {
            recordSyncFailure({ domain, reason, durationMs: performance.now() - startedAt, error });
          }
        };
        if (immediately) run();
        else timers.set(domain, setTimeout(run, RELOAD_DEBOUNCE_MS));
      });
    };

    const handlers = Object.entries(REALTIME_EVENT_DOMAINS).map(([eventName, domains]) => {
      const handler = () => refresh(domains, { reason: eventName });
      socket.on(eventName, handler);
      return [eventName, handler];
    });

    const onSyncRequired = (payload = {}) => {
      const syncRequest = normalizeSyncRequiredPayload(payload);
      if (syncRequest.requiresFullSync) {
        console.warn('[Pulse][RealtimeSync] newer sync protocol received', {
          receivedVersion: syncRequest.protocolVersion,
          supportedVersion: REALTIME_SYNC_PROTOCOL_VERSION,
        });
        Sentry.addBreadcrumb({
          category: 'realtime.sync',
          level: 'warning',
          message: 'newer_sync_protocol_received',
          data: {
            receivedVersion: syncRequest.protocolVersion,
            supportedVersion: REALTIME_SYNC_PROTOCOL_VERSION,
          },
        });
      }
      refresh(syncRequest.domains, { reason: 'server:sync_required' });
    };
    socket.on('sync:required', onSyncRequired);

    // A reconnect is an invalidation boundary: events that occurred while the
    // device was offline may not have been replayed by Socket.IO.
    const onConnect = () => refresh(
      SYNCABLE_REALTIME_DOMAINS,
      { immediately: true, reason: 'socket:connect' }
    );
    socket.on('connect', onConnect);

    return () => {
      handlers.forEach(([eventName, handler]) => socket.off(eventName, handler));
      socket.off('sync:required', onSyncRequired);
      socket.off('connect', onConnect);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [user?.uid]);
}
