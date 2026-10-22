/* global globalThis */
const DATABASE_VERSION = 1;
const KEYRING_STORE = 'keyring';
const RECORDS_STORE = 'records';
const OPERATIONS_STORE = 'operations';
const METADATA_STORE = 'metadata';
const WRAPPING_KEY_ID = 'wrapping-key-v1';
const SCHEMA_VERSION = 1;
const CRYPTO_VERSION = 1;

export class BrowserE2eeStoreError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = 'BrowserE2eeStoreError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}
function fail(code, cause) {
  throw new BrowserE2eeStoreError(code, cause);
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('transaction_aborted'));
  });
}

function requireText(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) fail(`e2ee_browser_${field}_invalid`);
  return normalized;
}

export function normalizeBrowserE2eeBinding(binding = {}) {
  const signalDeviceId = Number(binding.signalDeviceId);
  if (!Number.isSafeInteger(signalDeviceId) || signalDeviceId <= 0) {
    fail('e2ee_browser_signal_device_id_invalid');
  }
  return {
    uid: requireText(binding.uid, 'uid'),
    deviceId: requireText(binding.deviceId, 'device_id'),
    signalDeviceId,
  };
}

function normalizeRecordIdentity({ binding, recordType, recordId }) {
  return {
    ...normalizeBrowserE2eeBinding(binding),
    recordType: requireText(recordType, 'record_type'),
    recordId: requireText(recordId, 'record_id'),
  };
}

function storageKey(identity) {
  return JSON.stringify([
    identity.uid,
    identity.deviceId,
    identity.signalDeviceId,
    identity.recordType,
    identity.recordId,
  ]);
}

function additionalData(identity) {
  if (typeof globalThis.TextEncoder !== 'function') {
    fail('e2ee_browser_secure_storage_unavailable');
  }
  return new globalThis.TextEncoder().encode(JSON.stringify([
    SCHEMA_VERSION,
    CRYPTO_VERSION,
    identity.uid,
    identity.deviceId,
    identity.signalDeviceId,
    identity.recordType,
    identity.recordId,
  ]));
}

function toBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  fail('e2ee_browser_record_bytes_invalid');
}

function openDatabase(indexedDBImpl, databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(databaseName, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(KEYRING_STORE)) {
        database.createObjectStore(KEYRING_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(RECORDS_STORE)) {
        const records = database.createObjectStore(RECORDS_STORE, { keyPath: 'storageKey' });
        records.createIndex('byDevice', ['uid', 'deviceId', 'signalDeviceId']);
      }
      if (!database.objectStoreNames.contains(OPERATIONS_STORE)) {
        const operations = database.createObjectStore(OPERATIONS_STORE, { keyPath: 'storageKey' });
        operations.createIndex('byDevice', ['uid', 'deviceId', 'signalDeviceId']);
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('database_blocked'));
  });
}

async function getWrappingKey(database, cryptoImpl) {
  const readTransaction = database.transaction(KEYRING_STORE, 'readonly');
  const existing = await requestResult(readTransaction.objectStore(KEYRING_STORE).get(WRAPPING_KEY_ID));
  await transactionDone(readTransaction);
  if (existing?.key) return existing.key;

  const key = await cryptoImpl.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const writeTransaction = database.transaction(KEYRING_STORE, 'readwrite');
  writeTransaction.objectStore(KEYRING_STORE).add({ id: WRAPPING_KEY_ID, key });
  try {
    await transactionDone(writeTransaction);
    return key;
  } catch (error) {
    const retryTransaction = database.transaction(KEYRING_STORE, 'readonly');
    const winner = await requestResult(
      retryTransaction.objectStore(KEYRING_STORE).get(WRAPPING_KEY_ID),
    );
    await transactionDone(retryTransaction);
    if (!winner?.key) throw error;
    return winner.key;
  }
}

async function encryptRecord(cryptoImpl, key, identity, value) {
  const plaintext = toBytes(value);
  const iv = cryptoImpl.getRandomValues(new Uint8Array(12));
  try {
    const ciphertext = await cryptoImpl.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: additionalData(identity), tagLength: 128 },
      key,
      plaintext,
    );
    return {
      storageKey: storageKey(identity),
      ...identity,
      schemaVersion: SCHEMA_VERSION,
      cryptoVersion: CRYPTO_VERSION,
      iv,
      ciphertext,
      updatedAt: Date.now(),
    };
  } finally {
    plaintext.fill(0);
  }
}

function assertStoredIdentity(record, identity) {
  if (
    record?.schemaVersion !== SCHEMA_VERSION
    || record?.cryptoVersion !== CRYPTO_VERSION
    || record?.storageKey !== storageKey(identity)
    || record?.uid !== identity.uid
    || record?.deviceId !== identity.deviceId
    || record?.signalDeviceId !== identity.signalDeviceId
    || record?.recordType !== identity.recordType
    || record?.recordId !== identity.recordId
  ) {
    fail('e2ee_browser_record_binding_invalid');
  }
}

async function decryptStoredRecord(cryptoImpl, key, record) {
  const identity = normalizeRecordIdentity({
    binding: record,
    recordType: record.recordType,
    recordId: record.recordId,
  });
  assertStoredIdentity(record, identity);
  try {
    const plaintext = await cryptoImpl.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toBytes(record.iv),
        additionalData: additionalData(identity),
        tagLength: 128,
      },
      key,
      record.ciphertext,
    );
    return new Uint8Array(plaintext);
  } catch (error) {
    fail('e2ee_browser_record_decrypt_failed', error);
  }
}

export function createBrowserE2eeSecureStore({
  databaseName = 'pulse-e2ee-v2-qa',
  indexedDBImpl = globalThis.indexedDB,
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (!indexedDBImpl || !cryptoImpl?.subtle || !cryptoImpl?.getRandomValues) {
    fail('e2ee_browser_secure_storage_unavailable');
  }

  let databasePromise;
  const database = () => {
    if (!databasePromise) databasePromise = openDatabase(indexedDBImpl, databaseName);
    return databasePromise;
  };

  async function context() {
    const db = await database();
    const key = await getWrappingKey(db, cryptoImpl);
    return { db, key };
  }

  return {
    async initialize() {
      const { db, key } = await context();
      const metadataTransaction = db.transaction(METADATA_STORE, 'readwrite');
      metadataTransaction.objectStore(METADATA_STORE).put({
        key: 'schema',
        schemaVersion: SCHEMA_VERSION,
        cryptoVersion: CRYPTO_VERSION,
      });
      await transactionDone(metadataTransaction);
      return {
        schemaVersion: SCHEMA_VERSION,
        cryptoVersion: CRYPTO_VERSION,
        wrappingKeyExtractable: key.extractable,
      };
    },

    async putRecord(input) {
      const identity = normalizeRecordIdentity(input);
      const { db, key } = await context();
      const encrypted = await encryptRecord(cryptoImpl, key, identity, input.value);
      const transaction = db.transaction(RECORDS_STORE, 'readwrite');
      transaction.objectStore(RECORDS_STORE).put(encrypted);
      await transactionDone(transaction);
    },

    async getRecord(input) {
      const identity = normalizeRecordIdentity(input);
      const { db, key } = await context();
      const transaction = db.transaction(RECORDS_STORE, 'readonly');
      const record = await requestResult(
        transaction.objectStore(RECORDS_STORE).get(storageKey(identity)),
      );
      await transactionDone(transaction);
      if (!record) return null;
      return decryptStoredRecord(cryptoImpl, key, record);
    },

    async listRecords({ binding, recordType }) {
      const normalizedBinding = normalizeBrowserE2eeBinding(binding);
      const normalizedRecordType = requireText(recordType, 'record_type');
      const { db, key } = await context();
      const transaction = db.transaction(RECORDS_STORE, 'readonly');
      const records = await requestResult(
        transaction.objectStore(RECORDS_STORE).index('byDevice').getAll([
          normalizedBinding.uid,
          normalizedBinding.deviceId,
          normalizedBinding.signalDeviceId,
        ]),
      );
      await transactionDone(transaction);
      return Promise.all(records
        .filter((record) => record.recordType === normalizedRecordType)
        .map(async (record) => ({
          recordId: record.recordId,
          value: await decryptStoredRecord(cryptoImpl, key, record),
        })));
    },

    async commitOperation({
      binding,
      operationId,
      operationKind,
      records = [],
      deleteRecords = [],
    }) {
      const normalizedBinding = normalizeBrowserE2eeBinding(binding);
      const normalizedOperationId = requireText(operationId, 'operation_id');
      const normalizedKind = requireText(operationKind, 'operation_kind');
      const operationStorageKey = JSON.stringify([
        normalizedBinding.uid,
        normalizedBinding.deviceId,
        normalizedBinding.signalDeviceId,
        normalizedOperationId,
      ]);
      const { db, key } = await context();
      const existingTransaction = db.transaction(OPERATIONS_STORE, 'readonly');
      const existingOperation = await requestResult(
        existingTransaction.objectStore(OPERATIONS_STORE).get(operationStorageKey),
      );
      await transactionDone(existingTransaction);
      if (existingOperation?.state === 'committed') {
        return { committed: true, duplicate: true };
      }

      const encryptedRecords = await Promise.all(records.map((record) => {
        const identity = normalizeRecordIdentity({ ...record, binding: normalizedBinding });
        return encryptRecord(cryptoImpl, key, identity, record.value);
      }));
      const deletedRecordKeys = deleteRecords.map((record) => storageKey(
        normalizeRecordIdentity({ ...record, binding: normalizedBinding }),
      ));
      const transaction = db.transaction([RECORDS_STORE, OPERATIONS_STORE], 'readwrite');
      const recordStore = transaction.objectStore(RECORDS_STORE);
      encryptedRecords.forEach((record) => recordStore.put(record));
      deletedRecordKeys.forEach((recordKey) => recordStore.delete(recordKey));
      transaction.objectStore(OPERATIONS_STORE).add({
        storageKey: operationStorageKey,
        ...normalizedBinding,
        operationId: normalizedOperationId,
        operationKind: normalizedKind,
        state: 'committed',
        committedAt: Date.now(),
      });
      try {
        await transactionDone(transaction);
        return { committed: true, duplicate: false };
      } catch (error) {
        const retryTransaction = db.transaction(OPERATIONS_STORE, 'readonly');
        const committedOperation = await requestResult(
          retryTransaction.objectStore(OPERATIONS_STORE).get(operationStorageKey),
        );
        await transactionDone(retryTransaction);
        if (committedOperation?.state === 'committed') {
          return { committed: true, duplicate: true };
        }
        throw error;
      }
    },

    async clearDevice(binding) {
      const normalized = normalizeBrowserE2eeBinding(binding);
      const db = await database();
      const transaction = db.transaction([RECORDS_STORE, OPERATIONS_STORE], 'readwrite');
      for (const storeName of [RECORDS_STORE, OPERATIONS_STORE]) {
        const index = transaction.objectStore(storeName).index('byDevice');
        const request = index.openKeyCursor([
          normalized.uid,
          normalized.deviceId,
          normalized.signalDeviceId,
        ]);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          transaction.objectStore(storeName).delete(cursor.primaryKey);
          cursor.continue();
        };
      }
      await transactionDone(transaction);
    },

    async close() {
      if (!databasePromise) return;
      const db = await databasePromise;
      db.close();
      databasePromise = null;
    },
  };
}
