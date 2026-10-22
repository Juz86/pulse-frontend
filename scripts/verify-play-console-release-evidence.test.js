const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeFingerprint,
  parseCsv,
  readAabFingerprint,
} = require('./verify-play-console-release-evidence');

test('parseCsv preserves quoted commas, newlines and escaped quotes', () => {
  const rows = parseCsv([
    'question,response,value,label',
    'Q1,R1,TRUE,"Label, with comma"',
    'Q2,R2,FALSE,"Two lines:',
    'second line with ""quote"""',
    '',
  ].join('\n'));

  assert.deepEqual(rows, [
    ['question', 'response', 'value', 'label'],
    ['Q1', 'R1', 'TRUE', 'Label, with comma'],
    ['Q2', 'R2', 'FALSE', 'Two lines:\nsecond line with "quote"'],
  ]);
});

test('normalizeFingerprint accepts colon-delimited and compact SHA-256 values', () => {
  const compact = '7024152eb199d7b359f38fa38507841432c2747dad88dcf035b3124443a88852';
  const expected = '70:24:15:2E:B1:99:D7:B3:59:F3:8F:A3:85:07:84:14:32:C2:74:7D:AD:88:DC:F0:35:B3:12:44:43:A8:88:52';

  assert.equal(normalizeFingerprint(compact), expected);
  assert.equal(normalizeFingerprint(expected), expected);
});

test('normalizeFingerprint rejects non-SHA-256 input', () => {
  assert.throws(
    () => normalizeFingerprint('not-a-fingerprint'),
    /geen SHA-256-waarde/,
  );
});

test('readAabFingerprint extracts the SHA-256 value from keytool output', () => {
  const runKeytool = (command, args) => {
    assert.equal(command, 'keytool');
    assert.deepEqual(args, ['-printcert', '-jarfile', '/tmp/release.aab']);
    return [
      'Certificate fingerprints:',
      ' SHA1: 00:11',
      ' SHA256: 70:24:15:2E:B1:99:D7:B3:59:F3:8F:A3:85:07:84:14:32:C2:74:7D:AD:88:DC:F0:35:B3:12:44:43:A8:88:52',
    ].join('\n');
  };

  assert.equal(
    readAabFingerprint('/tmp/release.aab', runKeytool),
    '70:24:15:2E:B1:99:D7:B3:59:F3:8F:A3:85:07:84:14:32:C2:74:7D:AD:88:DC:F0:35:B3:12:44:43:A8:88:52',
  );
});
