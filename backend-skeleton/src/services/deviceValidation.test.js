import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTargetRecipientDevice,
  canUseSenderDevice,
  isActiveDevice,
} from './deviceValidation.js';

test('isActiveDevice checks active status', () => {
  assert.equal(isActiveDevice({ status: 'active' }), true);
  assert.equal(isActiveDevice({ status: 'revoked' }), false);
});

test('canUseSenderDevice requires matching owner and active device', () => {
  assert.equal(canUseSenderDevice({ userId: 'uid_child_1', status: 'active' }, 'uid_child_1'), true);
  assert.equal(canUseSenderDevice({ userId: 'uid_other', status: 'active' }, 'uid_child_1'), false);
  assert.equal(canUseSenderDevice({ userId: 'uid_child_1', status: 'revoked' }, 'uid_child_1'), false);
});

test('canTargetRecipientDevice requires matching recipient and active device', () => {
  assert.equal(canTargetRecipientDevice({ userId: 'uid_contact_9', status: 'active' }, 'uid_contact_9'), true);
  assert.equal(canTargetRecipientDevice({ userId: 'uid_other', status: 'active' }, 'uid_contact_9'), false);
  assert.equal(canTargetRecipientDevice({ userId: 'uid_contact_9', status: 'revoked' }, 'uid_contact_9'), false);
});
