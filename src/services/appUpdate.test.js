import { selectUpdateFlow } from './appUpdate';

jest.mock('@capacitor/core', () => ({
  registerPlugin: () => ({}),
}));

describe('selectUpdateFlow', () => {
  test('uses a flexible update when Play allows it', () => {
    expect(selectUpdateFlow({ canFlexible: true, canImmediate: true })).toBe('flexible');
  });

  test('falls back to an immediate update for an optional update', () => {
    expect(selectUpdateFlow({ canFlexible: false, canImmediate: true })).toBe('immediate');
  });

  test('prefers an immediate update when the policy requires it', () => {
    expect(selectUpdateFlow({ required: true, canFlexible: true, canImmediate: true })).toBe('immediate');
  });

  test('returns no flow when Play allows neither update type', () => {
    expect(selectUpdateFlow({})).toBeNull();
  });
});
