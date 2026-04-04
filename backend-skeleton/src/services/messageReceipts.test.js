import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDeliveryState, toSocketStatus } from './messageReceipts.js';

test('computeDeliveryState returns sent for empty records', () => {
  assert.equal(computeDeliveryState([]), 'sent');
});

test('computeDeliveryState returns delivered only when all devices are delivered or read', () => {
  assert.equal(
    computeDeliveryState([
      { deliveredAt: '2026-04-04T10:00:00Z', readAt: null },
      { deliveredAt: '2026-04-04T10:01:00Z', readAt: null },
    ]),
    'delivered'
  );
});

test('computeDeliveryState keeps partial delivered state at sent until all devices have advanced', () => {
  assert.equal(
    computeDeliveryState([
      { deliveredAt: '2026-04-04T10:00:00Z', readAt: null },
      { deliveredAt: null, readAt: null },
    ]),
    'sent'
  );
});

test('computeDeliveryState prefers read only when all devices have read', () => {
  assert.equal(
    computeDeliveryState([
      { deliveredAt: '2026-04-04T10:01:00Z', readAt: '2026-04-04T10:02:00Z' },
      { deliveredAt: '2026-04-04T10:03:00Z', readAt: '2026-04-04T10:04:00Z' },
    ]),
    'read'
  );
});

test('computeDeliveryState keeps mixed read and delivered state at delivered until all devices are read', () => {
  assert.equal(
    computeDeliveryState([
      { deliveredAt: '2026-04-04T10:01:00Z', readAt: '2026-04-04T10:02:00Z' },
      { deliveredAt: '2026-04-04T10:03:00Z', readAt: null },
    ]),
    'delivered'
  );
});

test('toSocketStatus maps delivery states to existing frontend labels', () => {
  assert.equal(toSocketStatus('delivered'), 'bezorgd');
  assert.equal(toSocketStatus('read'), 'gelezen');
  assert.equal(toSocketStatus('sent'), null);
});
