// src/utils.js — Gedeelde hulpfuncties

export function getInitials(name = '') {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

/** Converteert een Firestore Timestamp ({_seconds}) of ISO-string naar milliseconden */
export function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (v._seconds !== undefined) return v._seconds * 1000;
  if (v.seconds  !== undefined) return v.seconds  * 1000;
  const ms = new Date(v).getTime();
  return isNaN(ms) ? 0 : ms;
}

/** Chat: Firestore Timestamp of ISO-string → Date object */
export function parseDate(val) {
  if (!val) return null;
  if (val._seconds) return new Date(val._seconds * 1000);
  const d = new Date(val);
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

/** Chat: preview-tekst voor oproepen in de gesprekkenlijst */
export function callPreview(conv, currentUid) {
  const { lastCallSenderId, lastCallDirection, lastCallIsVideo } = conv;
  if (!lastCallDirection) return conv.lastMessage || '';
  const isOwn = lastCallSenderId === currentUid;
  const iv = lastCallIsVideo;
  if (lastCallDirection === 'completed') return iv ? 'Video-oproep' : 'Spraakoproep';
  if (lastCallDirection === 'declined')  return isOwn ? 'Geweigerd' : (iv ? 'Gemiste video-oproep' : 'Gemiste spraakoproep');
  return isOwn ? 'Spraakoproep' : (iv ? 'Gemiste video-oproep' : 'Gemiste spraakoproep');
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
