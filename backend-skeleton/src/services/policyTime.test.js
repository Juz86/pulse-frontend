import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinQuietHours } from './policyTime.js';

function at(hour, minute = 0) {
  return new Date(2026, 3, 3, hour, minute, 0, 0);
}

test('returns false when quiet hours are disabled', () => {
  assert.equal(
    isWithinQuietHours(
      {
        quietHoursEnabled: false,
        quietHoursStart: '20:00',
        quietHoursEnd: '07:00',
      },
      at(21, 0)
    ),
    false
  );
});

test('returns true inside same-day quiet hours window', () => {
  assert.equal(
    isWithinQuietHours(
      {
        quietHoursEnabled: true,
        quietHoursStart: '13:00',
        quietHoursEnd: '15:00',
      },
      at(14, 0)
    ),
    true
  );
});

test('returns false outside same-day quiet hours window', () => {
  assert.equal(
    isWithinQuietHours(
      {
        quietHoursEnabled: true,
        quietHoursStart: '13:00',
        quietHoursEnd: '15:00',
      },
      at(16, 0)
    ),
    false
  );
});

test('returns true for overnight quiet hours after start time', () => {
  assert.equal(
    isWithinQuietHours(
      {
        quietHoursEnabled: true,
        quietHoursStart: '20:00',
        quietHoursEnd: '07:00',
      },
      at(22, 30)
    ),
    true
  );
});

test('returns true for overnight quiet hours before end time', () => {
  assert.equal(
    isWithinQuietHours(
      {
        quietHoursEnabled: true,
        quietHoursStart: '20:00',
        quietHoursEnd: '07:00',
      },
      at(6, 30)
    ),
    true
  );
});

test('returns false outside overnight quiet hours', () => {
  assert.equal(
    isWithinQuietHours(
      {
        quietHoursEnabled: true,
        quietHoursStart: '20:00',
        quietHoursEnd: '07:00',
      },
      at(12, 0)
    ),
    false
  );
});

test('returns false for invalid time strings', () => {
  assert.equal(
    isWithinQuietHours(
      {
        quietHoursEnabled: true,
        quietHoursStart: 'xx:yy',
        quietHoursEnd: '07:00',
      },
      at(21, 0)
    ),
    false
  );
});
