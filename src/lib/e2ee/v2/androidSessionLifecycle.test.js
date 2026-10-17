import { handleAndroidE2eeV2SecurityEvent } from './androidSessionLifecycle';

const USER = { uid: 'user-a' };

function status(available = true) {
  return { providerAvailable: available, privateMaterialExportable: false };
}

function event(overrides = {}) {
  return {
    protocol: 'pulse_e2ee_v2',
    protocolVersion: 2,
    userId: 'user-b',
    deviceId: 'device-b1',
    signalDeviceId: 2,
    identityVersion: 2,
    type: 'identity_changed',
    createdAt: '2026-10-17T12:00:00.000Z',
    ...overrides,
  };
}

function base(overrides = {}) {
  return {
    user: USER,
    localDeviceId: 'device-a1',
    localSignalDeviceId: 1,
    event: event(),
    getStatus: jest.fn().mockResolvedValue(status()),
    invalidateRemoteDevice: jest.fn().mockResolvedValue({ invalidated: true }),
    clearUserState: jest.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe('Android E2EE v2 session lifecycle', () => {
  test('stops before changing state while the provider gate is closed', async () => {
    const options = base({ getStatus: jest.fn().mockResolvedValue(status(false)) });

    await expect(handleAndroidE2eeV2SecurityEvent(options))
      .rejects.toThrow('v2_native_provider_not_released');
    expect(options.invalidateRemoteDevice).not.toHaveBeenCalled();
    expect(options.clearUserState).not.toHaveBeenCalled();
  });

  test('invalidates a remote session after an identity change', async () => {
    const options = base();

    await expect(handleAndroidE2eeV2SecurityEvent(options)).resolves.toEqual({
      action: 'remote_session_invalidated',
      requiresRegistration: false,
      revoked: false,
    });
    expect(options.invalidateRemoteDevice).toHaveBeenCalledWith({
      userId: 'user-a',
      localSignalDeviceId: 1,
      remoteUserId: 'user-b',
      remoteDeviceId: 'device-b1',
      remoteSignalDeviceId: 2,
      remoteIdentityVersion: 2,
      revoked: false,
    });
  });

  test('marks a remote revoked device as unusable', async () => {
    const options = base({ event: event({ type: 'device_revoked' }) });

    await expect(handleAndroidE2eeV2SecurityEvent(options))
      .resolves.toMatchObject({ revoked: true });
    expect(options.invalidateRemoteDevice).toHaveBeenCalledWith(
      expect.objectContaining({ remoteDeviceId: 'device-b1', revoked: true }),
    );
  });

  test('clears all local E2EE state when this device is revoked', async () => {
    const options = base({
      event: event({
        userId: 'user-a',
        deviceId: 'device-a1',
        signalDeviceId: 1,
        identityVersion: 1,
        type: 'device_revoked',
      }),
    });

    await expect(handleAndroidE2eeV2SecurityEvent(options)).resolves.toEqual({
      action: 'local_device_invalidated',
      requiresRegistration: false,
      revoked: true,
    });
    expect(options.clearUserState).toHaveBeenCalledWith('user-a');
    expect(options.invalidateRemoteDevice).not.toHaveBeenCalled();
  });

  test('rejects incomplete or untrusted lifecycle events', async () => {
    const options = base({ event: event({ signalDeviceId: undefined }) });

    await expect(handleAndroidE2eeV2SecurityEvent(options))
      .rejects.toThrow('v2_security_event_invalid');
    expect(options.invalidateRemoteDevice).not.toHaveBeenCalled();
  });
});
