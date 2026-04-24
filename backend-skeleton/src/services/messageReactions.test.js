import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleSingleUserReaction } from './messageReactions.js';

test('toggleSingleUserReaction adds a first reaction', () => {
  assert.deepEqual(
    toggleSingleUserReaction({}, '👍', 'uid_a'),
    { '👍': ['uid_a'] }
  );
});

test('toggleSingleUserReaction replaces the current user reaction', () => {
  assert.deepEqual(
    toggleSingleUserReaction({ '👍': ['uid_a', 'uid_b'], '😂': ['uid_c'] }, '😂', 'uid_a'),
    { '👍': ['uid_b'], '😂': ['uid_c', 'uid_a'] }
  );
});

test('toggleSingleUserReaction removes the reaction when the same emoji is selected', () => {
  assert.deepEqual(
    toggleSingleUserReaction({ '👍': ['uid_a'], '😂': ['uid_c'] }, '👍', 'uid_a'),
    { '😂': ['uid_c'] }
  );
});
