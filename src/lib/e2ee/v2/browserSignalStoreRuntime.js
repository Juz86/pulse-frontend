/* global globalThis */
import { BrowserE2eeStoreError } from './browserSecureStore';

const MANIFEST_TYPE = 'bootstrap_manifest';
const MANIFEST_ID = 'current';
const IDENTITY_TYPE = 'identity_key_pair';
const IDENTITY_ID = 'local';
const PREKEY_TYPE = 'one_time_prekey';
const SIGNED_PREKEY_TYPE = 'signed_prekey';
const KYBER_PREKEY_TYPE = 'kyber_prekey';
const KYBER_USAGE_TYPE = 'kyber_usage';
const SESSION_TYPE = 'session';
const SESSION_INDEX_TYPE = 'session_index';
const OPERATION_RESULT_TYPE = 'operation_result';
const OUTBOX_TYPE = 'ciphertext_outbox';
const INBOX_TYPE = 'message_history';

function requirePreKeyCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
    throw new BrowserE2eeStoreError('e2ee_browser_prekey_count_invalid');
  }
  return count;
}
function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value) {
  try {
    const binary = globalThis.atob(String(value || ''));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch (error) {
    throw new BrowserE2eeStoreError('e2ee_browser_base64_invalid', error);
  }
}

function encodeManifest(value) {
  return new globalThis.TextEncoder().encode(JSON.stringify(value));
}

function decodeManifest(value) {
  try {
    return JSON.parse(new globalThis.TextDecoder('utf-8', { fatal: true }).decode(value));
  } catch (error) {
    throw new BrowserE2eeStoreError('e2ee_browser_bootstrap_manifest_invalid', error);
  }
}

function requireRemoteDevice({
  remoteUserId,
  remoteDeviceId,
  remoteSignalDeviceId,
  remoteIdentityVersion,
}) {
  const signalDeviceId = Number(remoteSignalDeviceId);
  const identityVersion = Number(remoteIdentityVersion);
  if (!String(remoteUserId || '').trim() || !String(remoteDeviceId || '').trim()
    || !Number.isSafeInteger(signalDeviceId) || signalDeviceId <= 0
    || !Number.isSafeInteger(identityVersion) || identityVersion < 0) {
    throw new BrowserE2eeStoreError('e2ee_browser_remote_device_invalid');
  }
  return { signalDeviceId, identityVersion };
}

function free(value) {
  try {
    value?.free?.();
  } catch {
    // Best-effort cleanup must not hide the original operation result.
  }
}

function requireId(value, code) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new BrowserE2eeStoreError(code);
  }
  return normalized;
}

function encodeRecord(value) {
  return new globalThis.TextEncoder().encode(JSON.stringify(value));
}

function containsPlaintextField(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsPlaintextField);
  return Object.entries(value).some(([key, child]) => (
    ['plaintext', 'text'].includes(key.toLowerCase()) || containsPlaintextField(child)
  ));
}

async function readRecordList(secureStore, binding, recordType) {
  const records = await secureStore.listRecords({ binding, recordType });
  return records.map(({ recordId, value }) => {
    try {
      return { recordId, value: decodeManifest(value) };
    } finally {
      value.fill(0);
    }
  });
}

function publicBootstrapResult(binding, registrationId, identityKey, signedPreKey, kyberPreKey, preKeys) {
  return {
    protocol: 'pulse_e2ee_v2',
    protocolVersion: 2,
    signalDeviceId: binding.signalDeviceId,
    registrationId,
    identityKey: bytesToBase64(identityKey),
    signedPreKey: {
      keyId: signedPreKey.id,
      publicKey: bytesToBase64(signedPreKey.public_key),
      signature: bytesToBase64(signedPreKey.signature),
    },
    kyberPreKey: {
      keyId: kyberPreKey.id,
      publicKey: bytesToBase64(kyberPreKey.public_key),
      signature: bytesToBase64(kyberPreKey.signature),
    },
    oneTimePreKeys: preKeys.map((preKey) => ({
      keyId: preKey.id,
      publicKey: bytesToBase64(preKey.public_key),
    })),
    capabilities: {
      messageEncryption: true,
      hardwareBackedKeystore: false,
    },
    privateMaterialExportable: false,
  };
}

export function createBrowserSignalStoreRuntime({ api, secureStore, binding } = {}) {
  if (!api || !secureStore || !binding) {
    throw new BrowserE2eeStoreError('e2ee_browser_runtime_dependencies_invalid');
  }

  let runtime = null;

  async function readRecord(recordType, recordId) {
    return secureStore.getRecord({ binding, recordType, recordId });
  }

  async function hydrateFromManifest(manifest) {
    const identityBytes = await readRecord(IDENTITY_TYPE, IDENTITY_ID);
    if (!identityBytes) throw new BrowserE2eeStoreError('e2ee_browser_identity_missing');
    let identityKeyPair;
    try {
      identityKeyPair = api.WasmIdentityKeyPair.deserialize(identityBytes);
    } finally {
      identityBytes.fill(0);
    }

    const stores = {
      identity: new api.WasmInMemIdentityKeyStore(identityKeyPair, manifest.registrationId),
      preKey: new api.WasmInMemPreKeyStore(),
      signedPreKey: new api.WasmInMemSignedPreKeyStore(),
      kyberPreKey: new api.WasmInMemKyberPreKeyStore(),
      session: new api.WasmInMemSessionStore(),
    };
    for (const keyId of manifest.preKeyIds) {
      const bytes = await readRecord(PREKEY_TYPE, String(keyId));
      if (!bytes) throw new BrowserE2eeStoreError('e2ee_browser_prekey_missing');
      try {
        await stores.preKey.import_pre_key(keyId, bytes);
      } finally {
        bytes.fill(0);
      }
    }
    for (const [type, keyId, store, importer] of [
      [SIGNED_PREKEY_TYPE, manifest.signedPreKeyId, stores.signedPreKey, 'import_signed_pre_key'],
      [KYBER_PREKEY_TYPE, manifest.kyberPreKeyId, stores.kyberPreKey, 'import_kyber_pre_key'],
    ]) {
      const bytes = await readRecord(type, String(keyId));
      if (!bytes) throw new BrowserE2eeStoreError(`e2ee_browser_${type}_missing`);
      try {
        await store[importer](keyId, bytes);
      } finally {
        bytes.fill(0);
      }
    }
    runtime = { identityKeyPair, stores, manifest, sessions: new Map() };
    const sessionIndexBytes = await readRecord(SESSION_INDEX_TYPE, 'current');
    if (sessionIndexBytes) {
      let sessionIndex;
      try {
        sessionIndex = decodeManifest(sessionIndexBytes);
      } finally {
        sessionIndexBytes.fill(0);
      }
      if (!Array.isArray(sessionIndex)) {
        throw new BrowserE2eeStoreError('e2ee_browser_session_index_invalid');
      }
      for (const entry of sessionIndex) {
        const { signalDeviceId, identityVersion } = requireRemoteDevice(entry);
        const normalizedEntry = {
          remoteUserId: entry.remoteUserId,
          remoteDeviceId: entry.remoteDeviceId,
          remoteSignalDeviceId: signalDeviceId,
          remoteIdentityVersion: identityVersion,
        };
        const key = `${normalizedEntry.remoteUserId}\u0000${signalDeviceId}`;
        const sessionBytes = await readRecord(SESSION_TYPE, key);
        if (!sessionBytes) throw new BrowserE2eeStoreError('e2ee_browser_session_missing');
        const address = new api.WasmProtocolAddress(normalizedEntry.remoteUserId, signalDeviceId);
        try {
          await stores.session.import_session(address, sessionBytes);
        } finally {
          sessionBytes.fill(0);
          free(address);
        }
        runtime.sessions.set(key, normalizedEntry);
      }
    }
    const kyberUsage = await readRecord(KYBER_USAGE_TYPE, 'current');
    if (kyberUsage) {
      try {
        stores.kyberPreKey.import_kyber_usage(kyberUsage);
      } finally {
        kyberUsage.fill(0);
      }
    }
    return runtime;
  }

  async function loadManifest() {
    const bytes = await readRecord(MANIFEST_TYPE, MANIFEST_ID);
    if (!bytes) return null;
    try {
      const manifest = decodeManifest(bytes);
      if (
        manifest?.version !== 1
        || manifest?.signalDeviceId !== binding.signalDeviceId
        || !Number.isSafeInteger(manifest?.registrationId)
        || !Array.isArray(manifest?.preKeyIds)
        || !manifest?.publicBundle
      ) {
        throw new BrowserE2eeStoreError('e2ee_browser_bootstrap_manifest_invalid');
      }
      return manifest;
    } finally {
      bytes.fill(0);
    }
  }

  return {
    async hydrateIfPresent() {
      if (runtime) return true;
      const manifest = await loadManifest();
      if (!manifest) return false;
      await hydrateFromManifest(manifest);
      return true;
    },

    async bootstrap({ preKeyCount = 20 } = {}) {
      if (runtime || await this.hydrateIfPresent()) return runtime.manifest.publicBundle;
      const count = requirePreKeyCount(preKeyCount);
      const privateKey = api.WasmPrivateKey.generate();
      const publicKey = privateKey.getPublicKey();
      const identityKeyPair = new api.WasmIdentityKeyPair(publicKey, privateKey);
      const registrationId = api.generateRegistrationId();
      const stores = {
        identity: new api.WasmInMemIdentityKeyStore(identityKeyPair, registrationId),
        preKey: new api.WasmInMemPreKeyStore(),
        signedPreKey: new api.WasmInMemSignedPreKeyStore(),
        kyberPreKey: new api.WasmInMemKyberPreKeyStore(),
        session: new api.WasmInMemSessionStore(),
      };
      const preKeys = await api.generatePreKeys(1, count, stores.preKey);
      const signedPreKey = await api.generateSignedPreKey(1, identityKeyPair, stores.signedPreKey);
      const kyberPreKey = await api.generateKyberPreKey(1, identityKeyPair, stores.kyberPreKey);
      const publicBundle = publicBootstrapResult(
        binding,
        registrationId,
        publicKey.serialize(),
        signedPreKey,
        kyberPreKey,
        preKeys,
      );
      const manifest = {
        version: 1,
        signalDeviceId: binding.signalDeviceId,
        registrationId,
        preKeyIds: preKeys.map(({ id }) => id),
        signedPreKeyId: signedPreKey.id,
        kyberPreKeyId: kyberPreKey.id,
        publicBundle,
      };
      const secretBuffers = [];
      try {
        const identityRecord = identityKeyPair.serialize();
        secretBuffers.push(identityRecord);
        const records = [
          { recordType: IDENTITY_TYPE, recordId: IDENTITY_ID, value: identityRecord },
          { recordType: MANIFEST_TYPE, recordId: MANIFEST_ID, value: encodeManifest(manifest) },
        ];
        for (const preKey of preKeys) {
          const record = preKey.record;
          secretBuffers.push(record);
          records.push({ recordType: PREKEY_TYPE, recordId: String(preKey.id), value: record });
        }
        for (const [recordType, key] of [
          [SIGNED_PREKEY_TYPE, signedPreKey],
          [KYBER_PREKEY_TYPE, kyberPreKey],
        ]) {
          const record = key.record;
          secretBuffers.push(record);
          records.push({ recordType, recordId: String(key.id), value: record });
        }
        const committed = await secureStore.commitOperation({
          binding,
          operationId: `bootstrap:${binding.signalDeviceId}:v1`,
          operationKind: 'bootstrap',
          records,
        });
        if (committed.duplicate) {
          preKeys.forEach(free);
          free(signedPreKey);
          free(kyberPreKey);
          Object.values(stores).forEach(free);
          free(identityKeyPair);
          free(publicKey);
          free(privateKey);
          const persisted = await loadManifest();
          if (!persisted) throw new BrowserE2eeStoreError('e2ee_browser_bootstrap_commit_missing');
          await hydrateFromManifest(persisted);
          return runtime.manifest.publicBundle;
        }
      } finally {
        secretBuffers.forEach((bytes) => bytes.fill(0));
      }
      runtime = { identityKeyPair, stores, manifest, sessions: new Map() };
      free(publicKey);
      free(privateKey);
      preKeys.forEach(free);
      free(signedPreKey);
      free(kyberPreKey);
      return publicBundle;
    },

    isBootstrapped() {
      return Boolean(runtime);
    },

    async listSessionDevices({ remoteUserId } = {}) {
      if (!runtime && !(await this.hydrateIfPresent())) return { devices: [] };
      const normalizedUserId = String(remoteUserId || '').trim();
      if (!normalizedUserId) {
        throw new BrowserE2eeStoreError('e2ee_browser_remote_user_invalid');
      }
      return {
        devices: [...runtime.sessions.values()]
          .filter((entry) => entry.remoteUserId === normalizedUserId)
          .map((entry) => ({
            deviceId: entry.remoteDeviceId,
            signalDeviceId: entry.remoteSignalDeviceId,
            identityVersion: entry.remoteIdentityVersion,
          })),
      };
    },

    async invalidateRemoteDevice({
      remoteUserId,
      remoteDeviceId,
      remoteSignalDeviceId,
      remoteIdentityVersion,
      revoked = false,
    } = {}) {
      if (!runtime && !(await this.hydrateIfPresent())) {
        return { invalidated: false, reason: 'not_bootstrapped' };
      }
      const { signalDeviceId, identityVersion } = requireRemoteDevice({
        remoteUserId,
        remoteDeviceId,
        remoteSignalDeviceId,
        remoteIdentityVersion,
      });
      const key = `${remoteUserId}\u0000${signalDeviceId}`;
      const existing = runtime.sessions.get(key);
      if (!existing || existing.remoteDeviceId !== remoteDeviceId) {
        return { invalidated: false, reason: 'session_missing' };
      }
      const remoteAddress = new api.WasmProtocolAddress(remoteUserId, signalDeviceId);
      const nextSessions = new Map(runtime.sessions);
      nextSessions.delete(key);
      const sessionIndexBytes = encodeManifest([...nextSessions.values()]);
      try {
        await runtime.stores.session.delete_session(remoteAddress);
        await secureStore.commitOperation({
          binding,
          operationId: [
            'invalidate',
            remoteUserId,
            remoteDeviceId,
            signalDeviceId,
            identityVersion,
            revoked ? 'revoked' : 'identity',
          ].join(':'),
          operationKind: 'session_invalidate',
          records: [{
            recordType: SESSION_INDEX_TYPE,
            recordId: 'current',
            value: sessionIndexBytes,
          }],
          deleteRecords: [{ recordType: SESSION_TYPE, recordId: key }],
        });
        // The WASM identity store is intentionally in-memory. Recreate its TOFU
        // cache after an authenticated lifecycle event, matching a cold reload;
        // durable identityVersion metadata still gates every restored session.
        const previousIdentityStore = runtime.stores.identity;
        runtime.stores.identity = new api.WasmInMemIdentityKeyStore(
          runtime.identityKeyPair,
          runtime.manifest.registrationId,
        );
        free(previousIdentityStore);
        runtime.sessions = nextSessions;
      } catch (error) {
        throw new BrowserE2eeStoreError('e2ee_browser_persistence_failed', error);
      } finally {
        sessionIndexBytes.fill(0);
        free(remoteAddress);
      }
      return { invalidated: true, revoked };
    },

    async saveOutbox({ clientMessageId, message, expectedRecipientDevices } = {}) {
      if (!runtime && !(await this.hydrateIfPresent())) {
        throw new BrowserE2eeStoreError('e2ee_browser_not_bootstrapped');
      }
      const recordId = requireId(clientMessageId, 'e2ee_browser_outbox_id_invalid');
      if (!message || message.clientMessageId !== recordId
        || !Array.isArray(message.recipientEnvelopes)
        || message.recipientEnvelopes.length < 1
        || !Array.isArray(expectedRecipientDevices)
        || containsPlaintextField(message)) {
        throw new BrowserE2eeStoreError('e2ee_browser_outbox_invalid');
      }
      const bytes = encodeRecord({ message, expectedRecipientDevices });
      try {
        await secureStore.putRecord({
          binding,
          recordType: OUTBOX_TYPE,
          recordId,
          value: bytes,
        });
      } finally {
        bytes.fill(0);
      }
      return { stored: true, clientMessageId: recordId };
    },

    async listOutbox() {
      if (!runtime && !(await this.hydrateIfPresent())) return { messages: [] };
      const records = await readRecordList(secureStore, binding, OUTBOX_TYPE);
      return { messages: records.map(({ value }) => value) };
    },

    async removeOutbox({ clientMessageId } = {}) {
      const recordId = requireId(clientMessageId, 'e2ee_browser_outbox_id_invalid');
      await secureStore.commitOperation({
        binding,
        operationId: `outbox-remove:${recordId}`,
        operationKind: 'outbox_remove',
        deleteRecords: [{ recordType: OUTBOX_TYPE, recordId }],
      });
      return { removed: true, clientMessageId: recordId };
    },

    async storeReceivedMessage(message = {}) {
      if (!runtime && !(await this.hydrateIfPresent())) {
        throw new BrowserE2eeStoreError('e2ee_browser_not_bootstrapped');
      }
      const recordId = requireId(message.messageId, 'e2ee_browser_message_id_invalid');
      if (!message.conversationId || typeof message.plaintext !== 'string') {
        throw new BrowserE2eeStoreError('e2ee_browser_message_history_invalid');
      }
      const bytes = encodeRecord(message);
      try {
        await secureStore.putRecord({
          binding,
          recordType: INBOX_TYPE,
          recordId,
          value: bytes,
        });
      } finally {
        bytes.fill(0);
      }
      return { stored: true, messageId: recordId };
    },

    async listReceivedMessages({ conversationId } = {}) {
      if (!runtime && !(await this.hydrateIfPresent())) return { messages: [] };
      const normalizedConversationId = requireId(
        conversationId,
        'e2ee_browser_conversation_id_invalid',
      );
      const records = await readRecordList(secureStore, binding, INBOX_TYPE);
      return {
        messages: records
          .map(({ value }) => value)
          .filter((message) => message.conversationId === normalizedConversationId),
      };
    },

    async clearReceivedMessages({ conversationId } = {}) {
      const normalizedConversationId = requireId(
        conversationId,
        'e2ee_browser_conversation_id_invalid',
      );
      const records = await readRecordList(secureStore, binding, INBOX_TYPE);
      const recordIds = records
        .filter(({ value }) => value.conversationId === normalizedConversationId)
        .map(({ recordId }) => recordId)
        .sort();
      if (recordIds.length === 0) return { cleared: 0 };
      await secureStore.commitOperation({
        binding,
        operationId: `history-clear:${normalizedConversationId}:${recordIds.join(',')}`,
        operationKind: 'history_clear',
        deleteRecords: recordIds.map((recordId) => ({
          recordType: INBOX_TYPE,
          recordId,
        })),
      });
      return { cleared: recordIds.length };
    },

    async encrypt({
      operationId,
      remoteUserId,
      remoteDeviceId,
      remoteSignalDeviceId,
      remoteIdentityVersion,
      plaintext,
      remoteBundle,
    } = {}) {
      if (!runtime && !(await this.hydrateIfPresent())) {
        throw new BrowserE2eeStoreError('e2ee_browser_not_bootstrapped');
      }
      const resultId = String(operationId || '').trim();
      if (!resultId) throw new BrowserE2eeStoreError('e2ee_browser_operation_id_invalid');
      const operationKey = `encrypt:${resultId}`;
      const previousResult = await readRecord(OPERATION_RESULT_TYPE, operationKey);
      if (previousResult) {
        try {
          return decodeManifest(previousResult);
        } finally {
          previousResult.fill(0);
        }
      }
      const { signalDeviceId, identityVersion } = requireRemoteDevice({
        remoteUserId,
        remoteDeviceId,
        remoteSignalDeviceId,
        remoteIdentityVersion,
      });
      const key = `${remoteUserId}\u0000${signalDeviceId}`;
      const existing = runtime.sessions.get(key);
      if (existing && (existing.remoteDeviceId !== remoteDeviceId
        || existing.remoteIdentityVersion !== identityVersion)) {
        throw new BrowserE2eeStoreError('e2ee_browser_remote_identity_changed');
      }
      const plaintextBytes = new globalThis.TextEncoder().encode(String(plaintext || ''));
      if (!plaintextBytes.length) {
        plaintextBytes.fill(0);
        throw new BrowserE2eeStoreError('e2ee_browser_plaintext_required');
      }
      const remoteAddress = new api.WasmProtocolAddress(remoteUserId, signalDeviceId);
      const localAddress = new api.WasmProtocolAddress(binding.uid, binding.signalDeviceId);
      let sessionBytes;
      let ciphertextResult;
      const temporaryBuffers = [];
      try {
        if (!(await runtime.stores.session.has_session(remoteAddress))) {
          if (!remoteBundle || Number(remoteBundle.signalDeviceId) !== signalDeviceId) {
            throw new BrowserE2eeStoreError('e2ee_browser_remote_bundle_required');
          }
          const identityKeyBytes = base64ToBytes(remoteBundle.identityKey);
          const signedKeyBytes = base64ToBytes(remoteBundle.signedPreKey?.publicKey);
          const signedSignature = base64ToBytes(remoteBundle.signedPreKey?.signature);
          const preKeyBytes = base64ToBytes(remoteBundle.oneTimePreKey?.publicKey);
          const kyberKeyBytes = base64ToBytes(remoteBundle.kyberPreKey?.publicKey);
          const kyberSignature = base64ToBytes(remoteBundle.kyberPreKey?.signature);
          temporaryBuffers.push(
            identityKeyBytes,
            signedKeyBytes,
            signedSignature,
            preKeyBytes,
            kyberKeyBytes,
            kyberSignature,
          );
          const identityKey = api.WasmPublicKey.deserialize(identityKeyBytes);
          const signedKey = api.WasmPublicKey.deserialize(signedKeyBytes);
          try {
            await api.processPreKeyBundle(
              remoteAddress,
              localAddress,
              Number(remoteBundle.registrationId),
              identityKey,
              Number(remoteBundle.signedPreKey?.keyId),
              signedKey,
              signedSignature,
              Number(remoteBundle.oneTimePreKey?.keyId),
              preKeyBytes,
              Number(remoteBundle.kyberPreKey?.keyId),
              kyberKeyBytes,
              kyberSignature,
              runtime.stores.session,
              runtime.stores.identity,
            );
          } finally {
            free(identityKey);
            free(signedKey);
          }
        }
        ciphertextResult = await api.encryptMessage(
          plaintextBytes,
          remoteAddress,
          localAddress,
          runtime.stores.session,
          runtime.stores.identity,
        );
        const result = {
          protocol: 'pulse_e2ee_v2',
          protocolVersion: 2,
          envelopeType: ciphertextResult.message_type === api.message_type_pre_key()
            ? 'prekey'
            : 'message',
          ciphertext: bytesToBase64(ciphertextResult.body),
        };
        sessionBytes = await runtime.stores.session.export_session(remoteAddress);
        const entry = {
          remoteUserId,
          remoteDeviceId,
          remoteSignalDeviceId: signalDeviceId,
          remoteIdentityVersion: identityVersion,
        };
        const nextSessions = new Map(runtime.sessions);
        nextSessions.set(key, entry);
        const sessionIndexBytes = encodeManifest([...nextSessions.values()]);
        const operationResultBytes = encodeManifest(result);
        temporaryBuffers.push(sessionIndexBytes, operationResultBytes);
        try {
          await secureStore.commitOperation({
          binding,
          operationId: operationKey,
          operationKind: 'encrypt',
          records: [
            { recordType: SESSION_TYPE, recordId: key, value: sessionBytes },
            { recordType: SESSION_INDEX_TYPE, recordId: 'current', value: sessionIndexBytes },
            { recordType: OPERATION_RESULT_TYPE, recordId: operationKey, value: operationResultBytes },
          ],
          });
        } catch (error) {
          throw new BrowserE2eeStoreError('e2ee_browser_persistence_failed', error);
        }
        runtime.sessions = nextSessions;
        return result;
      } finally {
        plaintextBytes.fill(0);
        sessionBytes?.fill(0);
        temporaryBuffers.forEach((bytes) => bytes.fill(0));
        free(ciphertextResult);
        free(remoteAddress);
        free(localAddress);
      }
    },

    async decrypt({
      operationId,
      remoteUserId,
      remoteDeviceId,
      remoteSignalDeviceId,
      remoteIdentityVersion,
      envelopeType,
      ciphertext,
    } = {}) {
      if (!runtime && !(await this.hydrateIfPresent())) {
        throw new BrowserE2eeStoreError('e2ee_browser_not_bootstrapped');
      }
      const resultId = String(operationId || '').trim();
      if (!resultId) throw new BrowserE2eeStoreError('e2ee_browser_operation_id_invalid');
      const operationKey = `decrypt:${resultId}`;
      const previousResult = await readRecord(OPERATION_RESULT_TYPE, operationKey);
      if (previousResult) {
        try {
          return decodeManifest(previousResult);
        } finally {
          previousResult.fill(0);
        }
      }
      const { signalDeviceId, identityVersion } = requireRemoteDevice({
        remoteUserId,
        remoteDeviceId,
        remoteSignalDeviceId,
        remoteIdentityVersion,
      });
      if (!['prekey', 'message'].includes(envelopeType)) {
        throw new BrowserE2eeStoreError('e2ee_browser_envelope_type_invalid');
      }
      const key = `${remoteUserId}\u0000${signalDeviceId}`;
      const existing = runtime.sessions.get(key);
      if (existing && (existing.remoteDeviceId !== remoteDeviceId
        || existing.remoteIdentityVersion !== identityVersion)) {
        throw new BrowserE2eeStoreError('e2ee_browser_remote_identity_changed');
      }
      const remoteAddress = new api.WasmProtocolAddress(remoteUserId, signalDeviceId);
      const localAddress = new api.WasmProtocolAddress(binding.uid, binding.signalDeviceId);
      const ciphertextBytes = base64ToBytes(ciphertext);
      let sessionBytes;
      let decryptedResult;
      const temporaryBuffers = [];
      try {
        const messageType = envelopeType === 'prekey'
          ? api.message_type_pre_key()
          : api.message_type_signal();
        decryptedResult = await api.decryptMessage(
          ciphertextBytes,
          messageType,
          remoteAddress,
          localAddress,
          runtime.stores.session,
          runtime.stores.identity,
          runtime.stores.preKey,
          runtime.stores.signedPreKey,
          runtime.stores.kyberPreKey,
        );
        const plaintextBytes = decryptedResult.plaintext;
        let plaintext;
        try {
          plaintext = new globalThis.TextDecoder('utf-8', { fatal: true }).decode(plaintextBytes);
        } finally {
          plaintextBytes.fill(0);
        }
        const result = { protocol: 'pulse_e2ee_v2', protocolVersion: 2, plaintext };
        sessionBytes = await runtime.stores.session.export_session(remoteAddress);
        const entry = {
          remoteUserId,
          remoteDeviceId,
          remoteSignalDeviceId: signalDeviceId,
          remoteIdentityVersion: identityVersion,
        };
        const nextSessions = new Map(runtime.sessions);
        nextSessions.set(key, entry);
        const nextManifest = {
          ...runtime.manifest,
          preKeyIds: [...runtime.manifest.preKeyIds],
        };
        const sessionIndexBytes = encodeManifest([...nextSessions.values()]);
        const operationResultBytes = encodeManifest(result);
        temporaryBuffers.push(sessionIndexBytes, operationResultBytes);
        const records = [
          { recordType: SESSION_TYPE, recordId: key, value: sessionBytes },
          { recordType: SESSION_INDEX_TYPE, recordId: 'current', value: sessionIndexBytes },
          { recordType: OPERATION_RESULT_TYPE, recordId: operationKey, value: operationResultBytes },
        ];
        const deleteRecords = [];
        if (decryptedResult.oneTimePreKeyId !== undefined) {
          nextManifest.preKeyIds = nextManifest.preKeyIds
            .filter((id) => id !== decryptedResult.oneTimePreKeyId);
          const manifestBytes = encodeManifest(nextManifest);
          temporaryBuffers.push(manifestBytes);
          records.push({
            recordType: MANIFEST_TYPE,
            recordId: MANIFEST_ID,
            value: manifestBytes,
          });
          deleteRecords.push({
            recordType: PREKEY_TYPE,
            recordId: String(decryptedResult.oneTimePreKeyId),
          });
        }
        if (decryptedResult.kyberPreKeyId !== undefined) {
          const usage = runtime.stores.kyberPreKey.export_kyber_usage();
          temporaryBuffers.push(usage);
          records.push({ recordType: KYBER_USAGE_TYPE, recordId: 'current', value: usage });
        }
        try {
          await secureStore.commitOperation({
            binding,
            operationId: operationKey,
            operationKind: 'decrypt',
            records,
            deleteRecords,
          });
        } catch (error) {
          throw new BrowserE2eeStoreError('e2ee_browser_persistence_failed', error);
        }
        runtime.sessions = nextSessions;
        runtime.manifest = nextManifest;
        return result;
      } finally {
        ciphertextBytes.fill(0);
        sessionBytes?.fill(0);
        temporaryBuffers.forEach((bytes) => bytes.fill(0));
        free(decryptedResult);
        free(remoteAddress);
        free(localAddress);
      }
    },

    close() {
      if (!runtime) return;
      Object.values(runtime.stores).forEach(free);
      free(runtime.identityKeyPair);
      runtime = null;
    },
  };
}
