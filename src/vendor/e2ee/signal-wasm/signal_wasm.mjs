/* @ts-self-types="./signal_wasm.d.ts" */

export class WasmCiphertext {
    static __wrap(ptr) {
        const obj = Object.create(WasmCiphertext.prototype);
        obj.__wbg_ptr = ptr;
        WasmCiphertextFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmCiphertextFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmciphertext_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get body() {
        const ret = wasm.wasmciphertext_body(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    get message_type() {
        const ret = wasm.wasmciphertext_message_type(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WasmCiphertext.prototype[Symbol.dispose] = WasmCiphertext.prototype.free;

/**
 * Result of `decryptMessage`: the plaintext plus the one-time pre-key ids the
 * engine consumed while establishing a new session.
 *
 * The engine learns these ids internally (`pre_key_used` in
 * `rust/protocol/src/session_management.rs`) but upstream surfaces only the
 * plaintext. Signal's own clients don't need them returned — their store
 * callbacks are app code and delete/mark durably at call time. Our stores sit
 * behind the wasm boundary, so the ids are reported here for the TS layer to
 * tombstone in its durable store; without that, a consumed one-time kyber
 * record is re-imported on next hydration and its KEM private key is reused
 * across restarts. All id fields are `undefined` for Whisper
 * (non-prekey) decrypts and for prekey messages that decrypted against an
 * existing session. Under concurrent decrypts sharing one store set a caller
 * may see a superset of its own consumed ids — every reported id was
 * genuinely consumed, so tombstoning it is always safe.
 */
export class WasmDecryptResult {
    static __wrap(ptr) {
        const obj = Object.create(WasmDecryptResult.prototype);
        obj.__wbg_ptr = ptr;
        WasmDecryptResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmDecryptResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmdecryptresult_free(ptr, 0);
    }
    /**
     * The kyber pre-key consumed by this decrypt (one-time or last-resort),
     * if any — the caller knows which ids are one-time. Tombstone it in the
     * durable store. libsignal's `mark_kyber_pre_key_used` makes no
     * one-time/last-resort distinction
     * (rust/protocol/src/storage/traits.rs:129-133 @ b5121d0).
     * @returns {number | undefined}
     */
    get kyberPreKeyId() {
        const ret = wasm.wasmdecryptresult_kyberPreKeyId(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * The one-time X25519 pre-key consumed (already removed from the engine
     * store by the decrypt itself), if any. Tombstone it in the durable
     * store.
     * @returns {number | undefined}
     */
    get oneTimePreKeyId() {
        const ret = wasm.wasmdecryptresult_oneTimePreKeyId(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {Uint8Array}
     */
    get plaintext() {
        const ret = wasm.wasmdecryptresult_plaintext(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * The signed pre-key paired with the consumed kyber key in the
     * anti-replay record. Correlation only — signed pre-keys are not
     * consumed.
     * @returns {number | undefined}
     */
    get signedPreKeyId() {
        const ret = wasm.wasmdecryptresult_signedPreKeyId(this.__wbg_ptr);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
}
if (Symbol.dispose) WasmDecryptResult.prototype[Symbol.dispose] = WasmDecryptResult.prototype.free;

export class WasmGroupIdentifier {
    static __wrap(ptr) {
        const obj = Object.create(WasmGroupIdentifier.prototype);
        obj.__wbg_ptr = ptr;
        WasmGroupIdentifierFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmGroupIdentifierFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmgroupidentifier_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get serialize() {
        const ret = wasm.wasmgroupidentifier_serialize(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmGroupIdentifier.prototype[Symbol.dispose] = WasmGroupIdentifier.prototype.free;

export class WasmGroupMasterKey {
    static __wrap(ptr) {
        const obj = Object.create(WasmGroupMasterKey.prototype);
        obj.__wbg_ptr = ptr;
        WasmGroupMasterKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmGroupMasterKeyFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmgroupmasterkey_free(ptr, 0);
    }
    /**
     * @returns {WasmGroupIdentifier}
     */
    derive_identifier() {
        const ret = wasm.wasmgroupmasterkey_derive_identifier(this.__wbg_ptr);
        return WasmGroupIdentifier.__wrap(ret);
    }
    /**
     * @returns {WasmGroupSecretParams}
     */
    derive_secret_params() {
        const ret = wasm.wasmgroupmasterkey_derive_secret_params(this.__wbg_ptr);
        return WasmGroupSecretParams.__wrap(ret);
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {WasmGroupMasterKey}
     */
    static from_bytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmgroupmasterkey_from_bytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmGroupMasterKey.__wrap(ret[0]);
    }
    /**
     * @returns {WasmGroupMasterKey}
     */
    static generate() {
        const ret = wasm.wasmgroupmasterkey_generate();
        return WasmGroupMasterKey.__wrap(ret);
    }
    /**
     * @returns {Uint8Array}
     */
    get serialize() {
        const ret = wasm.wasmgroupmasterkey_serialize(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmGroupMasterKey.prototype[Symbol.dispose] = WasmGroupMasterKey.prototype.free;

export class WasmGroupSecretParams {
    static __wrap(ptr) {
        const obj = Object.create(WasmGroupSecretParams.prototype);
        obj.__wbg_ptr = ptr;
        WasmGroupSecretParamsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmGroupSecretParamsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmgroupsecretparams_free(ptr, 0);
    }
    /**
     * @returns {WasmGroupIdentifier}
     */
    get_identifier() {
        const ret = wasm.wasmgroupsecretparams_get_identifier(this.__wbg_ptr);
        return WasmGroupIdentifier.__wrap(ret);
    }
    /**
     * Returns the 32-byte **master key**, not the (289-byte) group secret
     * params. Named explicitly so no future caller mistakes it for the full
     * params encoding (see the 0.5.0 CHANGELOG entry).
     * @returns {Uint8Array}
     */
    get serialize_master_key() {
        const ret = wasm.wasmgroupsecretparams_serialize_master_key(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmGroupSecretParams.prototype[Symbol.dispose] = WasmGroupSecretParams.prototype.free;

/**
 * IdentityKeyPair — wraps a (PublicKey, PrivateKey) pair used as the long-term identity.
 */
export class WasmIdentityKeyPair {
    static __wrap(ptr) {
        const obj = Object.create(WasmIdentityKeyPair.prototype);
        obj.__wbg_ptr = ptr;
        WasmIdentityKeyPairFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmIdentityKeyPairFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmidentitykeypair_free(ptr, 0);
    }
    /**
     * Deserialize from standard protobuf format.
     * @param {Uint8Array} data
     * @returns {WasmIdentityKeyPair}
     */
    static deserialize(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmidentitykeypair_deserialize(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmIdentityKeyPair.__wrap(ret[0]);
    }
    /**
     * @param {WasmPublicKey} public_key
     * @param {WasmPrivateKey} private_key
     */
    constructor(public_key, private_key) {
        _assertClass(public_key, WasmPublicKey);
        _assertClass(private_key, WasmPrivateKey);
        const ret = wasm.wasmidentitykeypair_new(public_key.__wbg_ptr, private_key.__wbg_ptr);
        this.__wbg_ptr = ret;
        WasmIdentityKeyPairFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {WasmPrivateKey}
     */
    get private_key() {
        const ret = wasm.wasmidentitykeypair_private_key(this.__wbg_ptr);
        return WasmPrivateKey.__wrap(ret);
    }
    /**
     * @returns {WasmPublicKey}
     */
    get public_key() {
        const ret = wasm.wasmidentitykeypair_public_key(this.__wbg_ptr);
        return WasmPublicKey.__wrap(ret);
    }
    /**
     * Serialize to the standard protobuf format used by libsignal.
     * @returns {Uint8Array}
     */
    serialize() {
        const ret = wasm.wasmidentitykeypair_serialize(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmIdentityKeyPair.prototype[Symbol.dispose] = WasmIdentityKeyPair.prototype.free;

export class WasmInMemIdentityKeyStore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmInMemIdentityKeyStoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasminmemidentitykeystore_free(ptr, 0);
    }
    /**
     * @param {WasmIdentityKeyPair} identity_key_pair
     * @param {number} registration_id
     */
    constructor(identity_key_pair, registration_id) {
        _assertClass(identity_key_pair, WasmIdentityKeyPair);
        const ret = wasm.wasminmemidentitykeystore_new(identity_key_pair.__wbg_ptr, registration_id);
        this.__wbg_ptr = ret;
        WasmInMemIdentityKeyStoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WasmInMemIdentityKeyStore.prototype[Symbol.dispose] = WasmInMemIdentityKeyStore.prototype.free;

export class WasmInMemKyberPreKeyStore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmInMemKyberPreKeyStoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasminmemkyberprekeystore_free(ptr, 0);
    }
    /**
     * @param {number} id
     * @returns {Promise<Uint8Array | undefined>}
     */
    export_kyber_pre_key(id) {
        const ret = wasm.wasminmemkyberprekeystore_export_kyber_pre_key(this.__wbg_ptr, id);
        return ret;
    }
    /**
     * Export the anti-replay memory — the set of `(kyberId, signedPreKeyId,
     * baseKey)` triples already seen — for durable storage. Persist it
     * alongside the kyber records and re-import at hydration; without it the
     * replay guard resets on every reload. Format: version byte (1),
     * u32 BE record count, then per record `kyberId u32 BE || signedPreKeyId
     * u32 BE || 33-byte compressed base key`.
     * @returns {Uint8Array}
     */
    export_kyber_usage() {
        const ret = wasm.wasminmemkyberprekeystore_export_kyber_usage(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @param {number} id
     * @param {Uint8Array} record_bytes
     * @returns {Promise<void>}
     */
    import_kyber_pre_key(id, record_bytes) {
        const ptr0 = passArray8ToWasm0(record_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemkyberprekeystore_import_kyber_pre_key(this.__wbg_ptr, id, ptr0, len0);
        return ret;
    }
    /**
     * Merge a previously exported usage set back in. Union semantics with
     * dedup, so re-importing the same export is a no-op. Unknown version,
     * malformed length, or an invalid base key is a hard error.
     * @param {Uint8Array} bytes
     */
    import_kyber_usage(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemkyberprekeystore_import_kyber_usage(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    constructor() {
        const ret = wasm.wasminmemkyberprekeystore_new();
        this.__wbg_ptr = ret;
        WasmInMemKyberPreKeyStoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Evict a Kyber pre-key record from the store. Canonical clients delete a
     * consumed ONE-TIME Kyber pre-key and record NO anti-replay triple for it
     * (Signal-iOS removes the row when `preKey.isOneTime`,
     * `SignalServiceKit/Axolotl/PreKeyStore.swift:199-225` @ 58cc49ec1;
     * Signal-Desktop writes `kyberPreKey_triples` only for last-resort keys,
     * `ts/SignalProtocolStore.preload.ts:536-570` @ de8fe1e70; libsignal trait
     * contract `rust/protocol/src/storage/traits.rs:116-138` @ b5121d0 leaves
     * one-time deletion to the caller). Removing the record also prunes the
     * `(kyber_id, signed_prekey_id, base_key)` triples held for that id,
     * because a replay against an evicted key fails earlier at
     * `get_kyber_pre_key` (`InvalidKyberPreKeyId`) before the base-key check
     * is ever reached. Last-resort records must NOT be evicted here; their
     * triples must persist so a replay against the live last-resort key is
     * still rejected.
     * Idempotent: returns whether a record was present.
     * @param {number} id
     * @returns {boolean}
     */
    remove_kyber_pre_key(id) {
        const ret = wasm.wasminmemkyberprekeystore_remove_kyber_pre_key(this.__wbg_ptr, id);
        return ret !== 0;
    }
}
if (Symbol.dispose) WasmInMemKyberPreKeyStore.prototype[Symbol.dispose] = WasmInMemKyberPreKeyStore.prototype.free;

export class WasmInMemPreKeyStore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmInMemPreKeyStoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasminmemprekeystore_free(ptr, 0);
    }
    /**
     * @param {number} id
     * @returns {Promise<Uint8Array | undefined>}
     */
    export_pre_key(id) {
        const ret = wasm.wasminmemprekeystore_export_pre_key(this.__wbg_ptr, id);
        return ret;
    }
    /**
     * @param {number} id
     * @param {Uint8Array} record_bytes
     * @returns {Promise<void>}
     */
    import_pre_key(id, record_bytes) {
        const ptr0 = passArray8ToWasm0(record_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemprekeystore_import_pre_key(this.__wbg_ptr, id, ptr0, len0);
        return ret;
    }
    constructor() {
        const ret = wasm.wasminmemprekeystore_new();
        this.__wbg_ptr = ret;
        WasmInMemPreKeyStoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WasmInMemPreKeyStore.prototype[Symbol.dispose] = WasmInMemPreKeyStore.prototype.free;

export class WasmInMemSenderKeyStore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmInMemSenderKeyStoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasminmemsenderkeystore_free(ptr, 0);
    }
    /**
     * @param {WasmProtocolAddress} address
     * @param {string} distribution_id
     * @returns {Promise<Uint8Array | undefined>}
     */
    export_sender_key(address, distribution_id) {
        _assertClass(address, WasmProtocolAddress);
        const ptr0 = passStringToWasm0(distribution_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemsenderkeystore_export_sender_key(this.__wbg_ptr, address.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * @param {WasmProtocolAddress} address
     * @param {string} distribution_id
     * @param {Uint8Array} record_bytes
     * @returns {Promise<void>}
     */
    import_sender_key(address, distribution_id, record_bytes) {
        _assertClass(address, WasmProtocolAddress);
        const ptr0 = passStringToWasm0(distribution_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(record_bytes, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemsenderkeystore_import_sender_key(this.__wbg_ptr, address.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
    constructor() {
        const ret = wasm.wasminmemsenderkeystore_new();
        this.__wbg_ptr = ret;
        WasmInMemSenderKeyStoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Delete the sender-key record for `(address, distribution_id)`.
     *
     * Rotation must delete the record before re-creating it, otherwise
     * `createSenderKeyDistribution` reuses the existing chain and removed
     * group members keep deriving future message keys. Returns `true` if a
     * record was actually removed.
     * @param {WasmProtocolAddress} address
     * @param {string} distribution_id
     * @returns {Promise<boolean>}
     */
    remove_sender_key(address, distribution_id) {
        _assertClass(address, WasmProtocolAddress);
        const ptr0 = passStringToWasm0(distribution_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemsenderkeystore_remove_sender_key(this.__wbg_ptr, address.__wbg_ptr, ptr0, len0);
        return ret;
    }
}
if (Symbol.dispose) WasmInMemSenderKeyStore.prototype[Symbol.dispose] = WasmInMemSenderKeyStore.prototype.free;

export class WasmInMemSessionStore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmInMemSessionStoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasminmemsessionstore_free(ptr, 0);
    }
    /**
     * @param {WasmProtocolAddress} address
     * @returns {Promise<void>}
     */
    archive_session(address) {
        _assertClass(address, WasmProtocolAddress);
        const ret = wasm.wasminmemsessionstore_archive_session(this.__wbg_ptr, address.__wbg_ptr);
        return ret;
    }
    /**
     * Delete the session record for `address` entirely.
     *
     * Canonical libsignal's `SessionStore` trait has no `delete_session`
     * (`rust/protocol/src/storage/traits.rs:150-160` @ b5121d0); this removes
     * the wrapper-owned in-memory record. Intended for no-prior-session
     * rollback after a durable-save failure: a first-contact decrypt/encrypt
     * may create a session in the engine while the durable save fails, leaving
     * the engine state out of step with storage. Removing the record lets the
     * retry reprocess the PreKey ciphertext as a first-contact message.
     *
     * This is NOT `archive_session` — archive rotates the live ratchet state
     * into the record's previous-states list so straggler messages still
     * decrypt; delete removes the record completely.
     *
     * Returns `true` if a record was actually removed. A missing address
     * returns `false`.
     * @param {WasmProtocolAddress} address
     * @returns {Promise<boolean>}
     */
    delete_session(address) {
        _assertClass(address, WasmProtocolAddress);
        const ret = wasm.wasminmemsessionstore_delete_session(this.__wbg_ptr, address.__wbg_ptr);
        return ret;
    }
    /**
     * @param {WasmProtocolAddress} address
     * @returns {Promise<Uint8Array | undefined>}
     */
    export_session(address) {
        _assertClass(address, WasmProtocolAddress);
        const ret = wasm.wasminmemsessionstore_export_session(this.__wbg_ptr, address.__wbg_ptr);
        return ret;
    }
    /**
     * @param {WasmProtocolAddress} address
     * @returns {Promise<boolean>}
     */
    has_session(address) {
        _assertClass(address, WasmProtocolAddress);
        const ret = wasm.wasminmemsessionstore_has_session(this.__wbg_ptr, address.__wbg_ptr);
        return ret;
    }
    /**
     * @param {WasmProtocolAddress} address
     * @param {Uint8Array} session_bytes
     * @returns {Promise<void>}
     */
    import_session(address, session_bytes) {
        _assertClass(address, WasmProtocolAddress);
        const ptr0 = passArray8ToWasm0(session_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemsessionstore_import_session(this.__wbg_ptr, address.__wbg_ptr, ptr0, len0);
        return ret;
    }
    constructor() {
        const ret = wasm.wasminmemsessionstore_new();
        this.__wbg_ptr = ret;
        WasmInMemSessionStoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Whether the live session for `address` is still on ratchet key
     * `key_bytes` — the match half of the sender-side retry-request handler
     * (monorepo `docs/signal-retry-request-design.md` R10).
     *
     * Thin wrap over `SessionRecord::current_ratchet_key_matches`
     * (`rust/protocol/src/state/session.rs:950` @ b056faa6d), which compares
     * against the current session state's `sender_ratchet_key()` — exactly
     * the load → match → archive flow libsignal's own harnesses run before
     * re-sending (`rust/protocol/src/session_management.rs:2266-2286`,
     * `rust/protocol/test-support/src/lib.rs:368-385` @ b056faa6d). A
     * missing record, or a record with no current state, yields `Ok(false)`
     * (the upstream method already maps no-current-state to false), so a
     * healed or never-established session never matches. Malformed key
     * bytes surface as an error rather than a false negative.
     * @param {WasmProtocolAddress} address
     * @param {Uint8Array} key_bytes
     * @returns {Promise<boolean>}
     */
    session_current_ratchet_key_matches(address, key_bytes) {
        _assertClass(address, WasmProtocolAddress);
        const ptr0 = passArray8ToWasm0(key_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemsessionstore_session_current_ratchet_key_matches(this.__wbg_ptr, address.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Return the remote registration id stored in the current session state
     * for `address`, or `None` when no record exists or the record has no
     * current state.
     *
     * This mirrors the value canonical Signal-Desktop sends in fan-out
     * metadata: `OutgoingMessage.preload.ts:537` @ `de8fe1e70` reads
     * `sessionCache.getSession(device.id).remoteRegistrationId()` so the
     * server's stale-registration check can force a session refresh when the
     * recipient re-registers. That check lives in Signal-Server's
     * `MessageSender.java:402-417` @ `5eb1a76e9`.
     *
     * `archive_session` rotates the live ratchet into the record's previous
     * states and leaves no current state; libsignal's
     * `SessionRecord::session_state()` returns `None` there
     * (`rust/protocol/src/state/session.rs:775-780` @ `b5121d0`), and
     * `SessionRecord::remote_registration_id()` returns `SessionNotFound`
     * (`rust/protocol/src/state/session.rs:847-856` @ `b5121d0`). This
     * wrapper maps both "no record" and "no current state" to `Ok(None)` so
     * callers can treat an archived record the same as a missing one.
     * @param {WasmProtocolAddress} address
     * @returns {Promise<number | undefined>}
     */
    session_remote_registration_id(address) {
        _assertClass(address, WasmProtocolAddress);
        const ret = wasm.wasminmemsessionstore_session_remote_registration_id(this.__wbg_ptr, address.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WasmInMemSessionStore.prototype[Symbol.dispose] = WasmInMemSessionStore.prototype.free;

export class WasmInMemSignedPreKeyStore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmInMemSignedPreKeyStoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasminmemsignedprekeystore_free(ptr, 0);
    }
    /**
     * @param {number} id
     * @returns {Promise<Uint8Array | undefined>}
     */
    export_signed_pre_key(id) {
        const ret = wasm.wasminmemsignedprekeystore_export_signed_pre_key(this.__wbg_ptr, id);
        return ret;
    }
    /**
     * @param {number} id
     * @param {Uint8Array} record_bytes
     * @returns {Promise<void>}
     */
    import_signed_pre_key(id, record_bytes) {
        const ptr0 = passArray8ToWasm0(record_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasminmemsignedprekeystore_import_signed_pre_key(this.__wbg_ptr, id, ptr0, len0);
        return ret;
    }
    constructor() {
        const ret = wasm.wasminmemsignedprekeystore_new();
        this.__wbg_ptr = ret;
        WasmInMemSignedPreKeyStoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WasmInMemSignedPreKeyStore.prototype[Symbol.dispose] = WasmInMemSignedPreKeyStore.prototype.free;

export class WasmKyberPreKey {
    static __wrap(ptr) {
        const obj = Object.create(WasmKyberPreKey.prototype);
        obj.__wbg_ptr = ptr;
        WasmKyberPreKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmKyberPreKeyFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmkyberprekey_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get id() {
        const ret = wasm.wasmkyberprekey_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint8Array}
     */
    get public_key() {
        const ret = wasm.wasmkyberprekey_public_key(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get record() {
        const ret = wasm.wasmkyberprekey_record(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get signature() {
        const ret = wasm.wasmkyberprekey_signature(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {bigint}
     */
    get timestamp() {
        const ret = wasm.wasmkyberprekey_timestamp(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
}
if (Symbol.dispose) WasmKyberPreKey.prototype[Symbol.dispose] = WasmKyberPreKey.prototype.free;

export class WasmPreKey {
    static __wrap(ptr) {
        const obj = Object.create(WasmPreKey.prototype);
        obj.__wbg_ptr = ptr;
        WasmPreKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmPreKeyFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmprekey_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get id() {
        const ret = wasm.wasmprekey_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint8Array}
     */
    get public_key() {
        const ret = wasm.wasmprekey_public_key(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get record() {
        const ret = wasm.wasmprekey_record(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmPreKey.prototype[Symbol.dispose] = WasmPreKey.prototype.free;

/**
 * PrivateKey — standalone asymmetric secret key.
 *
 * Zeroization note: the inner libsignal `PrivateKey` is a `Copy` type over a
 * `[u8; 32]` that upstream does not zero on drop, so this wrapper cannot
 * guarantee erasure of the scalar itself. The wrapper does zeroise every
 * secret-bearing buffer it owns (serialized prekey records, group master-key
 * bytes). Bytes exported to JS (`serialize()`) are copies in JS memory,
 * subject to the browser's GC — they cannot be erased from Rust.
 */
export class WasmPrivateKey {
    static __wrap(ptr) {
        const obj = Object.create(WasmPrivateKey.prototype);
        obj.__wbg_ptr = ptr;
        WasmPrivateKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmPrivateKeyFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmprivatekey_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} data
     * @returns {WasmPrivateKey}
     */
    static deserialize(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmprivatekey_deserialize(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmPrivateKey.__wrap(ret[0]);
    }
    /**
     * @returns {WasmPrivateKey}
     */
    static generate() {
        const ret = wasm.wasmprivatekey_generate();
        return WasmPrivateKey.__wrap(ret);
    }
    /**
     * @returns {WasmPublicKey}
     */
    getPublicKey() {
        const ret = wasm.wasmprivatekey_getPublicKey(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmPublicKey.__wrap(ret[0]);
    }
    /**
     * @returns {Uint8Array}
     */
    serialize() {
        const ret = wasm.wasmprivatekey_serialize(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmPrivateKey.prototype[Symbol.dispose] = WasmPrivateKey.prototype.free;

export class WasmProtocolAddress {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmProtocolAddressFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmprotocoladdress_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get deviceId() {
        const ret = wasm.wasmprotocoladdress_deviceId(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.wasmprotocoladdress_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} name
     * @param {number} device_id
     */
    constructor(name, device_id) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmprotocoladdress_new(ptr0, len0, device_id);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        WasmProtocolAddressFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WasmProtocolAddress.prototype[Symbol.dispose] = WasmProtocolAddress.prototype.free;

/**
 * PublicKey — standalone asymmetric public key.
 */
export class WasmPublicKey {
    static __wrap(ptr) {
        const obj = Object.create(WasmPublicKey.prototype);
        obj.__wbg_ptr = ptr;
        WasmPublicKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmPublicKeyFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmpublickey_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} data
     * @returns {WasmPublicKey}
     */
    static deserialize(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmpublickey_deserialize(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmPublicKey.__wrap(ret[0]);
    }
    /**
     * @returns {Uint8Array}
     */
    serialize() {
        const ret = wasm.wasmpublickey_serialize(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmPublicKey.prototype[Symbol.dispose] = WasmPublicKey.prototype.free;

export class WasmSafetyNumber {
    static __wrap(ptr) {
        const obj = Object.create(WasmSafetyNumber.prototype);
        obj.__wbg_ptr = ptr;
        WasmSafetyNumberFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSafetyNumberFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsafetynumber_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get displayable() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.wasmsafetynumber_displayable(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {Uint8Array}
     */
    get scannable() {
        const ret = wasm.wasmsafetynumber_scannable(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) WasmSafetyNumber.prototype[Symbol.dispose] = WasmSafetyNumber.prototype.free;

export class WasmSignedPreKey {
    static __wrap(ptr) {
        const obj = Object.create(WasmSignedPreKey.prototype);
        obj.__wbg_ptr = ptr;
        WasmSignedPreKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSignedPreKeyFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsignedprekey_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get id() {
        const ret = wasm.wasmsignedprekey_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint8Array}
     */
    get public_key() {
        const ret = wasm.wasmsignedprekey_public_key(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get record() {
        const ret = wasm.wasmsignedprekey_record(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get signature() {
        const ret = wasm.wasmsignedprekey_signature(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {bigint}
     */
    get timestamp() {
        const ret = wasm.wasmsignedprekey_timestamp(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
}
if (Symbol.dispose) WasmSignedPreKey.prototype[Symbol.dispose] = WasmSignedPreKey.prototype.free;

/**
 * Create a sender key distribution message.
 *
 * `distribution_id` must be a caller-minted UUID string; since 0.4.0 the
 * wrapper no longer derives an id from arbitrary group strings.
 * @param {WasmProtocolAddress} local_address
 * @param {string} distribution_id
 * @param {WasmInMemSenderKeyStore} sender_key_store
 * @returns {Promise<Uint8Array>}
 */
export function createSenderKeyDistribution(local_address, distribution_id, sender_key_store) {
    _assertClass(local_address, WasmProtocolAddress);
    const ptr0 = passStringToWasm0(distribution_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(sender_key_store, WasmInMemSenderKeyStore);
    const ret = wasm.createSenderKeyDistribution(local_address.__wbg_ptr, ptr0, len0, sender_key_store.__wbg_ptr);
    return ret;
}

/**
 * Decrypt a group message.
 *
 * The distribution id is embedded in the ciphertext, so the record lookup is
 * keyed automatically; an unknown id surfaces as a `NoSenderKeyState` error.
 * @param {WasmProtocolAddress} sender_address
 * @param {Uint8Array} ciphertext
 * @param {WasmInMemSenderKeyStore} sender_key_store
 * @returns {Promise<Uint8Array>}
 */
export function decryptGroupMessage(sender_address, ciphertext, sender_key_store) {
    _assertClass(sender_address, WasmProtocolAddress);
    const ptr0 = passArray8ToWasm0(ciphertext, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(sender_key_store, WasmInMemSenderKeyStore);
    const ret = wasm.decryptGroupMessage(sender_address.__wbg_ptr, ptr0, len0, sender_key_store.__wbg_ptr);
    return ret;
}

/**
 * Decrypt a Signal message.
 *
 * Returns the plaintext plus any one-time pre-key ids consumed while
 * establishing a new session (see `WasmDecryptResult`). The ids are captured
 * by the wrapper-owned stores' trait callbacks during the engine call —
 * exactly where Signal's own clients persist them — so they reflect genuine
 * consumption, never a guess from the message header.
 * @param {Uint8Array} ciphertext
 * @param {number} message_type
 * @param {WasmProtocolAddress} sender
 * @param {WasmProtocolAddress} local_address
 * @param {WasmInMemSessionStore} session_store
 * @param {WasmInMemIdentityKeyStore} identity_store
 * @param {WasmInMemPreKeyStore} prekey_store
 * @param {WasmInMemSignedPreKeyStore} signed_prekey_store
 * @param {WasmInMemKyberPreKeyStore} kyber_prekey_store
 * @returns {Promise<WasmDecryptResult>}
 */
export function decryptMessage(ciphertext, message_type, sender, local_address, session_store, identity_store, prekey_store, signed_prekey_store, kyber_prekey_store) {
    const ptr0 = passArray8ToWasm0(ciphertext, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(sender, WasmProtocolAddress);
    _assertClass(local_address, WasmProtocolAddress);
    _assertClass(session_store, WasmInMemSessionStore);
    _assertClass(identity_store, WasmInMemIdentityKeyStore);
    _assertClass(prekey_store, WasmInMemPreKeyStore);
    _assertClass(signed_prekey_store, WasmInMemSignedPreKeyStore);
    _assertClass(kyber_prekey_store, WasmInMemKyberPreKeyStore);
    const ret = wasm.decryptMessage(ptr0, len0, message_type, sender.__wbg_ptr, local_address.__wbg_ptr, session_store.__wbg_ptr, identity_store.__wbg_ptr, prekey_store.__wbg_ptr, signed_prekey_store.__wbg_ptr, kyber_prekey_store.__wbg_ptr);
    return ret;
}

/**
 * Encrypt a group message.
 *
 * `distribution_id` must be the same caller-minted UUID string used for
 * `createSenderKeyDistribution`.
 * @param {WasmProtocolAddress} local_address
 * @param {string} distribution_id
 * @param {Uint8Array} plaintext
 * @param {WasmInMemSenderKeyStore} sender_key_store
 * @returns {Promise<Uint8Array>}
 */
export function encryptGroupMessage(local_address, distribution_id, plaintext, sender_key_store) {
    _assertClass(local_address, WasmProtocolAddress);
    const ptr0 = passStringToWasm0(distribution_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(sender_key_store, WasmInMemSenderKeyStore);
    const ret = wasm.encryptGroupMessage(local_address.__wbg_ptr, ptr0, len0, ptr1, len1, sender_key_store.__wbg_ptr);
    return ret;
}

/**
 * Encrypt a Signal message.
 * @param {Uint8Array} plaintext
 * @param {WasmProtocolAddress} recipient
 * @param {WasmProtocolAddress} local_address
 * @param {WasmInMemSessionStore} session_store
 * @param {WasmInMemIdentityKeyStore} identity_store
 * @returns {Promise<WasmCiphertext>}
 */
export function encryptMessage(plaintext, recipient, local_address, session_store, identity_store) {
    const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(recipient, WasmProtocolAddress);
    _assertClass(local_address, WasmProtocolAddress);
    _assertClass(session_store, WasmInMemSessionStore);
    _assertClass(identity_store, WasmInMemIdentityKeyStore);
    const ret = wasm.encryptMessage(ptr0, len0, recipient.__wbg_ptr, local_address.__wbg_ptr, session_store.__wbg_ptr, identity_store.__wbg_ptr);
    return ret;
}

/**
 * Generate a Kyber PreKey for post-quantum security.
 * @param {number} key_id
 * @param {WasmIdentityKeyPair} identity_key_pair
 * @param {WasmInMemKyberPreKeyStore} kyber_prekey_store
 * @returns {Promise<WasmKyberPreKey>}
 */
export function generateKyberPreKey(key_id, identity_key_pair, kyber_prekey_store) {
    _assertClass(identity_key_pair, WasmIdentityKeyPair);
    _assertClass(kyber_prekey_store, WasmInMemKyberPreKeyStore);
    const ret = wasm.generateKyberPreKey(key_id, identity_key_pair.__wbg_ptr, kyber_prekey_store.__wbg_ptr);
    return ret;
}

/**
 * Generate a batch of one-time PreKeys.
 * @param {number} start_id
 * @param {number} count
 * @param {WasmInMemPreKeyStore} prekey_store
 * @returns {Promise<WasmPreKey[]>}
 */
export function generatePreKeys(start_id, count, prekey_store) {
    _assertClass(prekey_store, WasmInMemPreKeyStore);
    const ret = wasm.generatePreKeys(start_id, count, prekey_store.__wbg_ptr);
    return ret;
}

/**
 * Generate a registration ID using unbiased rejection sampling over the
 * canonical inclusive range 1..=16383.
 * @returns {number}
 */
export function generateRegistrationId() {
    const ret = wasm.generateRegistrationId();
    return ret >>> 0;
}

/**
 * Generate a safety number.
 * @param {string} local_uuid
 * @param {WasmPublicKey} local_identity_key
 * @param {string} contact_uuid
 * @param {WasmPublicKey} contact_identity_key
 * @returns {WasmSafetyNumber}
 */
export function generateSafetyNumber(local_uuid, local_identity_key, contact_uuid, contact_identity_key) {
    const ptr0 = passStringToWasm0(local_uuid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(local_identity_key, WasmPublicKey);
    const ptr1 = passStringToWasm0(contact_uuid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(contact_identity_key, WasmPublicKey);
    const ret = wasm.generateSafetyNumber(ptr0, len0, local_identity_key.__wbg_ptr, ptr1, len1, contact_identity_key.__wbg_ptr);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return WasmSafetyNumber.__wrap(ret[0]);
}

/**
 * Generate a signed PreKey.
 * @param {number} key_id
 * @param {WasmIdentityKeyPair} identity_key_pair
 * @param {WasmInMemSignedPreKeyStore} signed_prekey_store
 * @returns {Promise<WasmSignedPreKey>}
 */
export function generateSignedPreKey(key_id, identity_key_pair, signed_prekey_store) {
    _assertClass(identity_key_pair, WasmIdentityKeyPair);
    _assertClass(signed_prekey_store, WasmInMemSignedPreKeyStore);
    const ret = wasm.generateSignedPreKey(key_id, identity_key_pair.__wbg_ptr, signed_prekey_store.__wbg_ptr);
    return ret;
}

/**
 * @returns {Uint8Array}
 */
export function generate_attachment_key() {
    const ret = wasm.generate_attachment_key();
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {number} length
 * @returns {Uint8Array}
 */
export function generate_random_bytes(length) {
    const ret = wasm.generate_random_bytes(length);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @returns {Uint8Array}
 */
export function generate_uuid() {
    const ret = wasm.generate_uuid();
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

export function init() {
    wasm.init();
}

/**
 * @returns {number}
 */
export function message_type_pre_key() {
    const ret = wasm.message_type_pre_key();
    return ret;
}

/**
 * @returns {number}
 */
export function message_type_sender_key() {
    const ret = wasm.message_type_sender_key();
    return ret;
}

/**
 * @returns {number}
 */
export function message_type_signal() {
    const ret = wasm.message_type_signal();
    return ret;
}

/**
 * Process a PreKeyBundle to establish a session.
 * @param {WasmProtocolAddress} recipient
 * @param {WasmProtocolAddress} local_address
 * @param {number} registration_id
 * @param {WasmPublicKey} identity_key
 * @param {number} signed_prekey_id
 * @param {WasmPublicKey} signed_prekey
 * @param {Uint8Array} signed_prekey_signature
 * @param {number | null | undefined} prekey_id
 * @param {Uint8Array | null | undefined} prekey
 * @param {number} kyber_prekey_id
 * @param {Uint8Array} kyber_prekey
 * @param {Uint8Array} kyber_prekey_signature
 * @param {WasmInMemSessionStore} session_store
 * @param {WasmInMemIdentityKeyStore} identity_store
 * @returns {Promise<void>}
 */
export function processPreKeyBundle(recipient, local_address, registration_id, identity_key, signed_prekey_id, signed_prekey, signed_prekey_signature, prekey_id, prekey, kyber_prekey_id, kyber_prekey, kyber_prekey_signature, session_store, identity_store) {
    _assertClass(recipient, WasmProtocolAddress);
    _assertClass(local_address, WasmProtocolAddress);
    _assertClass(identity_key, WasmPublicKey);
    _assertClass(signed_prekey, WasmPublicKey);
    const ptr0 = passArray8ToWasm0(signed_prekey_signature, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(prekey) ? 0 : passArray8ToWasm0(prekey, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(kyber_prekey, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(kyber_prekey_signature, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    _assertClass(session_store, WasmInMemSessionStore);
    _assertClass(identity_store, WasmInMemIdentityKeyStore);
    const ret = wasm.processPreKeyBundle(recipient.__wbg_ptr, local_address.__wbg_ptr, registration_id, identity_key.__wbg_ptr, signed_prekey_id, signed_prekey.__wbg_ptr, ptr0, len0, isLikeNone(prekey_id) ? Number.MAX_SAFE_INTEGER : (prekey_id) >>> 0, ptr1, len1, kyber_prekey_id, ptr2, len2, ptr3, len3, session_store.__wbg_ptr, identity_store.__wbg_ptr);
    return ret;
}

/**
 * Process a sender key distribution message.
 *
 * The distribution id is read from the message itself, so no id parameter is
 * required here.
 * @param {WasmProtocolAddress} sender_address
 * @param {Uint8Array} distribution_message
 * @param {WasmInMemSenderKeyStore} sender_key_store
 * @returns {Promise<void>}
 */
export function processSenderKeyDistribution(sender_address, distribution_message, sender_key_store) {
    _assertClass(sender_address, WasmProtocolAddress);
    const ptr0 = passArray8ToWasm0(distribution_message, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(sender_key_store, WasmInMemSenderKeyStore);
    const ret = wasm.processSenderKeyDistribution(sender_address.__wbg_ptr, ptr0, len0, sender_key_store.__wbg_ptr);
    return ret;
}

/**
 * Extract the sender's ratchet key from a ciphertext, for the receiver
 * side of the retry-request protocol (monorepo
 * `docs/signal-retry-request-design.md` R10).
 *
 * Mirrors the arm logic of `DecryptionErrorMessage::for_original`
 * (`rust/protocol/src/protocol.rs:888-905` @ b056faa6d): Whisper takes
 * `SignalMessage::sender_ratchet_key` (protocol.rs:136), PreKey takes the
 * embedded SignalMessage's ratchet key, SenderKey yields `Ok(None)` (group
 * messages carry no Double-Ratchet key; group heal is SKDM re-serve, not
 * archive-on-match), and Plaintext is an error. The key is returned as
 * `PublicKey::serialize()` bytes (`rust/protocol/src/curve.rs:122` @
 * b056faa6d); the receiver embeds them in the retry-request control
 * envelope and the sender matches them with
 * `WasmInMemSessionStore.session_current_ratchet_key_matches`.
 *
 * Works on undecryptable ciphertexts by construction: the ratchet key sits
 * in the unauthenticated header of a SignalMessage, which is why canonical
 * clients can build a DecryptionErrorMessage for messages that failed
 * decryption.
 * @param {Uint8Array} bytes
 * @param {number} message_type
 * @returns {Uint8Array | undefined}
 */
export function ratchet_key_of_ciphertext(bytes, message_type) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ratchet_key_of_ciphertext(ptr0, len0, message_type);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    let v2;
    if (ret[0] !== 0) {
        v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v2;
}

/**
 * Sign `message` with an identity private key (XEdDSA over the X25519
 * identity key, canonical `PrivateKey::calculate_signature`).
 *
 * Intended for server-verifiable proof-of-possession of an identity key,
 * e.g. authorising a re-key. Returns the 64-byte signature.
 * @param {WasmPrivateKey} identity_private_key
 * @param {Uint8Array} message
 * @returns {Uint8Array}
 */
export function signWithIdentityKey(identity_private_key, message) {
    _assertClass(identity_private_key, WasmPrivateKey);
    const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.signWithIdentityKey(identity_private_key.__wbg_ptr, ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {string} s
 * @returns {Uint8Array}
 */
export function uuid_from_string(s) {
    const ptr0 = passStringToWasm0(s, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.uuid_from_string(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function uuid_to_string(bytes) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.uuid_to_string(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Verify an identity-key signature produced by `signWithIdentityKey`
 * (canonical `PublicKey::verify_signature`, constant-time).
 *
 * Returns `false` for a wrong key, wrong message, or malformed signature —
 * verification failure is data, not an error.
 * @param {WasmPublicKey} identity_public_key
 * @param {Uint8Array} message
 * @param {Uint8Array} signature
 * @returns {boolean}
 */
export function verifyIdentitySignature(identity_public_key, message, signature) {
    _assertClass(identity_public_key, WasmPublicKey);
    const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(signature, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.verifyIdentitySignature(identity_public_key.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * Verify a scanned safety number.
 *
 * **Deprecated**: this recomputes OUR OWN fingerprint and byte-compares it
 * with the scanned payload, which can never validate a cross-perspective
 * scan (the scanned QR encodes the OTHER party's CombinedFingerprints with
 * local/remote swapped). Use `verifyScannableFingerprint`, which implements
 * the canonical `ScannableFingerprint::compare` semantics. Kept for API
 * compatibility only.
 * @param {Uint8Array} scanned
 * @param {string} local_uuid
 * @param {WasmPublicKey} local_identity_key
 * @param {string} contact_uuid
 * @param {WasmPublicKey} contact_identity_key
 * @returns {boolean}
 */
export function verifySafetyNumber(scanned, local_uuid, local_identity_key, contact_uuid, contact_identity_key) {
    const ptr0 = passArray8ToWasm0(scanned, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(local_uuid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(local_identity_key, WasmPublicKey);
    const ptr2 = passStringToWasm0(contact_uuid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(contact_identity_key, WasmPublicKey);
    const ret = wasm.verifySafetyNumber(ptr0, len0, ptr1, len1, local_identity_key.__wbg_ptr, ptr2, len2, contact_identity_key.__wbg_ptr);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}

/**
 * Verify a scanned QR-code fingerprint against OUR view of the session.
 *
 * This is the canonical cross-perspective check
 * (`ScannableFingerprint::compare`, libsignal
 * `rust/protocol/src/fingerprint.rs`): the scanned payload encodes the OTHER
 * party's CombinedFingerprints, so verification requires their.local ==
 * our.remote AND their.remote == our.local, enforced in constant time, with
 * version equality. A version mismatch throws with code
 * `FingerprintVersionMismatch`; an undecodable payload throws with code
 * `FingerprintParsingError`.
 * @param {Uint8Array} scanned
 * @param {string} local_uuid
 * @param {WasmPublicKey} local_identity_key
 * @param {string} contact_uuid
 * @param {WasmPublicKey} contact_identity_key
 * @returns {boolean}
 */
export function verifyScannableFingerprint(scanned, local_uuid, local_identity_key, contact_uuid, contact_identity_key) {
    const ptr0 = passArray8ToWasm0(scanned, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(local_uuid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(local_identity_key, WasmPublicKey);
    const ptr2 = passStringToWasm0(contact_uuid, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(contact_identity_key, WasmPublicKey);
    const ret = wasm.verifyScannableFingerprint(ptr0, len0, ptr1, len1, local_identity_key.__wbg_ptr, ptr2, len2, contact_identity_key.__wbg_ptr);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_is_function_1ff95bcc5517c252: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_undefined_c05833b95a3cf397: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_fffb441def202758: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_call_a6e5c5dce5018821: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_getRandomValues_3f44b700395062e5: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_getRandomValues_ceb34d8ffce7e87f: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_new_b667d279fd5aa943: function(arg0, arg1) {
            const ret = new Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_1824d93f294193e5: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen_162f8baed7154364___convert__closures_____invoke___js_sys_5cf968a9143c8130___Function_fn_wasm_bindgen_162f8baed7154364___JsValue_____wasm_bindgen_162f8baed7154364___sys__Undefined___js_sys_5cf968a9143c8130___Function_fn_wasm_bindgen_162f8baed7154364___JsValue_____wasm_bindgen_162f8baed7154364___sys__Undefined_______true_(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_now_86c0d4ba3fa605b8: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_queueMicrotask_0ab5b2d2393e99b9: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_queueMicrotask_6a09b7bc46549209: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_resolve_2191a4dfe481c25b: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_set_8535240470bf2500: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_static_accessor_GLOBAL_4ef717fb391d88b7: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_8d1badc68b5a74f4: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_146583524fe1469b: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_f2829a2234d7819e: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_then_6ec10ae38b3e92f7: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_wasmciphertext_new: function(arg0) {
            const ret = WasmCiphertext.__wrap(arg0);
            return ret;
        },
        __wbg_wasmdecryptresult_new: function(arg0) {
            const ret = WasmDecryptResult.__wrap(arg0);
            return ret;
        },
        __wbg_wasmkyberprekey_new: function(arg0) {
            const ret = WasmKyberPreKey.__wrap(arg0);
            return ret;
        },
        __wbg_wasmprekey_new: function(arg0) {
            const ret = WasmPreKey.__wrap(arg0);
            return ret;
        },
        __wbg_wasmsignedprekey_new: function(arg0) {
            const ret = WasmSignedPreKey.__wrap(arg0);
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 318, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_162f8baed7154364___convert__closures_____invoke___wasm_bindgen_162f8baed7154364___JsValue__core_37ee0ce0c4cd57d5___result__Result_____wasm_bindgen_162f8baed7154364___JsError___true_);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0, arg1) {
            var v0 = getArrayJsValueFromWasm0(arg0, arg1).slice();
            wasm.__wbindgen_free(arg0, arg1 * 4, 4);
            // Cast intrinsic for `Vector(NamedExternref("WasmPreKey")) -> Externref`.
            const ret = v0;
            return ret;
        },
        __wbindgen_cast_0000000000000005: function(arg0, arg1) {
            var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
            wasm.__wbindgen_free(arg0, arg1 * 1, 1);
            // Cast intrinsic for `Vector(U8) -> Externref`.
            const ret = v0;
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./signal_wasm_bg.js": import0,
    };
}

function wasm_bindgen_162f8baed7154364___convert__closures_____invoke___wasm_bindgen_162f8baed7154364___JsValue__core_37ee0ce0c4cd57d5___result__Result_____wasm_bindgen_162f8baed7154364___JsError___true_(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen_162f8baed7154364___convert__closures_____invoke___wasm_bindgen_162f8baed7154364___JsValue__core_37ee0ce0c4cd57d5___result__Result_____wasm_bindgen_162f8baed7154364___JsError___true_(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen_162f8baed7154364___convert__closures_____invoke___js_sys_5cf968a9143c8130___Function_fn_wasm_bindgen_162f8baed7154364___JsValue_____wasm_bindgen_162f8baed7154364___sys__Undefined___js_sys_5cf968a9143c8130___Function_fn_wasm_bindgen_162f8baed7154364___JsValue_____wasm_bindgen_162f8baed7154364___sys__Undefined_______true_(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen_162f8baed7154364___convert__closures_____invoke___js_sys_5cf968a9143c8130___Function_fn_wasm_bindgen_162f8baed7154364___JsValue_____wasm_bindgen_162f8baed7154364___sys__Undefined___js_sys_5cf968a9143c8130___Function_fn_wasm_bindgen_162f8baed7154364___JsValue_____wasm_bindgen_162f8baed7154364___sys__Undefined_______true_(arg0, arg1, arg2, arg3);
}

const WasmCiphertextFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmciphertext_free(ptr, 1));
const WasmDecryptResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmdecryptresult_free(ptr, 1));
const WasmGroupIdentifierFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmgroupidentifier_free(ptr, 1));
const WasmGroupMasterKeyFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmgroupmasterkey_free(ptr, 1));
const WasmGroupSecretParamsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmgroupsecretparams_free(ptr, 1));
const WasmIdentityKeyPairFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmidentitykeypair_free(ptr, 1));
const WasmInMemIdentityKeyStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasminmemidentitykeystore_free(ptr, 1));
const WasmInMemKyberPreKeyStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasminmemkyberprekeystore_free(ptr, 1));
const WasmInMemPreKeyStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasminmemprekeystore_free(ptr, 1));
const WasmInMemSenderKeyStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasminmemsenderkeystore_free(ptr, 1));
const WasmInMemSessionStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasminmemsessionstore_free(ptr, 1));
const WasmInMemSignedPreKeyStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasminmemsignedprekeystore_free(ptr, 1));
const WasmKyberPreKeyFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmkyberprekey_free(ptr, 1));
const WasmPreKeyFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmprekey_free(ptr, 1));
const WasmPrivateKeyFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmprivatekey_free(ptr, 1));
const WasmProtocolAddressFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmprotocoladdress_free(ptr, 1));
const WasmPublicKeyFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmpublickey_free(ptr, 1));
const WasmSafetyNumberFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsafetynumber_free(ptr, 1));
const WasmSignedPreKeyFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsignedprekey_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_destroy_closure(state.a, state.b));

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_destroy_closure(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('signal_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
