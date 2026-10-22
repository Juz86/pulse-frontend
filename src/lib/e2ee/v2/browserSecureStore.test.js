/* global globalThis */
import { webcrypto } from 'crypto';
import { IDBFactory } from 'fake-indexeddb';
import { TextEncoder } from 'util';
import { MessageChannel, receiveMessageOnPort } from 'worker_threads';
import {
  BrowserE2eeStoreError,
  createBrowserE2eeSecureStore,
} from './browserSecureStore';

const BINDING = { uid: 'user-a', deviceId: 'device-a1', signalDeviceId: 7 };
const RECORD = { binding: BINDING, recordType: 'session', recordId: 'device-b1' };

beforeAll(() => {
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis, 'structuredClone', {
    configurable: true,
    value: (value) => {
      const { port1, port2 } = new MessageChannel();
      port1.postMessage(value);
      const cloned = receiveMessageOnPort(port2).message;
      port1.close();
      port2.close();
      return cloned;
    },
  });
});
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openRawDatabase(indexedDBImpl, databaseName) {
  return requestResult(indexedDBImpl.open(databaseName, 1));
}

function createStore(
  databaseName = `pulse-e2ee-test-${Math.random()}`,
  indexedDBImpl = new IDBFactory(),
) {
  return createBrowserE2eeSecureStore({
    databaseName,
    indexedDBImpl,
    cryptoImpl: webcrypto,
  });
}

describe('browser E2EE secure store', () => {
  test('persists a non-exportable AES-GCM key and encrypted record', async () => {
    const databaseName = 'pulse-e2ee-non-exportable';
    const indexedDBImpl = new IDBFactory();
    const store = createStore(databaseName, indexedDBImpl);
    await expect(store.initialize()).resolves.toEqual({
      schemaVersion: 1,
      cryptoVersion: 1,
      wrappingKeyExtractable: false,
    });

    await store.putRecord({ ...RECORD, value: new Uint8Array([1, 2, 3, 4]) });
    await expect(store.getRecord(RECORD)).resolves.toEqual(new Uint8Array([1, 2, 3, 4]));

    const database = await openRawDatabase(indexedDBImpl, databaseName);
    const transaction = database.transaction('keyring', 'readonly');
    const { key } = await requestResult(transaction.objectStore('keyring').get('wrapping-key-v1'));
    await expect(webcrypto.subtle.exportKey('raw', key)).rejects.toMatchObject({
      name: 'InvalidAccessException',
    });
    database.close();
    await store.close();
  });

  test('shares the winning wrapping key when two workers initialize concurrently', async () => {
    const databaseName = 'pulse-e2ee-concurrent-keyring';
    const indexedDBImpl = new IDBFactory();
    const first = createStore(databaseName, indexedDBImpl);
    const second = createStore(databaseName, indexedDBImpl);

    await expect(Promise.all([first.initialize(), second.initialize()])).resolves.toEqual([
      expect.objectContaining({ wrappingKeyExtractable: false }),
      expect.objectContaining({ wrappingKeyExtractable: false }),
    ]);
    await first.putRecord({ ...RECORD, value: new Uint8Array([8, 6, 7]) });
    await expect(second.getRecord(RECORD)).resolves.toEqual(new Uint8Array([8, 6, 7]));
    await Promise.all([first.close(), second.close()]);
  });

  test('rejects manipulated ciphertext without returning record bytes', async () => {
    const databaseName = 'pulse-e2ee-tamper';
    const indexedDBImpl = new IDBFactory();
    const store = createStore(databaseName, indexedDBImpl);
    await store.putRecord({ ...RECORD, value: new Uint8Array([3, 1, 4]) });

    const database = await openRawDatabase(indexedDBImpl, databaseName);
    const readTransaction = database.transaction('records', 'readonly');
    const [record] = await requestResult(readTransaction.objectStore('records').getAll());
    const ciphertext = new Uint8Array(record.ciphertext);
    ciphertext[0] ^= 0xff;
    const writeTransaction = database.transaction('records', 'readwrite');
    writeTransaction.objectStore('records').put({ ...record, ciphertext: ciphertext.buffer });
    await new Promise((resolve, reject) => {
      writeTransaction.oncomplete = resolve;
      writeTransaction.onerror = () => reject(writeTransaction.error);
    });
    database.close();

    await expect(store.getRecord(RECORD)).rejects.toMatchObject({
      code: 'e2ee_browser_record_decrypt_failed',
    });
  });

  test('binds ciphertext to the exact user and device through AAD', async () => {
    const store = createStore();
    await store.putRecord({ ...RECORD, value: new Uint8Array([9, 8, 7]) });

    await expect(store.getRecord({
      ...RECORD,
      binding: { ...BINDING, deviceId: 'device-a2' },
    })).resolves.toBeNull();
    await expect(store.getRecord(RECORD)).resolves.toEqual(new Uint8Array([9, 8, 7]));
  });

  test('lists only encrypted records of the requested type for the bound device', async () => {
    const store = createStore();
    await store.putRecord({ ...RECORD, value: new Uint8Array([9, 1]) });
    await store.putRecord({
      binding: BINDING,
      recordType: 'message_history',
      recordId: 'message-1',
      value: new Uint8Array([8, 2]),
    });
    await expect(store.listRecords({ binding: BINDING, recordType: 'session' }))
      .resolves.toEqual([{ recordId: 'device-b1', value: new Uint8Array([9, 1]) }]);
  });

  test('commits record mutations and the operation marker atomically', async () => {
    const store = createStore();
    const operation = {
      binding: BINDING,
      operationId: 'message-1:decrypt',
      operationKind: 'decrypt',
      records: [{ recordType: 'session', recordId: 'device-b1', value: new Uint8Array([5]) }],
    };

    await expect(store.commitOperation(operation)).resolves.toEqual({
      committed: true,
      duplicate: false,
    });
    await expect(store.commitOperation({
      ...operation,
      records: [{ ...operation.records[0], value: new Uint8Array([6]) }],
    })).resolves.toEqual({ committed: true, duplicate: true });
    await expect(store.getRecord(RECORD)).resolves.toEqual(new Uint8Array([5]));
  });

  test('clears records for a revoked device', async () => {
    const store = createStore();
    await store.putRecord({ ...RECORD, value: new Uint8Array([4, 2]) });
    await store.clearDevice(BINDING);
    await expect(store.getRecord(RECORD)).resolves.toBeNull();
  });

  test('fails closed when secure browser primitives are unavailable', () => {
    expect(() => createBrowserE2eeSecureStore({
      indexedDBImpl: null,
      cryptoImpl: null,
    })).toThrow(expect.objectContaining({
      name: 'BrowserE2eeStoreError',
      code: 'e2ee_browser_secure_storage_unavailable',
    }));
  });

  test('rejects invalid bindings before opening storage', async () => {
    const store = createStore();
    await expect(store.putRecord({
      ...RECORD,
      binding: { ...BINDING, signalDeviceId: 0 },
      value: new Uint8Array([1]),
    })).rejects.toBeInstanceOf(BrowserE2eeStoreError);
  });
});
