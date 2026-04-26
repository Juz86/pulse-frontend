import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterVisibleMessages,
  shouldHideMessageForUser,
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

test('filterVisibleMessages hides messages created before clear timestamp for that user', () => {
  assert.deepEqual(
    filterVisibleMessages(
      [
        { id: 'old', createdAt: '2026-04-20T08:00:00.000Z' },
        { id: 'new', createdAt: '2026-04-21T09:00:00.000Z' },
      ],
      'uid_child_1',
      { clearedAtByUid: { uid_child_1: '2026-04-20T12:00:00.000Z' } }
    ),
    [{ id: 'new', createdAt: '2026-04-21T09:00:00.000Z' }]
  );
});
