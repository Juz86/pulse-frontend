import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterVisibleMessages,
  shouldHideMessageForUser,
  toConversationPreview,
} from './messageVisibility.js';

test('shouldHideMessageForUser hides globally deleted messages', () => {
  assert.equal(shouldHideMessageForUser({ deleted: true }, 'uid_child_1'), true);
});

test('shouldHideMessageForUser hides self-deleted messages for matching user only', () => {
  const message = { deletedForUserIds: ['uid_child_1'] };
  assert.equal(shouldHideMessageForUser(message, 'uid_child_1'), true);
  assert.equal(shouldHideMessageForUser(message, 'uid_contact_9'), false);
});

test('filterVisibleMessages keeps only messages visible to the user', () => {
  assert.deepEqual(
    filterVisibleMessages(
      [
        { id: 'a' },
        { id: 'b', deletedForUserIds: ['uid_child_1'] },
        { id: 'c', deleted: true },
      ],
      'uid_child_1'
    ),
    [{ id: 'a' }]
  );
});

test('toConversationPreview returns encrypted fallback for signal messages', () => {
  assert.equal(toConversationPreview({ protocol: 'signal_v1' }), 'Versleuteld bericht');
  assert.equal(toConversationPreview({ protocol: 'legacy_plaintext', text: 'Hallo' }), 'Hallo');
});
