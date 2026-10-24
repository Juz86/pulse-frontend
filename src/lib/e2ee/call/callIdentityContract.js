export const PULSE_CALL_E2EE_PROTOCOL = 'pulse_call_e2ee_v1';
export const PULSE_CALL_E2EE_VERSION = 1;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MAX_CRYPTO_FIELD_CHARACTERS = 4096;

const FIELDS = Object.freeze([
  'protocol',
  'protocolVersion',
  'sessionId',
  'callerUserId',
  'calleeUserId',
  'senderDeviceId',
  'senderSignalDeviceId',
  'senderIdentityVersion',
  'mediaType',
  'descriptionType',
  'dtlsFingerprintSha256',
  'revision',
  'nonce',
  'peerBindingHash',
  'identityKey',
  'signature',
]);

function add(errors, code, path) {
  errors.push({ code, path });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateId(value, path, errors) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) add(errors, 'invalid_id', path);
}

function validatePositiveInteger(value, path, errors, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    add(errors, 'invalid_positive_integer', path);
  }
}

function validateBase64(value, path, errors) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_CRYPTO_FIELD_CHARACTERS
    || value.length % 4 !== 0
    || !BASE64_PATTERN.test(value)
  ) {
    add(errors, 'invalid_base64', path);
  }
}

export function normalizeDtlsFingerprint(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replaceAll(':', '');
  return SHA256_PATTERN.test(normalized) ? normalized : null;
}

export function extractSha256FingerprintFromSdp(sdp) {
  if (typeof sdp !== 'string') return null;
  const matches = [...sdp.matchAll(/^a=fingerprint:sha-256\s+([^\r\n]+)$/gim)]
    .map((match) => normalizeDtlsFingerprint(match[1].trim()))
    .filter(Boolean);
  if (matches.length === 0 || new Set(matches).size !== 1) return null;
  return matches[0];
}

export function validateCallIdentityEnvelope(value, context = {}) {
  const errors = [];
  if (!isObject(value)) return { ok: false, errors: [{ code: 'invalid_type', path: '$' }] };
  FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(value, field)) add(errors, 'required', `$.${field}`);
  });
  Object.keys(value).forEach((field) => {
    if (!FIELDS.includes(field)) add(errors, 'unknown_field', `$.${field}`);
  });

  if (value.protocol !== PULSE_CALL_E2EE_PROTOCOL) add(errors, 'invalid_protocol', '$.protocol');
  if (value.protocolVersion !== PULSE_CALL_E2EE_VERSION) {
    add(errors, 'invalid_protocol_version', '$.protocolVersion');
  }
  validateId(value.sessionId, '$.sessionId', errors);
  validateId(value.callerUserId, '$.callerUserId', errors);
  validateId(value.calleeUserId, '$.calleeUserId', errors);
  validateId(value.senderDeviceId, '$.senderDeviceId', errors);
  validatePositiveInteger(value.senderSignalDeviceId, '$.senderSignalDeviceId', errors, 127);
  validatePositiveInteger(value.senderIdentityVersion, '$.senderIdentityVersion', errors);
  validateId(value.nonce, '$.nonce', errors);
  if (!['audio', 'video'].includes(value.mediaType)) add(errors, 'invalid_media_type', '$.mediaType');
  if (!['offer', 'answer'].includes(value.descriptionType)) {
    add(errors, 'invalid_description_type', '$.descriptionType');
  }
  if (!SHA256_PATTERN.test(value.dtlsFingerprintSha256 || '')) {
    add(errors, 'invalid_fingerprint', '$.dtlsFingerprintSha256');
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
    add(errors, 'invalid_revision', '$.revision');
  }
  if (value.descriptionType === 'answer') {
    if (!SHA256_PATTERN.test(value.peerBindingHash || '')) {
      add(errors, 'peer_binding_hash_required', '$.peerBindingHash');
    }
  } else if (value.peerBindingHash !== '') {
    add(errors, 'unexpected_peer_binding_hash', '$.peerBindingHash');
  }
  validateBase64(value.identityKey, '$.identityKey', errors);
  validateBase64(value.signature, '$.signature', errors);

  if (context.sessionId && value.sessionId !== context.sessionId) {
    add(errors, 'session_mismatch', '$.sessionId');
  }
  if (context.callerUserId && value.callerUserId !== context.callerUserId) {
    add(errors, 'caller_mismatch', '$.callerUserId');
  }
  if (context.calleeUserId && value.calleeUserId !== context.calleeUserId) {
    add(errors, 'callee_mismatch', '$.calleeUserId');
  }
  if (context.mediaType && value.mediaType !== context.mediaType) {
    add(errors, 'media_type_mismatch', '$.mediaType');
  }
  if (context.descriptionType && value.descriptionType !== context.descriptionType) {
    add(errors, 'description_type_mismatch', '$.descriptionType');
  }
  if (context.authenticatedDeviceId && value.senderDeviceId !== context.authenticatedDeviceId) {
    add(errors, 'sender_device_mismatch', '$.senderDeviceId');
  }
  if (
    context.senderIdentityVersion
    && value.senderIdentityVersion !== context.senderIdentityVersion
  ) {
    add(errors, 'identity_version_mismatch', '$.senderIdentityVersion');
  }
  return { ok: errors.length === 0, errors };
}
