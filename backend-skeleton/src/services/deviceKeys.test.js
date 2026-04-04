import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendUniqueOneTimePreKeys,
  consumeOneTimePreKey,
  normalizeOneTimePreKeys,
} from './deviceKeys.js';

test('normalizeOneTimePreKeys keeps only valid prekeys', () => {
  assert.deepEqual(
    normalizeOneTimePreKeys([
      null,
      { keyId: 1, publicKey: 'a' },
      { keyId: 2 },
      { publicKey: 'b' },
      { keyId: 3, publicKey: 'c' },
    ]),
    [
      { keyId: 1, publicKey: 'a' },
      { keyId: 3, publicKey: 'c' },
    ]
  );
});

test('consumeOneTimePreKey returns first item and remaining queue', () => {
  assert.deepEqual(
    consumeOneTimePreKey([
      { keyId: 1, publicKey: 'a' },
      { keyId: 2, publicKey: 'b' },
    ]),
    {
      issuedPreKey: { keyId: 1, publicKey: 'a' },
      remainingPreKeys: [{ keyId: 2, publicKey: 'b' }],
      remainingCount: 1,
    }
  );
});

test('appendUniqueOneTimePreKeys deduplicates on keyId and keeps sorted order', () => {
  assert.deepEqual(
    appendUniqueOneTimePreKeys(
      [
        { keyId: 1, publicKey: 'a' },
        { keyId: 3, publicKey: 'c' },
      ],
      [
        { keyId: 2, publicKey: 'b' },
        { keyId: 3, publicKey: 'override' },
      ]
    ),
    [
      { keyId: 1, publicKey: 'a' },
      { keyId: 2, publicKey: 'b' },
      { keyId: 3, publicKey: 'override' },
    ]
  );
});
