import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDeliveryState, toSocketStatus } from './messageReceipts.js';

test('computeDeliveryState returns sent for empty records', () => {
  assert.equal(computeDeliveryState([]), 'sent');
});

test('computeDeliveryState returns delivered when any receipt is delivered', () => {
  assert.equal(
    computeDeliveryState([
      { deliveredAt: '2026-04-04T10:00:00Z', readAt: null },
      { deliveredAt: null, readAt: null },
    ]),
    'delivered'
  );
});

test('computeDeliveryState prefers read over delivered', () => {
  assert.equal(
    computeDeliveryState([
      { deliveredAt: '2026-04-04T10:00:00Z', readAt: null },
      { deliveredAt: '2026-04-04T10:01:00Z', readAt: '2026-04-04T10:02:00Z' },
    ]),
    'read'
  );
});

test('toSocketStatus maps delivery states to existing frontend labels', () => {
  assert.equal(toSocketStatus('delivered'), 'bezorgd');
  assert.equal(toSocketStatus('read'), 'gelezen');
  assert.equal(toSocketStatus('sent'), null);
});
