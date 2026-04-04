import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUserRole, resolveUserRole } from './userRoles.js';

test('normalizeUserRole accepts known roles only', () => {
  assert.equal(normalizeUserRole(' parent '), 'parent');
  assert.equal(normalizeUserRole('child'), 'child');
  assert.equal(normalizeUserRole('user'), 'user');
  assert.equal(normalizeUserRole('admin'), null);
  assert.equal(normalizeUserRole(null), null);
});

test('resolveUserRole preserves parent against later user syncs', () => {
  assert.equal(resolveUserRole('parent', 'user'), 'parent');
  assert.equal(resolveUserRole('parent', null), 'parent');
  assert.equal(resolveUserRole(null, 'parent'), 'parent');
});

test('resolveUserRole preserves child against generic user syncs', () => {
  assert.equal(resolveUserRole('child', 'user'), 'child');
  assert.equal(resolveUserRole('child', null), 'child');
});

test('resolveUserRole upgrades user to more specific incoming roles', () => {
  assert.equal(resolveUserRole('user', 'child'), 'child');
  assert.equal(resolveUserRole('user', 'parent'), 'parent');
});

test('resolveUserRole falls back safely to user', () => {
  assert.equal(resolveUserRole(null, 'user'), 'user');
  assert.equal(resolveUserRole(null, null), 'user');
  assert.equal(resolveUserRole('user', 'admin'), 'user');
});
