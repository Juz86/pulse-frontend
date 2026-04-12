import {
  clearPulseUserStorage,
  DEFAULT_HISTORY_RETENTION_DAYS,
  getSafeInternalPath,
  normalizeHistoryRules,
  normalizeEmail,
  normalizeUsername,
  readStoredHistoryRules,
  safeJsonParse,
  sanitizeDisplayName,
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

  test('clearPulseUserStorage removes user-scoped privacy keys', () => {
    localStorage.setItem('pulse_calls_user-1', '[]');
    localStorage.setItem('pulse_history_rules_user-1', '{}');
    localStorage.setItem('pulse_draft_user-1_conv-1', 'concept');
    localStorage.setItem('pulse_starred_user-1', '[]');
    localStorage.setItem('pulse_nick_friend-1', 'Beste vriend');
    localStorage.setItem('pulse_theme', 'light');

    clearPulseUserStorage('user-1');

    expect(localStorage.getItem('pulse_calls_user-1')).toBeNull();
    expect(localStorage.getItem('pulse_history_rules_user-1')).toBeNull();
    expect(localStorage.getItem('pulse_draft_user-1_conv-1')).toBeNull();
    expect(localStorage.getItem('pulse_starred_user-1')).toBeNull();
    expect(localStorage.getItem('pulse_nick_friend-1')).toBeNull();
    expect(localStorage.getItem('pulse_theme')).toBe('light');
  });

  test('normalizeHistoryRules keeps defaults when values are absent', () => {
    expect(normalizeHistoryRules({})).toEqual({
      chatRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
      callRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
      videoRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
    });
  });

  test('stored history rules roundtrip safely', () => {
    writeStoredHistoryRules('user-1', { chatRetentionDays: 7, callRetentionDays: 0, videoRetentionDays: 1 });
    expect(readStoredHistoryRules('user-1')).toEqual({
      chatRetentionDays: 7,
      callRetentionDays: 0,
      videoRetentionDays: 1,
    });
  });
});
