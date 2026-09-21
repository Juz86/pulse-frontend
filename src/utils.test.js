import {
  clearPulseUserStorage,
  DEFAULT_HISTORY_RETENTION_DAYS,
  formatConversationListTime,
  getSafeInternalPath,
  normalizeHistoryRules,
  normalizeEmail,
  normalizeUsername,
  parseDate,
  readSessionConversations,
  readStoredHistoryRules,
  safeJsonParse,
  sanitizeDisplayName,
  toMs,
  writeSessionConversations,
  writeStoredHistoryRules,
} from './utils';

describe('utils safety helpers', () => {
  test('safeJsonParse returns parsed data when JSON is valid', () => {
    expect(safeJsonParse('{"ok":true}', null)).toEqual({ ok: true });
  });

  test('safeJsonParse returns fallback when JSON is invalid', () => {
    expect(safeJsonParse('{broken', { ok: false })).toEqual({ ok: false });
  });

  test('normalizeUsername strips unsupported characters', () => {
    expect(normalizeUsername('  MiJn-Naam!_2026 ')).toBe('mijnnaam_2026');
  });

  test('normalizeEmail lowercases and trims', () => {
    expect(normalizeEmail('  OUDER@Voorbeeld.NL ')).toBe('ouder@voorbeeld.nl');
  });

  test('sanitizeDisplayName collapses whitespace and trims', () => {
    expect(sanitizeDisplayName('  Jan    de   Vries  ')).toBe('Jan de Vries');
  });

  test('getSafeInternalPath keeps safe relative paths', () => {
    expect(getSafeInternalPath('/ouderlijk-toezicht')).toBe('/ouderlijk-toezicht');
  });

  test('getSafeInternalPath rejects protocol-relative values', () => {
    expect(getSafeInternalPath('//evil.example')).toBe('/');
  });

  test('getSafeInternalPath rejects non-path values', () => {
    expect(getSafeInternalPath('https://evil.example')).toBe('/');
  });

  test('clearPulseUserStorage removes all user-scoped privacy keys', () => {
    localStorage.setItem('pulse_calls_user-1', '[]');
    localStorage.setItem('pulse_history_rules_user-1', '{}');
    localStorage.setItem('pulse_draft_user-1_conv-1', 'concept');
    localStorage.setItem('pulse_starred_user-1', '[]');
    localStorage.setItem('pulse_nick_friend-1', 'Beste vriend');
    localStorage.setItem('pulse_e2ee_identity_user-1', '{"deviceId":"device-1"}');
    localStorage.setItem('pulse_e2ee_session_user-1_friend-1_device-1', '{"sessionData":"abc"}');
    localStorage.setItem('pulse_theme', 'light');
    sessionStorage.setItem('pulse_session_conversations_user-1', '{"conv-1":[]}');

    clearPulseUserStorage('user-1');

    expect(localStorage.getItem('pulse_calls_user-1')).toBeNull();
    expect(localStorage.getItem('pulse_history_rules_user-1')).toBeNull();
    expect(localStorage.getItem('pulse_draft_user-1_conv-1')).toBeNull();
    expect(localStorage.getItem('pulse_starred_user-1')).toBeNull();
    expect(localStorage.getItem('pulse_nick_friend-1')).toBeNull();
    expect(localStorage.getItem('pulse_e2ee_identity_user-1')).toBe('{"deviceId":"device-1"}');
    expect(localStorage.getItem('pulse_e2ee_session_user-1_friend-1_device-1')).toBe('{"sessionData":"abc"}');
    expect(localStorage.getItem('pulse_theme')).toBe('light');
    expect(sessionStorage.getItem('pulse_session_conversations_user-1')).toBeNull();
  });

  test('normalizeHistoryRules keeps defaults when values are absent', () => {
    expect(normalizeHistoryRules({})).toEqual({
      chatRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
    });
  });

  test('stored history rules roundtrip safely', () => {
    writeStoredHistoryRules('user-1', { chatRetentionDays: 7 });
    expect(readStoredHistoryRules('user-1')).toEqual({
      chatRetentionDays: 7,
    });
  });

  test('session conversation storage roundtrip safely', () => {
    writeSessionConversations('user-1', { 'conv-1': [{ id: 'transient-1', text: 'Hallo' }] });
    expect(readSessionConversations('user-1')).toEqual({
      'conv-1': [{ id: 'transient-1', text: 'Hallo' }],
    });
  });

  test('parseDate and toMs support Firestore-like timestamp shapes', () => {
    expect(toMs({ seconds: 10 })).toBe(10000);
    expect(toMs({ _seconds: 12 })).toBe(12000);
    expect(parseDate({ toDate: () => new Date('2026-04-24T09:02:00.000Z') }).toISOString()).toBe('2026-04-24T09:02:00.000Z');
  });

  test('formatConversationListTime keeps chat list timestamps compact', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 3, 24, 12, 0, 0));

    expect(formatConversationListTime(new Date(2026, 3, 24, 9, 2, 0))).toBe('09:02');
    expect(formatConversationListTime(new Date(2026, 3, 23, 22, 10, 0))).toBe('Gisteren');
    expect(formatConversationListTime(new Date(2026, 3, 20, 22, 10, 0))).toBe('20 apr');

    jest.useRealTimers();
  });
});
