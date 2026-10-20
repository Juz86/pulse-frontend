// src/utils.js — Gedeelde hulpfuncties

export function getInitials(name = '') {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function safeJsonParse(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export const DEFAULT_HISTORY_RETENTION_DAYS = 30;
export const HISTORY_RETENTION_OPTIONS = [
  { value: 30, label: '30 dagen (standaard)' },
  { value: 1, label: '24 uur' },
  { value: 7, label: '7 dagen' },
  { value: 0, label: 'Niet bewaren' },
];

export function normalizeHistoryRetentionDays(value) {
  const numeric = Number(value);
  return [0, 1, 7, 30].includes(numeric) ? numeric : DEFAULT_HISTORY_RETENTION_DAYS;
}

export function normalizeHistoryRules(rules = {}) {
  return {
    chatRetentionDays: normalizeHistoryRetentionDays(rules?.chatRetentionDays),
  };
}

export function getPulseHistoryRulesStorageKey(uid) {
  return `pulse_history_rules_${uid}`;
}

export function getPulseSessionConversationsStorageKey(uid) {
  return `pulse_session_conversations_${uid}`;
}

export function getPulseCachedConversationsStorageKey(uid) {
  return `pulse_cached_conversations_${uid}`;
}

export function getPulseCachedContactsStorageKey(uid) {
  return `pulse_cached_contacts_${uid}`;
}

export function getPulseCachedBlockedContactsStorageKey(uid) {
  return `pulse_cached_blocked_contacts_${uid}`;
}

export function getPulseCachedFriendRequestsStorageKey(uid) {
  return `pulse_cached_friend_requests_${uid}`;
}

export function getPulseCachedSentFriendRequestsStorageKey(uid) {
  return `pulse_cached_friend_requests_sent_${uid}`;
}

export function getPulseCachedMessagesStorageKey(uid, convId) {
  return `pulse_cached_messages_${uid}_${convId}`;
}

export function readStoredHistoryRules(uid) {
  return normalizeHistoryRules(safeJsonParse(localStorage.getItem(getPulseHistoryRulesStorageKey(uid)), {}));
}

export function writeStoredHistoryRules(uid, rules) {
  localStorage.setItem(getPulseHistoryRulesStorageKey(uid), JSON.stringify(normalizeHistoryRules(rules)));
}

export function readSessionConversations(uid) {
  if (typeof window === 'undefined' || !window.sessionStorage || !uid) return {};
  return safeJsonParse(sessionStorage.getItem(getPulseSessionConversationsStorageKey(uid)), {});
}

export function writeSessionConversations(uid, conversations) {
  if (typeof window === 'undefined' || !window.sessionStorage || !uid) return;
  const value = conversations && typeof conversations === 'object' ? conversations : {};
  sessionStorage.setItem(getPulseSessionConversationsStorageKey(uid), JSON.stringify(value));
}

export function readCachedConversations(uid) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return [];
  const value = safeJsonParse(localStorage.getItem(getPulseCachedConversationsStorageKey(uid)), []);
  return Array.isArray(value) ? value : [];
}

export function writeCachedConversations(uid, conversations) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return;
  const value = Array.isArray(conversations) ? conversations : [];
  localStorage.setItem(getPulseCachedConversationsStorageKey(uid), JSON.stringify(value));
}

export function readE2eeV2SafeCachedConversations(uid) {
  const safe = readCachedConversations(uid).map((conversation) => ({
    id: conversation.id,
    members: Array.isArray(conversation.members) ? conversation.members : [],
    memberNames: conversation.memberNames || {},
    memberEmails: conversation.memberEmails || {},
    isGroup: !!conversation.isGroup,
    groupName: conversation.groupName || null,
    e2eeState: conversation.e2eeState || null,
    lastMessage: conversation.lastMessage ? 'Versleuteld bericht' : '',
    lastMessageType: conversation.lastMessageType || null,
    lastCallEvent: conversation.lastCallEvent || null,
    updatedAt: conversation.updatedAt || conversation.lastMessageAt || null,
    lastMessageAt: conversation.lastMessageAt || conversation.updatedAt || null,
    lastReactionMessageId: conversation.lastReactionMessageId || null,
    lastReactionEmoji: conversation.lastReactionEmoji || null,
    lastReactionReactorId: conversation.lastReactionReactorId || null,
    lastReactionAt: conversation.lastReactionAt || null,
    lastReactionTargetText: null,
  }));
  writeCachedConversations(uid, safe);
  return safe;
}

export function readCachedContacts(uid) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return [];
  const value = safeJsonParse(localStorage.getItem(getPulseCachedContactsStorageKey(uid)), []);
  return Array.isArray(value) ? value : [];
}

export function writeCachedContacts(uid, contacts) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return;
  const value = Array.isArray(contacts) ? contacts : [];
  localStorage.setItem(getPulseCachedContactsStorageKey(uid), JSON.stringify(value));
}

export function readCachedBlockedContacts(uid) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return { contacts: [], parentBlockedUids: [] };
  const value = safeJsonParse(localStorage.getItem(getPulseCachedBlockedContactsStorageKey(uid)), {});
  return {
    contacts: Array.isArray(value?.contacts) ? value.contacts : [],
    parentBlockedUids: Array.isArray(value?.parentBlockedUids) ? value.parentBlockedUids : [],
  };
}

export function writeCachedBlockedContacts(uid, contacts, parentBlockedUids = []) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return;
  localStorage.setItem(
    getPulseCachedBlockedContactsStorageKey(uid),
    JSON.stringify({
      contacts: Array.isArray(contacts) ? contacts : [],
      parentBlockedUids: Array.isArray(parentBlockedUids) ? parentBlockedUids : [],
    }),
  );
}

export function readCachedFriendRequests(uid) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return [];
  const value = safeJsonParse(localStorage.getItem(getPulseCachedFriendRequestsStorageKey(uid)), []);
  return Array.isArray(value) ? value : [];
}

export function writeCachedFriendRequests(uid, friendRequests) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return;
  const value = Array.isArray(friendRequests) ? friendRequests : [];
  localStorage.setItem(getPulseCachedFriendRequestsStorageKey(uid), JSON.stringify(value));
}

export function readCachedSentFriendRequests(uid) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return [];
  const value = safeJsonParse(localStorage.getItem(getPulseCachedSentFriendRequestsStorageKey(uid)), []);
  return Array.isArray(value) ? value : [];
}

export function writeCachedSentFriendRequests(uid, sentFriendRequests) {
  if (typeof window === 'undefined' || !window.localStorage || !uid) return;
  const value = Array.isArray(sentFriendRequests) ? sentFriendRequests : [];
  localStorage.setItem(getPulseCachedSentFriendRequestsStorageKey(uid), JSON.stringify(value));
}

export function readCachedMessages(uid, convId) {
  if (typeof window === 'undefined' || !window.localStorage || !uid || !convId) return [];
  const value = safeJsonParse(localStorage.getItem(getPulseCachedMessagesStorageKey(uid, convId)), []);
  return Array.isArray(value) ? value : [];
}

export function writeCachedMessages(uid, convId, messages, limit = 120) {
  if (typeof window === 'undefined' || !window.localStorage || !uid || !convId) return;
  const normalized = Array.isArray(messages) ? messages : [];
  const value = normalized.slice(Math.max(0, normalized.length - limit));
  localStorage.setItem(getPulseCachedMessagesStorageKey(uid, convId), JSON.stringify(value));
}

export function clearE2eeV2PlaintextWebStorage(uid) {
  if (typeof window === 'undefined' || !uid) return;
  window.sessionStorage?.removeItem(getPulseSessionConversationsStorageKey(uid));
  window.localStorage?.removeItem(`pulse_pending_${uid}`);
  readE2eeV2SafeCachedConversations(uid);
  if (!window.localStorage) return;
  const prefixes = [
    `pulse_cached_messages_${uid}_`,
    `pulse_draft_${uid}_`,
  ];
  const matches = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (prefixes.some((prefix) => key?.startsWith(prefix))) matches.push(key);
  }
  matches.forEach((key) => window.localStorage.removeItem(key));
}

export function createSvgDataUrl(svg) {
  if (!svg) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function normalizeUsername(value = '') {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function normalizeEmail(value = '') {
  return value.trim().toLowerCase();
}

export function sanitizeDisplayName(value = '', maxLength = 80) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function getSafeInternalPath(path, fallback = '/') {
  if (typeof path !== 'string' || !path.startsWith('/')) return fallback;
  if (path.startsWith('//')) return fallback;
  return path;
}

export function getScrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export function scheduleIdleTask(callback, timeout = 1500) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(id);
}

export async function copyTextToClipboard(text) {
  const value = `${text ?? ''}`;

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('Kopieren mislukt');
    return true;
  } finally {
    document.body.removeChild(textarea);
  }
}

const USER_STORAGE_PREFIXES = [
  'pulse_history_rules_',
  'pulse_session_conversations_',
  'pulse_draft_',
  'pulse_labels_',
  'pulse_pending_',
  'pulse_pending_labels_',
  'pulse_photo_',
  'pulse_cached_conversations_',
  'pulse_cached_contacts_',
  'pulse_cached_blocked_contacts_',
  'pulse_cached_friend_requests_',
  'pulse_cached_friend_requests_sent_',
  'pulse_cached_messages_',
  'pulse_pinned_',
  'pulse_pinned_msgs_',
  'pulse_starred_',
  'pulse_calls_',
];

export function clearPulseUserStorage(uid) {
  if (typeof window === 'undefined' || !uid) return;

  const clearStorageKeys = (storageLike) => {
    if (!storageLike) return;
    const keysToRemove = [];
    for (let index = 0; index < storageLike.length; index += 1) {
      const key = storageLike.key(index);
      if (!key) continue;

      const isUserScoped = USER_STORAGE_PREFIXES.some((prefix) => key === `${prefix}${uid}` || key.startsWith(`${prefix}${uid}_`));
      const isNicknameCache = key.startsWith('pulse_nick_');

      if (isUserScoped || isNicknameCache) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => storageLike.removeItem(key));
  };

  clearStorageKeys(window.localStorage);
  clearStorageKeys(window.sessionStorage);
}

/** Converteert een Firestore Timestamp ({_seconds}) of ISO-string naar milliseconden */
export function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (v._seconds !== undefined) return v._seconds * 1000;
  if (v.seconds  !== undefined) return v.seconds  * 1000;
  const ms = new Date(v).getTime();
  return isNaN(ms) ? 0 : ms;
}

/** Chat: Firestore Timestamp of ISO-string → Date object */
export function parseDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  const ms = toMs(val);
  if (!ms) return null;
  const d = new Date(ms);
  return isNaN(d) ? null : d;
}

/** Chat: datum → 'HH:MM' string */
export function formatTime(val) {
  const d = parseDate(val);
  if (!d) return '';
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

/** Chat: datum → 'Vandaag' / 'Gisteren' / '12 januari 2025' */
export function formatDateLabel(val) {
  const d = parseDate(val);
  if (!d) return '';
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const msgDay    = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDay.getTime() === today.getTime())     return 'Vandaag';
  if (msgDay.getTime() === yesterday.getTime()) return 'Gisteren';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Chatlijst: compacte WhatsApp-achtige tijdweergave, binnen Pulse-copy. */
export function formatConversationListTime(val) {
  const d = parseDate(val);
  if (!d) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDay.getTime() === today.getTime()) return formatTime(d);
  if (msgDay.getTime() === yesterday.getTime()) return 'Gisteren';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/** Relatieve tijdweergave vanuit een Firestore Timestamp */
export function timeAgo(ts, fallback = '') {
  if (!ts) return fallback;
  const secs = ts._seconds || ts.seconds;
  if (!secs) return fallback;
  const diff = Date.now() / 1000 - secs;
  if (diff < 60)    return 'Zojuist';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min geleden`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
  return `${Math.floor(diff / 86400)} dagen geleden`;
}
