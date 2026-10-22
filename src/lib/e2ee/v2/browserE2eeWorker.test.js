import { createBrowserE2eeWorkerHandler } from './browserE2eeWorker';

const BINDING = { uid: 'user-a', deviceId: 'device-a1', signalDeviceId: 7 };

function setup() {
  const store = {
    initialize: jest.fn().mockResolvedValue({
      schemaVersion: 1,
      cryptoVersion: 1,
      wrappingKeyExtractable: false,
    }),
    clearDevice: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const wasmProvider = {
    api: { encryptMessage: jest.fn(), decryptMessage: jest.fn() },
    provider: 'libsignal_wasm_0_105_1',
    privateMaterialExportable: false,
  };
  const runtime = {
    hydrateIfPresent: jest.fn().mockResolvedValue(false),
    bootstrap: jest.fn().mockResolvedValue({ protocol: 'pulse_e2ee_v2', identityKey: 'public' }),
    listSessionDevices: jest.fn().mockResolvedValue({
      devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
    }),
    invalidateRemoteDevice: jest.fn().mockResolvedValue({ invalidated: true }),
    encrypt: jest.fn().mockResolvedValue({ envelopeType: 'prekey', ciphertext: 'encrypted' }),
    decrypt: jest.fn().mockResolvedValue({ plaintext: 'decrypted' }),
    saveOutbox: jest.fn().mockResolvedValue({ stored: true }),
    listOutbox: jest.fn().mockResolvedValue({ messages: [] }),
    removeOutbox: jest.fn().mockResolvedValue({ removed: true }),
    storeReceivedMessage: jest.fn().mockResolvedValue({ stored: true }),
    listReceivedMessages: jest.fn().mockResolvedValue({ messages: [] }),
    clearReceivedMessages: jest.fn().mockResolvedValue({ cleared: 0 }),
    close: jest.fn(),
  };
  return {
    store,
    wasmProvider,
    runtime,
    handleMessage: createBrowserE2eeWorkerHandler({
      storeFactory: () => store,
      wasmLoader: jest.fn().mockResolvedValue(wasmProvider),
      runtimeFactory: jest.fn(() => runtime),
    }),
  };
}

describe('browser E2EE worker boundary', () => {
  test('initializes storage but keeps the crypto provider unavailable', async () => {
    const { handleMessage } = setup();
    await expect(handleMessage({
      command: 'initialize',
      generationId: 'generation-1',
      binding: BINDING,
    })).resolves.toMatchObject({
      initialized: true,
      providerAvailable: false,
      wasmReady: true,
      bootstrapped: false,
      provider: 'libsignal_wasm_0_105_1',
      privateMaterialExportable: false,
    });
  });

  test('bootstraps private stores internally and returns only public registration data', async () => {
    const { handleMessage, runtime } = setup();
    await handleMessage({
      command: 'initialize',
      generationId: 'generation-1',
      binding: BINDING,
    });
    await expect(handleMessage({
      command: 'bootstrap',
      generationId: 'generation-1',
      preKeyCount: 20,
    })).resolves.toEqual({ protocol: 'pulse_e2ee_v2', identityKey: 'public' });
    expect(runtime.bootstrap).toHaveBeenCalledWith({ preKeyCount: 20 });
  });

  test('fails closed before opening storage when the WASM contract is invalid', async () => {
    const storeFactory = jest.fn();
    const handleMessage = createBrowserE2eeWorkerHandler({
      storeFactory,
      wasmLoader: jest.fn().mockResolvedValue({ privateMaterialExportable: false }),
      runtimeFactory: jest.fn(),
    });
    await expect(handleMessage({
      command: 'initialize',
      generationId: 'generation-1',
      binding: BINDING,
    })).rejects.toMatchObject({ code: 'e2ee_browser_wasm_provider_invalid' });
    expect(storeFactory).not.toHaveBeenCalled();
  });

  test('rejects stale generations and unknown commands', async () => {
    const { handleMessage } = setup();
    await handleMessage({
      command: 'initialize',
      generationId: 'generation-1',
      binding: BINDING,
    });
    await expect(handleMessage({ command: 'status', generationId: 'old-generation' }))
      .rejects.toMatchObject({ code: 'e2ee_browser_worker_generation_stale' });
    await expect(handleMessage({ command: 'unknown', generationId: 'generation-1' }))
      .rejects.toMatchObject({ code: 'e2ee_browser_worker_command_invalid' });
  });

  test('keeps encrypt and decrypt payloads inside the serialized worker boundary', async () => {
    const { handleMessage, runtime } = setup();
    await handleMessage({
      command: 'initialize',
      generationId: 'generation-1',
      binding: BINDING,
    });
    const encryptPayload = { operationId: 'send-1', plaintext: 'hello' };
    const decryptPayload = { operationId: 'receive-1', ciphertext: 'encrypted' };
    await expect(handleMessage({
      command: 'encrypt',
      generationId: 'generation-1',
      payload: encryptPayload,
    })).resolves.toEqual({ envelopeType: 'prekey', ciphertext: 'encrypted' });
    await expect(handleMessage({
      command: 'decrypt',
      generationId: 'generation-1',
      payload: decryptPayload,
    })).resolves.toEqual({ plaintext: 'decrypted' });
    expect(runtime.encrypt).toHaveBeenCalledWith(encryptPayload);
    expect(runtime.decrypt).toHaveBeenCalledWith(decryptPayload);
  });

  test('returns only public remote session routing metadata', async () => {
    const { handleMessage, runtime } = setup();
    await handleMessage({
      command: 'initialize',
      generationId: 'generation-1',
      binding: BINDING,
    });
    await expect(handleMessage({
      command: 'listSessionDevices',
      generationId: 'generation-1',
      payload: { remoteUserId: 'user-b' },
    })).resolves.toEqual({
      devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
    });
    expect(runtime.listSessionDevices).toHaveBeenCalledWith({ remoteUserId: 'user-b' });
  });

  test('clears device state before closing after revoke', async () => {
    const { store, runtime, handleMessage } = setup();
    await handleMessage({
      command: 'initialize',
      generationId: 'generation-1',
      binding: BINDING,
    });
    await expect(handleMessage({
      command: 'revoke',
      generationId: 'generation-1',
    })).resolves.toEqual({ revoked: true });
    expect(store.clearDevice).toHaveBeenCalledWith(BINDING);
    expect(runtime.close).toHaveBeenCalled();
    expect(store.close).toHaveBeenCalled();
  });
});
