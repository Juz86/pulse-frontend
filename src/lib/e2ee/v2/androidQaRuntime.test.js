import {
  createAndroidE2eeV2QaBinding,
  readAndroidE2eeV2QaBinding,
  startAndroidE2eeV2QaRuntime,
} from './androidQaRuntime';

function createStorage() {
  const values = new Map();
  return {
    getItem: jest.fn((key) => values.get(key) || null),
    setItem: jest.fn((key, value) => values.set(key, value)),
  };
}

describe('Android E2EE v2 QA runtime', () => {
  test('persists public device routing metadata before registration retries', () => {
    const storage = createStorage();
    const first = createAndroidE2eeV2QaBinding({
      userId: 'user-a',
      registeredDevices: [{ signalDeviceId: 1 }, { signalDeviceId: 2 }],
      storage,
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
    });
    const second = createAndroidE2eeV2QaBinding({
      userId: 'user-a',
      registeredDevices: [],
      storage,
      randomUuid: () => 'unused',
    });

    expect(first).toEqual({
      deviceId: 'qa-123e4567-e89b-42d3-a456-426614174000',
      signalDeviceId: 3,
    });
    expect(second).toEqual(first);
    expect(readAndroidE2eeV2QaBinding('user-a', storage)).toEqual(first);
  });

  test('registers, binds the socket and exposes only the v2 send function', async () => {
    const storage = createStorage();
    const user = { uid: 'user-a' };
    const api = { listDevices: jest.fn().mockResolvedValue([]) };
    const registerDevice = jest.fn().mockResolvedValue({
      deviceId: 'qa-device-a',
      signalDeviceId: 1,
      identityVersion: 1,
      status: 'REGISTERED',
    });
    const bindSocketDevice = jest.fn();
    const assertConfiguration = jest.fn();

    const runtime = await startAndroidE2eeV2QaRuntime({
      user,
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
      api,
      registerDevice,
      storage,
      randomUuid: () => '123e4567-e89b-42d3-a456-426614174000',
      bindSocketDevice,
      assertConfiguration,
    });

    expect(assertConfiguration).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(registerDevice).toHaveBeenCalledWith(expect.objectContaining({
      user,
      deviceId: 'qa-123e4567-e89b-42d3-a456-426614174000',
      signalDeviceId: 1,
      api,
    }));
    expect(bindSocketDevice).toHaveBeenCalledWith('qa-device-a');
    expect(runtime).toMatchObject({
      deviceId: 'qa-device-a',
      signalDeviceId: 1,
      status: 'REGISTERED',
    });
    expect(typeof runtime.sendText).toBe('function');
  });
});
