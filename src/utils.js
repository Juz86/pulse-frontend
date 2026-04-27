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
    callRetentionDays: normalizeHistoryRetentionDays(rules?.callRetentionDays),
    videoRetentionDays: normalizeHistoryRetentionDays(rules?.videoRetentionDays),
  };
}

export function getPulseHistoryRulesStorageKey(uid) {
  return `pulse_history_rules_${uid}`;
}

export function getPulseSessionConversationsStorageKey(uid) {
  return `pulse_session_conversations_${uid}`;
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
  'pulse_pinned_',
  'pulse_pinned_msgs_',
  'pulse_starred_',
];

export function clearPulseUserStorage(uid, options = {}) {
  if (typeof window === 'undefined' || !uid) return;
  const { includeCallLog = false } = options;

  const clearStorageKeys = (storageLike) => {
    if (!storageLike) return;
    const keysToRemove = [];
    for (let index = 0; index < storageLike.length; index += 1) {
      const key = storageLike.key(index);
      if (!key) continue;

      const isUserScoped = USER_STORAGE_PREFIXES.some((prefix) => key === `${prefix}${uid}` || key.startsWith(`${prefix}${uid}_`));
      const isCallLogKey = includeCallLog && (key === `pulse_calls_${uid}` || key.startsWith(`pulse_calls_${uid}_`));
      const isNicknameCache = key.startsWith('pulse_nick_');

      if (isUserScoped || isCallLogKey || isNicknameCache) {
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

/** Chat: preview-tekst voor oproepen in de gesprekkenlijst */
export function callPreview(conv, currentUid) {
  const { lastCallSenderId, lastCallDirection, lastCallIsVideo } = conv;
  if (!lastCallDirection) return conv.lastMessage || '';
  const isOwn = lastCallSenderId === currentUid;
  const iv = lastCallIsVideo;
  if (lastCallDirection === 'completed') return iv ? 'Video-oproep' : 'Spraakoproep';
  if (lastCallDirection === 'declined')  return isOwn ? 'Geweigerd' : (iv ? 'Gemiste video-oproep' : 'Gemiste oproep');
  return isOwn ? 'Spraakoproep' : (iv ? 'Gemiste video-oproep' : 'Gemiste oproep');
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
