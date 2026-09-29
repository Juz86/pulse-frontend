import { getOrCreatePushInstallationId } from './pushInstallation';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('push installation identity', () => {
  test('reuses the installation id stored for this browser profile', () => {
    const storage = createStorage();

    const generate = jest.fn(() => 'generated-installation');
    const first = getOrCreatePushInstallationId(storage, generate);
    const second = getOrCreatePushInstallationId(storage, generate);

    expect(generate).toHaveBeenCalledTimes(1);

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  test('preserves an existing installation id', () => {
    const storage = createStorage({ pulse_push_installation_id: 'existing-installation' });

    expect(getOrCreatePushInstallationId(storage)).toBe('existing-installation');
  });
});
