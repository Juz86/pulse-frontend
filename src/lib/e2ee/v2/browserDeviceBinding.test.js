import {
  clearBrowserE2eeV2QaBinding,
  createBrowserE2eeV2QaBinding,
  readBrowserE2eeV2QaBinding,
  updateBrowserE2eeV2QaBinding,
} from './browserDeviceBinding';

function storage() {
  const values = new Map();
  return {
    getItem: jest.fn((key) => values.get(key) || null),
    setItem: jest.fn((key, value) => values.set(key, value)),
    removeItem: jest.fn((key) => values.delete(key)),
  };
}

describe('browser E2EE v2 public device binding', () => {
  test('persists only opaque public routing metadata and reuses it', () => {
    const target = storage();
    const first = createBrowserE2eeV2QaBinding({
      userId: 'user-a',
      registeredDevices: [{ signalDeviceId: 1 }, { signalDeviceId: 2 }],
      storage: target,
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
    });
    const second = createBrowserE2eeV2QaBinding({
      userId: 'user-a',
      storage: target,
      randomUuid: () => 'unused',
    });
    expect(first).toEqual({
      deviceId: 'browser-qa-123e4567-e89b-42d3-a456-426614174000',
      signalDeviceId: 3,
    });
    expect(second).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(/identity|private|prekey|session/i);
  });

  test('updates registration metadata and clears a revoked local binding', () => {
    const target = storage();
    const binding = updateBrowserE2eeV2QaBinding('user-a', {
      deviceId: 'browser-qa-device-a',
      signalDeviceId: 1,
      identityVersion: 2,
      registered: true,
    }, target);
    expect(readBrowserE2eeV2QaBinding('user-a', target)).toEqual(binding);
    clearBrowserE2eeV2QaBinding('user-a', target);
    expect(readBrowserE2eeV2QaBinding('user-a', target)).toBeNull();
  });

  test('isolates production pilot metadata from QA metadata', () => {
    const target = storage();
    const pilot = createBrowserE2eeV2QaBinding({
      userId: 'user-a',
      storage: target,
      bindingNamespace: 'pilot',
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
    });
    expect(pilot.deviceId).toBe('browser-pilot-123e4567-e89b-42d3-a456-426614174000');
    expect(readBrowserE2eeV2QaBinding('user-a', target)).toBeNull();
    expect(readBrowserE2eeV2QaBinding('user-a', target, 'pilot')).toEqual(pilot);
  });
});
