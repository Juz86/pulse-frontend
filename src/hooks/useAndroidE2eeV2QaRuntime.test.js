import { isRecoverableE2eeBackendFailure } from '../lib/e2ee/v2/backendRecovery';

describe('isRecoverableE2eeBackendFailure', () => {
  test.each([
    [new TypeError('Failed to fetch')],
    [Object.assign(new Error('service unavailable'), { status: 503 })],
    [Object.assign(new Error('offline'), { status: 0 })],
  ])('accepts temporary network failures', (error) => {
    expect(isRecoverableE2eeBackendFailure(error)).toBe(true);
  });

  test.each([
    [Object.assign(new Error('unauthorized'), { status: 401 })],
    [Object.assign(new Error('identity changed'), { status: 409 })],
    [Object.assign(new Error('forbidden'), { status: 403 })],
  ])('does not retry security or authorization failures', (error) => {
    expect(isRecoverableE2eeBackendFailure(error)).toBe(false);
  });
});
