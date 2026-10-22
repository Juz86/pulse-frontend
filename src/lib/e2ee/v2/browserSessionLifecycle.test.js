import { handleBrowserE2eeV2SecurityEvent } from './browserSessionLifecycle';

const USER = { uid: 'user-a' };

function securityEvent(overrides = {}) {
  return {
    protocol: 'pulse_e2ee_v2',
    protocolVersion: 2,
    userId: 'user-b',
    deviceId: 'device-b1',
    signalDeviceId: 2,
    identityVersion: 2,
    type: 'identity_changed',
    ...overrides,
  };
}

function setup(event = securityEvent()) {
  const client = {
    status: jest.fn().mockResolvedValue({
      wasmReady: true,
      bootstrapped: true,
      privateMaterialExportable: false,
    }),
    invalidateRemoteDevice: jest.fn().mockResolvedValue({ invalidated: true }),
    revoke: jest.fn().mockResolvedValue({ revoked: true }),
  };
  return {
    client,
    options: {
      user: USER,
      localDeviceId: 'device-a1',
      localSignalDeviceId: 1,
      event,
      client,
    },
  };
}

describe('browser E2EE v2 session lifecycle', () => {
  test('removes the affected remote session after identity change', async () => {
    const { client, options } = setup();
    await expect(handleBrowserE2eeV2SecurityEvent(options)).resolves.toEqual({
      action: 'remote_session_invalidated',
      requiresRegistration: false,
      revoked: false,
    });
    expect(client.invalidateRemoteDevice).toHaveBeenCalledWith(expect.objectContaining({
      remoteUserId: 'user-b',
      remoteDeviceId: 'device-b1',
      remoteIdentityVersion: 2,
      revoked: false,
    }));
  });

  test('wipes the local browser device after its own revoke event', async () => {
    const { client, options } = setup(securityEvent({
      userId: 'user-a',
      deviceId: 'device-a1',
      signalDeviceId: 1,
      identityVersion: 1,
      type: 'device_revoked',
    }));
    await expect(handleBrowserE2eeV2SecurityEvent(options)).resolves.toMatchObject({
      action: 'local_device_invalidated',
      revoked: true,
    });
    expect(client.revoke).toHaveBeenCalledTimes(1);
    expect(client.invalidateRemoteDevice).not.toHaveBeenCalled();
  });

  test('fails closed before state mutation while browser bootstrap is unavailable', async () => {
    const { client, options } = setup();
    client.status.mockResolvedValue({ wasmReady: true, bootstrapped: false });
    await expect(handleBrowserE2eeV2SecurityEvent(options))
      .rejects.toThrow('v2_browser_provider_not_released');
    expect(client.invalidateRemoteDevice).not.toHaveBeenCalled();
  });
});
