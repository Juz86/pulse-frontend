import test from 'node:test';
import assert from 'node:assert/strict';
import { isOwnedActiveDevice, toDeviceSummary } from './deviceRecords.js';

test('toDeviceSummary strips sensitive device fields but keeps lifecycle data', () => {
  assert.deepEqual(
    toDeviceSummary({
      id: 'device_1',
      userId: 'uid_child_1',
      deviceLabel: 'iPad van Sara',
      platform: 'ios',
      protocol: 'signal_v1',
      protocolVersion: 1,
      status: 'active',
      oneTimePreKeyCount: 12,
      signedPreKey: { keyId: 7, publicKey: 'secret-ish' },
      signedPreKeyRotatedAt: '2026-04-04T10:00:00Z',
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-04-02T10:00:00Z',
      revokedAt: null,
      oneTimePreKeys: [{ keyId: 1, publicKey: 'hidden' }],
      identityPublicKey: 'hidden',
    }),
    {
      id: 'device_1',
      userId: 'uid_child_1',
      deviceLabel: 'iPad van Sara',
      platform: 'ios',
      protocol: 'signal_v1',
      protocolVersion: 1,
      status: 'active',
      oneTimePreKeyCount: 12,
      signedPreKeyKeyId: 7,
      signedPreKeyRotatedAt: '2026-04-04T10:00:00Z',
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-04-02T10:00:00Z',
      revokedAt: null,
    }
  );
});

test('isOwnedActiveDevice checks ownership and active status', () => {
  assert.equal(isOwnedActiveDevice({ userId: 'uid_child_1', status: 'active' }, 'uid_child_1'), true);
  assert.equal(isOwnedActiveDevice({ userId: 'uid_child_1', status: 'revoked' }, 'uid_child_1'), false);
  assert.equal(isOwnedActiveDevice({ userId: 'uid_other', status: 'active' }, 'uid_child_1'), false);
});
