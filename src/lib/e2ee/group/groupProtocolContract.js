export const PULSE_GROUP_E2EE_PROTOCOL = 'pulse_group_e2ee_v1';
export const PULSE_GROUP_E2EE_VERSION = 1;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MAX_CIPHERTEXT_CHARACTERS = 512 * 1024;

const MESSAGE_FIELDS = Object.freeze([
  'protocol',
  'protocolVersion',
  'conversationId',
  'clientMessageId',
  'senderDeviceId',
  'senderSignalDeviceId',
  'senderIdentityVersion',
  'epoch',
  'distributionId',
  'messageType',
  'ciphertext',
]);

const DISTRIBUTION_FIELDS = Object.freeze([
  'protocol',
  'protocolVersion',
  'conversationId',
  'senderDeviceId',
  'senderSignalDeviceId',
  'senderIdentityVersion',
  'epoch',
  'distributionId',
  'recipientEnvelopes',
]);

const RECIPIENT_FIELDS = Object.freeze([
  'recipientUserId',
  'recipientDeviceId',
  'envelopeType',
  'ciphertext',
]);

function error(errors, code, path) {
  errors.push({ code, path });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactObject(value, fields, path, errors) {
  if (!isObject(value)) {
    error(errors, 'invalid_type', path);
    return false;
  }
  fields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(value, field)) error(errors, 'required', `${path}.${field}`);
  });
  Object.keys(value).forEach((field) => {
    if (!fields.includes(field)) error(errors, 'unknown_field', `${path}.${field}`);
  });
  return true;
}

function id(value, path, errors) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) error(errors, 'invalid_id', path);
}

function uuid(value, path, errors) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) error(errors, 'invalid_uuid', path);
}

function positiveInteger(value, path, errors, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    error(errors, 'invalid_positive_integer', path);
  }
}

function base64(value, path, errors) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_CIPHERTEXT_CHARACTERS
    || value.length % 4 !== 0
    || !BASE64_PATTERN.test(value)
  ) {
    error(errors, 'invalid_base64', path);
  }
}

function header(value, errors) {
  if (value.protocol !== PULSE_GROUP_E2EE_PROTOCOL) error(errors, 'invalid_protocol', '$.protocol');
  if (value.protocolVersion !== PULSE_GROUP_E2EE_VERSION) {
    error(errors, 'invalid_protocol_version', '$.protocolVersion');
  }
}

function sender(value, context, errors) {
  id(value.senderDeviceId, '$.senderDeviceId', errors);
  positiveInteger(value.senderSignalDeviceId, '$.senderSignalDeviceId', errors, 127);
  positiveInteger(value.senderIdentityVersion, '$.senderIdentityVersion', errors);
  if (value.senderDeviceId !== context.authenticatedDeviceId) {
    error(errors, 'sender_device_mismatch', '$.senderDeviceId');
  }
}

function groupContext(value, context, errors) {
  id(value.conversationId, '$.conversationId', errors);
  positiveInteger(value.epoch, '$.epoch', errors);
  uuid(value.distributionId, '$.distributionId', errors);
  if (!context.isGroup) error(errors, 'group_required', '$context.isGroup');
  if (value.epoch !== context.currentEpoch) error(errors, 'group_epoch_mismatch', '$.epoch');
}

function recipientKey(userId, deviceId) {
  return `${userId}\u0000${deviceId}`;
}

export function validateGroupMessageSend(value, context = {}) {
  const errors = [];
  if (!exactObject(value, MESSAGE_FIELDS, '$', errors)) return { ok: false, errors };
  header(value, errors);
  sender(value, context, errors);
  groupContext(value, context, errors);
  uuid(value.clientMessageId, '$.clientMessageId', errors);
  if (value.messageType !== 'text') error(errors, 'unsupported_message_type', '$.messageType');
  base64(value.ciphertext, '$.ciphertext', errors);
  return { ok: errors.length === 0, errors };
}

export function validateGroupSenderKeyDistribution(value, context = {}) {
  const errors = [];
  if (!exactObject(value, DISTRIBUTION_FIELDS, '$', errors)) return { ok: false, errors };
  header(value, errors);
  sender(value, context, errors);
  groupContext(value, context, errors);

  if (!Array.isArray(value.recipientEnvelopes) || value.recipientEnvelopes.length === 0) {
    error(errors, 'invalid_recipient_count', '$.recipientEnvelopes');
    return { ok: false, errors };
  }
  const expected = new Set((context.expectedRecipientDevices || []).map((recipient) => (
    recipientKey(recipient.userId, recipient.deviceId)
  )));
  const actual = new Set();
  value.recipientEnvelopes.forEach((envelope, index) => {
    const path = `$.recipientEnvelopes[${index}]`;
    if (!exactObject(envelope, RECIPIENT_FIELDS, path, errors)) return;
    id(envelope.recipientUserId, `${path}.recipientUserId`, errors);
    id(envelope.recipientDeviceId, `${path}.recipientDeviceId`, errors);
    if (!['prekey', 'message'].includes(envelope.envelopeType)) {
      error(errors, 'unsupported_envelope_type', `${path}.envelopeType`);
    }
    base64(envelope.ciphertext, `${path}.ciphertext`, errors);
    const key = recipientKey(envelope.recipientUserId, envelope.recipientDeviceId);
    if (actual.has(key)) error(errors, 'duplicate_recipient', path);
    actual.add(key);
    if (!expected.has(key)) error(errors, 'unexpected_recipient', path);
  });
  expected.forEach((key) => {
    if (!actual.has(key)) error(errors, 'missing_recipient', '$.recipientEnvelopes');
  });
  return { ok: errors.length === 0, errors };
}
