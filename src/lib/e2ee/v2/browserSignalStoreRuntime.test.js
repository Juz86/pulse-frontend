/* global globalThis */
import { TextDecoder, TextEncoder } from 'util';
import { createBrowserSignalStoreRuntime } from './browserSignalStoreRuntime';

const BINDING = { uid: 'user-a', deviceId: 'device-a1', signalDeviceId: 7 };

beforeAll(() => {
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: TextDecoder });
});
function item(id, seed) {
  return {
    id,
    public_key: new Uint8Array([seed, 1]),
    signature: new Uint8Array([seed, 2]),
    record: new Uint8Array([seed, 3, 4]),
    free: jest.fn(),
  };
}

function setup() {
  const records = new Map();
  const imported = { preKeys: [], signed: [], kyber: [] };
  const generated = { records: [] };
  const identityStores = [];
  class PrivateKey {
    static generate() { return new PrivateKey(); }
    getPublicKey() { return new PublicKey(); }
    free() {}
  }
  class PublicKey {
    serialize() { return new Uint8Array([11, 12]); }
    free() {}
  }
  class IdentityKeyPair {
    static deserialize(bytes) {
      expect(bytes).toEqual(new Uint8Array([90, 91]));
      return new IdentityKeyPair();
    }
    serialize() { return new Uint8Array([90, 91]); }
    free() {}
  }
  class IdentityStore {
    constructor() {
      this.free = jest.fn();
      identityStores.push(this);
    }
  }
  class PreKeyStore {
    async import_pre_key(id, bytes) { imported.preKeys.push([id, [...bytes]]); }
    free() {}
  }
  class SignedStore {
    async import_signed_pre_key(id, bytes) { imported.signed.push([id, [...bytes]]); }
    free() {}
  }
  class KyberStore {
    async import_kyber_pre_key(id, bytes) { imported.kyber.push([id, [...bytes]]); }
    free() {}
  }
  class SessionStore {
    constructor() { this.sessions = new Map(); }
    async import_session(address, bytes) { this.sessions.set(address.key, [...bytes]); }
    async delete_session(address) { return this.sessions.delete(address.key); }
    free() {}
  }
  class Address {
    constructor(name, deviceId) { this.key = `${name}\u0000${deviceId}`; }
    free() {}
  }
  const api = {
    WasmPrivateKey: PrivateKey,
    WasmIdentityKeyPair: IdentityKeyPair,
    WasmInMemIdentityKeyStore: IdentityStore,
    WasmInMemPreKeyStore: PreKeyStore,
    WasmInMemSignedPreKeyStore: SignedStore,
    WasmInMemKyberPreKeyStore: KyberStore,
    WasmInMemSessionStore: SessionStore,
    WasmProtocolAddress: Address,
    generateRegistrationId: jest.fn(() => 42),
    generatePreKeys: jest.fn(async (start, count) => Array.from(
      { length: count },
      (_, index) => item(start + index, 20 + index),
    )),
    generateSignedPreKey: jest.fn(async () => item(101, 31)),
    generateKyberPreKey: jest.fn(async () => item(201, 41)),
  };
  api.generatePreKeys.mockImplementation(async (start, count) => {
    const values = Array.from({ length: count }, (_, index) => item(start + index, 20 + index));
    generated.records.push(...values);
    return values;
  });
  const secureStore = {
    async getRecord({ recordType, recordId }) {
      const value = records.get(`${recordType}:${recordId}`);
      return value ? new Uint8Array(value) : null;
    },
    async commitOperation({ records: nextRecords, deleteRecords = [] }) {
      nextRecords.forEach(({ recordType, recordId, value }) => {
        records.set(`${recordType}:${recordId}`, new Uint8Array(value));
      });
      deleteRecords.forEach(({ recordType, recordId }) => {
        records.delete(`${recordType}:${recordId}`);
      });
      return { committed: true, duplicate: false };
    },
  };
  return { api, generated, identityStores, imported, records, secureStore };
}

describe('browser Signal store runtime', () => {
  test('atomically persists bootstrap records and returns only public registration data', async () => {
    const { api, generated, records, secureStore } = setup();
    const runtime = createBrowserSignalStoreRuntime({ api, secureStore, binding: BINDING });
    const result = await runtime.bootstrap({ preKeyCount: 3 });

    expect(result).toMatchObject({
      protocol: 'pulse_e2ee_v2',
      signalDeviceId: 7,
      registrationId: 42,
      identityKey: expect.any(String),
      privateMaterialExportable: false,
    });
    expect(result.oneTimePreKeys).toHaveLength(3);
    expect(records.has('identity_key_pair:local')).toBe(true);
    expect(records.has('bootstrap_manifest:current')).toBe(true);
    expect(records.has('signed_prekey:101')).toBe(true);
    expect(records.has('kyber_prekey:201')).toBe(true);
    expect(generated.records.every(({ record }) => record.every((byte) => byte === 0))).toBe(true);
  });

  test('hydrates all persisted private stores without regenerating identity material', async () => {
    const { api, imported, secureStore } = setup();
    const first = createBrowserSignalStoreRuntime({ api, secureStore, binding: BINDING });
    const publicBundle = await first.bootstrap({ preKeyCount: 2 });
    first.close();

    const second = createBrowserSignalStoreRuntime({ api, secureStore, binding: BINDING });
    await expect(second.hydrateIfPresent()).resolves.toBe(true);
    await expect(second.bootstrap({ preKeyCount: 2 })).resolves.toEqual(publicBundle);
    expect(api.generateRegistrationId).toHaveBeenCalledTimes(1);
    expect(imported.preKeys.map(([id]) => id)).toEqual([1, 2]);
    expect(imported.signed.map(([id]) => id)).toEqual([101]);
    expect(imported.kyber.map(([id]) => id)).toEqual([201]);
  });

  test('clears stale in-memory identity trust after durable session invalidation', async () => {
    const { api, identityStores, records, secureStore } = setup();
    const first = createBrowserSignalStoreRuntime({ api, secureStore, binding: BINDING });
    await first.bootstrap({ preKeyCount: 2 });
    first.close();

    const remote = {
      remoteUserId: 'user-b',
      remoteDeviceId: 'device-b1',
      remoteSignalDeviceId: 9,
      remoteIdentityVersion: 1,
    };
    const recordId = `${remote.remoteUserId}\u0000${remote.remoteSignalDeviceId}`;
    records.set('session_index:current', new TextEncoder().encode(JSON.stringify([remote])));
    records.set(`session:${recordId}`, new Uint8Array([7, 8, 9]));

    const restored = createBrowserSignalStoreRuntime({ api, secureStore, binding: BINDING });
    await expect(restored.hydrateIfPresent()).resolves.toBe(true);
    const staleIdentityStore = identityStores.at(-1);
    await expect(restored.invalidateRemoteDevice({
      ...remote,
      remoteIdentityVersion: 2,
    })).resolves.toEqual({ invalidated: true, revoked: false });

    expect(staleIdentityStore.free).toHaveBeenCalledTimes(1);
    expect(identityStores.at(-1)).not.toBe(staleIdentityStore);
    expect(records.has(`session:${recordId}`)).toBe(false);
    await expect(restored.listSessionDevices({ remoteUserId: 'user-b' }))
      .resolves.toEqual({ devices: [] });
  });
});
