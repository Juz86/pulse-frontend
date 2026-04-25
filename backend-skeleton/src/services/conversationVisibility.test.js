import test from 'node:test';
import assert from 'node:assert/strict';
import { filterVisibleConversations, shouldHideConversationForUser } from './conversationVisibility.js';

test('shouldHideConversationForUser returns true when uid is in deletedForUserIds', () => {
  const conversation = { deletedForUserIds: ['uid_child_1'] };
  assert.equal(shouldHideConversationForUser(conversation, 'uid_child_1'), true);
});

test('shouldHideConversationForUser returns false when uid is not in deletedForUserIds', () => {
  const conversation = { deletedForUserIds: ['uid_child_1'] };
  assert.equal(shouldHideConversationForUser(conversation, 'uid_child_2'), false);
});

test('filterVisibleConversations filters hidden conversations for the current user', () => {
  const conversations = [
    { id: 'a' },
    { id: 'b', deletedForUserIds: ['uid_child_1'] },
  ];
  const visible = filterVisibleConversations(conversations, 'uid_child_1');
  assert.deepEqual(visible.map((conversation) => conversation.id), ['a']);
});
