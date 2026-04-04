import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditMessage, normalizeEditedText } from './messageEdits.js';

test('canEditMessage allows legacy plaintext messages owned by actor', () => {
  assert.deepEqual(
    canEditMessage({ senderUserId: 'uid_child_1', protocol: 'legacy_plaintext' }, 'uid_child_1'),
    { allowed: true }
  );
});

test('canEditMessage rejects signal messages', () => {
  assert.deepEqual(
    canEditMessage({ senderUserId: 'uid_child_1', protocol: 'signal_v1' }, 'uid_child_1'),
    { allowed: false, reason: 'encrypted_messages_cannot_be_edited' }
  );
});

test('canEditMessage rejects non-owners', () => {
  assert.deepEqual(
    canEditMessage({ senderUserId: 'uid_other', protocol: 'legacy_plaintext' }, 'uid_child_1'),
    { allowed: false, reason: 'not_allowed_to_edit' }
  );
});

test('normalizeEditedText trims strings safely', () => {
  assert.equal(normalizeEditedText('  Hallo  '), 'Hallo');
  assert.equal(normalizeEditedText(null), '');
});
