export const PULSE_E2EE_V2_PROTOCOL = 'pulse_e2ee_v2';
export const PULSE_E2EE_V2_VERSION = 2;

export const V2_ENVELOPE_TYPES = Object.freeze(['prekey', 'message']);
export const V2_MESSAGE_TYPES = Object.freeze(['text']);
export const V2_DEVICE_PLATFORMS = Object.freeze(['android', 'web']);

export const V2_CONTRACT_LIMITS = Object.freeze({
  maxCiphertextBytes: 256 * 1024,
  maxIdLength: 128,
  maxOneTimePreKeys: 100,
  maxRecipientEnvelopes: 128,
  maxSignalDeviceId: 127,
});

export const V2_MESSAGE_SEND_SCHEMA = Object.freeze({
  required: Object.freeze([
    'protocol',
    'protocolVersion',
    'conversationId',
    'clientMessageId',
    'senderDeviceId',
    'messageType',
    'recipientEnvelopes',
  ]),
  allowed: Object.freeze([
    'protocol',
    'protocolVersion',
    'conversationId',
    'clientMessageId',
    'senderDeviceId',
    'messageType',
    'recipientEnvelopes',
  ]),
});

export const V2_DEVICE_REGISTRATION_SCHEMA = Object.freeze({
  required: Object.freeze([
    'protocol',
    'protocolVersion',
    'deviceId',
    'signalDeviceId',
    'platform',
    'capabilities',
    'registrationId',
    'identityKey',
    'signedPreKey',
    'kyberPreKey',
    'oneTimePreKeys',
  ]),
  allowed: Object.freeze([
    'protocol',
    'protocolVersion',
    'deviceId',
    'signalDeviceId',
    'deviceLabel',
    'platform',
    'capabilities',
    'registrationId',
    'identityKey',
    'signedPreKey',
    'kyberPreKey',
    'oneTimePreKeys',
  ]),
});

export const V2_KEY_BUNDLE_CLAIM_SCHEMA = Object.freeze({
  required: Object.freeze([
    'protocol',
    'protocolVersion',
    'conversationId',
    'recipientUserId',
    'claimedAt',
    'devices',
  ]),
  allowed: Object.freeze([
    'protocol',
    'protocolVersion',
    'conversationId',
    'recipientUserId',
    'claimedAt',
    'devices',
  ]),
});

export const V2_KEY_BUNDLE_CLAIM_REQUEST_SCHEMA = Object.freeze({
  required: Object.freeze([
    'protocol',
    'protocolVersion',
    'requesterDeviceId',
    'claimId',
  ]),
  allowed: Object.freeze([
    'protocol',
    'protocolVersion',
    'requesterDeviceId',
    'claimId',
  ]),
});

export const V2_MESSAGE_DELIVERY_SCHEMA = Object.freeze({
  required: Object.freeze([
    'protocol',
    'protocolVersion',
    'messageId',
    'conversationId',
    'clientMessageId',
    'senderUserId',
    'senderDeviceId',
    'senderSignalDeviceId',
    'senderIdentityVersion',
    'recipientUserId',
    'recipientDeviceId',
    'messageType',
    'envelopeType',
    'ciphertext',
    'createdAt',
  ]),
  allowed: Object.freeze([
    'protocol',
    'protocolVersion',
    'messageId',
    'conversationId',
    'clientMessageId',
    'senderUserId',
    'senderDeviceId',
    'senderSignalDeviceId',
    'senderIdentityVersion',
    'recipientUserId',
    'recipientDeviceId',
    'messageType',
    'envelopeType',
    'ciphertext',
    'createdAt',
  ]),
});

const ENVELOPE_FIELDS = Object.freeze([
  'recipientUserId',
  'recipientDeviceId',
  'envelopeType',
  'ciphertext',
]);
const CAPABILITY_FIELDS = Object.freeze([
  'messageEncryption',
  'hardwareBackedKeystore',
]);
const SIGNED_PREKEY_FIELDS = Object.freeze([
  'keyId',
  'publicKey',
  'signature',
]);
const KYBER_PREKEY_FIELDS = SIGNED_PREKEY_FIELDS;
const ONE_TIME_PREKEY_FIELDS = Object.freeze(['keyId', 'publicKey']);
const CLAIMED_DEVICE_FIELDS = Object.freeze([
  'deviceId',
  'signalDeviceId',
  'registrationId',
  'identityKey',
  'identityVersion',
  'signedPreKey',
  'kyberPreKey',
  'oneTimePreKey',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class V2ContractValidationError extends Error {
  constructor(errors) {
    super('Ongeldig pulse_e2ee_v2-contract.');
    this.name = 'V2ContractValidationError';
    this.errors = errors;
  }
}

function addError(errors, code, path) {
  errors.push({ code, path });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateObjectShape(value, schema, path, errors) {
  if (!isPlainObject(value)) {
    addError(errors, 'invalid_type', path);
    return false;
  }

  schema.required.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      addError(errors, 'required', `${path}.${field}`);
    }
  });
  Object.keys(value).forEach((field) => {
    if (!schema.allowed.includes(field)) {
      addError(errors, 'unknown_field', `${path}.${field}`);
    }
  });
  return true;
}

function validateProtocolHeader(value, path, errors) {
  if (value.protocol !== PULSE_E2EE_V2_PROTOCOL) {
    addError(errors, 'invalid_protocol', `${path}.protocol`);
  }
  if (value.protocolVersion !== PULSE_E2EE_V2_VERSION) {
    addError(errors, 'invalid_protocol_version', `${path}.protocolVersion`);
  }
}

function validateId(value, path, errors) {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > V2_CONTRACT_LIMITS.maxIdLength
    || !ID_PATTERN.test(value)
  ) {
    addError(errors, 'invalid_id', path);
  }
}

function validateUuid(value, path, errors) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    addError(errors, 'invalid_uuid', path);
  }
}

function getDecodedBase64Size(value) {
  let padding = 0;
  if (value.endsWith('==')) padding = 2;
  else if (value.endsWith('=')) padding = 1;
  return ((value.length / 4) * 3) - padding;
}

function validateBase64(value, path, errors, maxBytes = V2_CONTRACT_LIMITS.maxCiphertextBytes) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length % 4 !== 0
    || !BASE64_PATTERN.test(value)
    || getDecodedBase64Size(value) > maxBytes
  ) {
    addError(errors, 'invalid_base64', path);
  }
}

function validatePositiveInteger(value, path, errors) {
  if (!Number.isSafeInteger(value) || value < 1) {
    addError(errors, 'invalid_positive_integer', path);
  }
}

function validateSignalDeviceId(value, path, errors) {
  if (
    !Number.isSafeInteger(value)
    || value < 1
    || value > V2_CONTRACT_LIMITS.maxSignalDeviceId
  ) {
    addError(errors, 'invalid_signal_device_id', path);
  }
}

function validateIsoDate(value, path, errors) {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    || Number.isNaN(Date.parse(value))
  ) {
    addError(errors, 'invalid_iso_date', path);
  }
}

function validateSignedPreKey(value, path, errors) {
  if (!validateObjectShape(value, {
    required: SIGNED_PREKEY_FIELDS,
    allowed: SIGNED_PREKEY_FIELDS,
  }, path, errors)) return;

  validatePositiveInteger(value.keyId, `${path}.keyId`, errors);
  validateBase64(value.publicKey, `${path}.publicKey`, errors, 1024);
  validateBase64(value.signature, `${path}.signature`, errors, 1024);
}

function validateKyberPreKey(value, path, errors) {
  if (!validateObjectShape(value, {
    required: KYBER_PREKEY_FIELDS,
    allowed: KYBER_PREKEY_FIELDS,
  }, path, errors)) return;

  validatePositiveInteger(value.keyId, `${path}.keyId`, errors);
  validateBase64(value.publicKey, `${path}.publicKey`, errors, 4096);
  validateBase64(value.signature, `${path}.signature`, errors, 1024);
}

function validateOneTimePreKey(value, path, errors) {
  if (!validateObjectShape(value, {
    required: ONE_TIME_PREKEY_FIELDS,
    allowed: ONE_TIME_PREKEY_FIELDS,
  }, path, errors)) return;

  validatePositiveInteger(value.keyId, `${path}.keyId`, errors);
  validateBase64(value.publicKey, `${path}.publicKey`, errors, 1024);
}

function recipientKey(userId, deviceId) {
  return `${userId}\u0000${deviceId}`;
}

function normalizeExpectedRecipients(expectedRecipientDevices, errors) {
  if (!Array.isArray(expectedRecipientDevices)) {
    addError(errors, 'recipient_context_required', '$context.expectedRecipientDevices');
    return null;
  }

  const recipients = new Set();
  expectedRecipientDevices.forEach((recipient, index) => {
    if (!isPlainObject(recipient)) {
      addError(errors, 'invalid_type', `$context.expectedRecipientDevices[${index}]`);
      return;
    }
    const localErrors = [];
    validateId(recipient.userId, `$context.expectedRecipientDevices[${index}].userId`, localErrors);
    validateId(recipient.deviceId, `$context.expectedRecipientDevices[${index}].deviceId`, localErrors);
    errors.push(...localErrors);
    if (localErrors.length === 0) {
      const key = recipientKey(recipient.userId, recipient.deviceId);
      if (recipients.has(key)) {
        addError(errors, 'duplicate_expected_recipient', `$context.expectedRecipientDevices[${index}]`);
      }
      recipients.add(key);
    }
  });
  return recipients;
}

export function validateV2MessageSend(payload, context = {}) {
  const errors = [];
  if (!validateObjectShape(payload, V2_MESSAGE_SEND_SCHEMA, '$', errors)) {
    return { ok: false, errors };
  }

  validateProtocolHeader(payload, '$', errors);
  validateId(payload.conversationId, '$.conversationId', errors);
  validateUuid(payload.clientMessageId, '$.clientMessageId', errors);
  validateId(payload.senderDeviceId, '$.senderDeviceId', errors);

  if (!V2_MESSAGE_TYPES.includes(payload.messageType)) {
    addError(errors, 'unsupported_message_type', '$.messageType');
  }
  if (
    typeof context.authenticatedDeviceId !== 'string'
    || payload.senderDeviceId !== context.authenticatedDeviceId
  ) {
    addError(errors, 'sender_device_mismatch', '$.senderDeviceId');
  }

  const expectedRecipients = normalizeExpectedRecipients(context.expectedRecipientDevices, errors);
  if (
    !Array.isArray(payload.recipientEnvelopes)
    || payload.recipientEnvelopes.length < 1
    || payload.recipientEnvelopes.length > V2_CONTRACT_LIMITS.maxRecipientEnvelopes
  ) {
    addError(errors, 'invalid_recipient_count', '$.recipientEnvelopes');
    return { ok: false, errors };
  }

  const actualRecipients = new Set();
  payload.recipientEnvelopes.forEach((envelope, index) => {
    const path = `$.recipientEnvelopes[${index}]`;
    if (!validateObjectShape(envelope, {
      required: ENVELOPE_FIELDS,
      allowed: ENVELOPE_FIELDS,
    }, path, errors)) return;

    const envelopeErrors = [];
    validateId(envelope.recipientUserId, `${path}.recipientUserId`, envelopeErrors);
    validateId(envelope.recipientDeviceId, `${path}.recipientDeviceId`, envelopeErrors);
    errors.push(...envelopeErrors);

    if (!V2_ENVELOPE_TYPES.includes(envelope.envelopeType)) {
      addError(errors, 'unsupported_envelope_type', `${path}.envelopeType`);
    }
    validateBase64(envelope.ciphertext, `${path}.ciphertext`, errors);

    if (envelopeErrors.length === 0) {
      const key = recipientKey(envelope.recipientUserId, envelope.recipientDeviceId);
      if (actualRecipients.has(key)) {
        addError(errors, 'duplicate_recipient', path);
      }
      actualRecipients.add(key);
    }
  });

  if (expectedRecipients) {
    expectedRecipients.forEach((key) => {
      if (!actualRecipients.has(key)) {
        addError(errors, 'missing_recipient', '$.recipientEnvelopes');
      }
    });
    actualRecipients.forEach((key) => {
      if (!expectedRecipients.has(key)) {
        addError(errors, 'unexpected_recipient', '$.recipientEnvelopes');
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidV2MessageSend(payload, context) {
  const result = validateV2MessageSend(payload, context);
  if (!result.ok) throw new V2ContractValidationError(result.errors);
  return payload;
}

export function validateV2DeviceRegistration(payload) {
  const errors = [];
  if (!validateObjectShape(payload, V2_DEVICE_REGISTRATION_SCHEMA, '$', errors)) {
    return { ok: false, errors };
  }

  validateProtocolHeader(payload, '$', errors);
  validateId(payload.deviceId, '$.deviceId', errors);
  validateSignalDeviceId(payload.signalDeviceId, '$.signalDeviceId', errors);
  if (
    payload.deviceLabel !== undefined
    && (typeof payload.deviceLabel !== 'string'
      || payload.deviceLabel.length < 1
      || payload.deviceLabel.length > 80)
  ) {
    addError(errors, 'invalid_device_label', '$.deviceLabel');
  }
  validatePositiveInteger(payload.registrationId, '$.registrationId', errors);
  validateBase64(payload.identityKey, '$.identityKey', errors, 1024);

  if (!V2_DEVICE_PLATFORMS.includes(payload.platform)) {
    addError(errors, 'unsupported_platform', '$.platform');
  }

  if (validateObjectShape(payload.capabilities, {
    required: CAPABILITY_FIELDS,
    allowed: CAPABILITY_FIELDS,
  }, '$.capabilities', errors)) {
    CAPABILITY_FIELDS.forEach((field) => {
      if (typeof payload.capabilities[field] !== 'boolean') {
        addError(errors, 'invalid_type', `$.capabilities.${field}`);
      }
    });
    if (payload.capabilities.messageEncryption !== true) {
      addError(errors, 'required_capability_missing', '$.capabilities.messageEncryption');
    }
  }

  validateSignedPreKey(payload.signedPreKey, '$.signedPreKey', errors);
  validateKyberPreKey(payload.kyberPreKey, '$.kyberPreKey', errors);

  if (
    !Array.isArray(payload.oneTimePreKeys)
    || payload.oneTimePreKeys.length < 1
    || payload.oneTimePreKeys.length > V2_CONTRACT_LIMITS.maxOneTimePreKeys
  ) {
    addError(errors, 'invalid_prekey_count', '$.oneTimePreKeys');
  } else {
    const keyIds = new Set();
    payload.oneTimePreKeys.forEach((preKey, index) => {
      const path = `$.oneTimePreKeys[${index}]`;
      validateOneTimePreKey(preKey, path, errors);
      if (keyIds.has(preKey.keyId)) addError(errors, 'duplicate_prekey_id', `${path}.keyId`);
      keyIds.add(preKey.keyId);
    });
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidV2DeviceRegistration(payload) {
  const result = validateV2DeviceRegistration(payload);
  if (!result.ok) throw new V2ContractValidationError(result.errors);
  return payload;
}

export function validateV2KeyBundleClaim(payload, context = {}) {
  const errors = [];
  if (!validateObjectShape(payload, V2_KEY_BUNDLE_CLAIM_SCHEMA, '$', errors)) {
    return { ok: false, errors };
  }

  validateProtocolHeader(payload, '$', errors);
  validateId(payload.conversationId, '$.conversationId', errors);
  validateId(payload.recipientUserId, '$.recipientUserId', errors);
  validateIsoDate(payload.claimedAt, '$.claimedAt', errors);

  if (context.authorized !== true) {
    addError(errors, 'claim_not_authorized', '$context.authorized');
  }
  if (
    typeof context.expectedRecipientUserId !== 'string'
    || payload.recipientUserId !== context.expectedRecipientUserId
  ) {
    addError(errors, 'recipient_user_mismatch', '$.recipientUserId');
  }

  if (
    !Array.isArray(payload.devices)
    || (!context.allowEmptyDevices && payload.devices.length < 1)
  ) {
    addError(errors, 'invalid_claimed_device_count', '$.devices');
    return { ok: false, errors };
  }

  const deviceIds = new Set();
  const oneTimePreKeyIds = new Set();
  payload.devices.forEach((device, index) => {
    const path = `$.devices[${index}]`;
    if (!validateObjectShape(device, {
      required: CLAIMED_DEVICE_FIELDS,
      allowed: CLAIMED_DEVICE_FIELDS,
    }, path, errors)) return;

    validateId(device.deviceId, `${path}.deviceId`, errors);
    validateSignalDeviceId(device.signalDeviceId, `${path}.signalDeviceId`, errors);
    validatePositiveInteger(device.registrationId, `${path}.registrationId`, errors);
    validatePositiveInteger(device.identityVersion, `${path}.identityVersion`, errors);
    validateBase64(device.identityKey, `${path}.identityKey`, errors, 1024);
    validateSignedPreKey(device.signedPreKey, `${path}.signedPreKey`, errors);
    validateKyberPreKey(device.kyberPreKey, `${path}.kyberPreKey`, errors);
    validateOneTimePreKey(device.oneTimePreKey, `${path}.oneTimePreKey`, errors);

    if (deviceIds.has(device.deviceId)) {
      addError(errors, 'duplicate_claimed_device', `${path}.deviceId`);
    }
    deviceIds.add(device.deviceId);

    const preKeyIdentity = `${device.deviceId}\u0000${device.oneTimePreKey?.keyId}`;
    if (oneTimePreKeyIds.has(preKeyIdentity)) {
      addError(errors, 'duplicate_claimed_prekey', `${path}.oneTimePreKey.keyId`);
    }
    oneTimePreKeyIds.add(preKeyIdentity);
  });

  if (Array.isArray(context.expectedRecipientDeviceIds)) {
    const expectedDeviceIds = new Set(context.expectedRecipientDeviceIds);
    expectedDeviceIds.forEach((deviceId) => {
      if (!deviceIds.has(deviceId)) addError(errors, 'missing_claimed_device', '$.devices');
    });
    deviceIds.forEach((deviceId) => {
      if (!expectedDeviceIds.has(deviceId)) addError(errors, 'unexpected_claimed_device', '$.devices');
    });
  } else {
    addError(errors, 'claim_device_context_required', '$context.expectedRecipientDeviceIds');
  }

  return { ok: errors.length === 0, errors };
}

export function validateV2KeyBundleClaimRequest(payload, context = {}) {
  const errors = [];
  if (!validateObjectShape(payload, V2_KEY_BUNDLE_CLAIM_REQUEST_SCHEMA, '$', errors)) {
    return { ok: false, errors };
  }

  validateProtocolHeader(payload, '$', errors);
  validateId(payload.requesterDeviceId, '$.requesterDeviceId', errors);
  validateUuid(payload.claimId, '$.claimId', errors);
  if (payload.requesterDeviceId !== context.authenticatedDeviceId) {
    addError(errors, 'sender_device_mismatch', '$.requesterDeviceId');
  }

  return { ok: errors.length === 0, errors };
}

export function validateV2MessageDelivery(payload, context = {}) {
  const errors = [];
  if (!validateObjectShape(payload, V2_MESSAGE_DELIVERY_SCHEMA, '$', errors)) {
    return { ok: false, errors };
  }

  validateProtocolHeader(payload, '$', errors);
  validateId(payload.messageId, '$.messageId', errors);
  validateId(payload.conversationId, '$.conversationId', errors);
  validateUuid(payload.clientMessageId, '$.clientMessageId', errors);
  validateId(payload.senderUserId, '$.senderUserId', errors);
  validateId(payload.senderDeviceId, '$.senderDeviceId', errors);
  validateSignalDeviceId(payload.senderSignalDeviceId, '$.senderSignalDeviceId', errors);
  validatePositiveInteger(payload.senderIdentityVersion, '$.senderIdentityVersion', errors);
  validateId(payload.recipientUserId, '$.recipientUserId', errors);
  validateId(payload.recipientDeviceId, '$.recipientDeviceId', errors);
  validateIsoDate(payload.createdAt, '$.createdAt', errors);
  validateBase64(payload.ciphertext, '$.ciphertext', errors);

  if (!V2_MESSAGE_TYPES.includes(payload.messageType)) {
    addError(errors, 'unsupported_message_type', '$.messageType');
  }
  if (!V2_ENVELOPE_TYPES.includes(payload.envelopeType)) {
    addError(errors, 'unsupported_envelope_type', '$.envelopeType');
  }
  if (payload.recipientUserId !== context.authenticatedUserId) {
    addError(errors, 'recipient_user_mismatch', '$.recipientUserId');
  }
  if (payload.recipientDeviceId !== context.authenticatedDeviceId) {
    addError(errors, 'recipient_device_mismatch', '$.recipientDeviceId');
  }

  return { ok: errors.length === 0, errors };
}
