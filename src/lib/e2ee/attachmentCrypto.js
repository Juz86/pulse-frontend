import {
  ATTACHMENT_EXTERNAL_CONTRACT_STRATEGY,
  ATTACHMENT_FUTURE_ENVELOPE_ALG,
  ATTACHMENT_FUTURE_ENVELOPE_KIND,
  ATTACHMENT_FUTURE_KEY_WRAP_ALG,
  ATTACHMENT_FUTURE_MEDIA_STRATEGY,
  ATTACHMENT_MOCK_ENVELOPE_ALG,
  ATTACHMENT_MOCK_ENVELOPE_KIND,
  ATTACHMENT_MOCK_KEY_WRAP_ALG,
  ATTACHMENT_MOCK_MEDIA_STRATEGY,
  ATTACHMENT_NONE_STRATEGY,
} from './attachmentStrategyConstants';

function toBase64Utf8(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function fromBase64Utf8(value) {
  return decodeURIComponent(escape(atob(value)));
}

function parseDataUrl(dataUrl = '') {
  const match = String(dataUrl).match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1] || 'application/octet-stream',
    base64: match[2],
  };
}

function base64ToBytes(base64 = '') {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function computeDigestHex(bytes) {
  const cryptoApi =
    (typeof window !== 'undefined' && window.crypto?.subtle && window.crypto)
    || null;

  if (cryptoApi?.subtle) {
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    return bytesToHex(new Uint8Array(digest));
  }

  let hash = 2166136261;
  bytes.forEach((byte) => {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  });
  return `fallback-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function computeTextDigestHex(text = '') {
  return computeDigestHex(Uint8Array.from(unescape(encodeURIComponent(text)), (char) => char.charCodeAt(0)));
}

function buildMockWrappedMediaKey({ seed = '', mediaKeyId = '', keyWrapAlg = '' } = {}) {
  return toBase64Utf8(JSON.stringify({
    version: 1,
    kind: 'pulse_mock_wrapped_media_key',
    seed,
    mediaKeyId,
    keyWrapAlg,
  }));
}

export function isMockAttachmentEncryption(encryption = {}) {
  return encryption?.alg === ATTACHMENT_MOCK_ENVELOPE_ALG;
}

export function resolveAttachmentEncryptionStrategy(encryption = {}) {
  const alg = encryption?.alg || '';
  const strategyKeyHint = encryption?.strategyKey || '';
  const isMock = isMockAttachmentEncryption(encryption) || strategyKeyHint === ATTACHMENT_MOCK_MEDIA_STRATEGY;
  const isFutureMedia = alg === ATTACHMENT_FUTURE_ENVELOPE_ALG || strategyKeyHint === ATTACHMENT_FUTURE_MEDIA_STRATEGY;
  const hasEncryption = Boolean(alg || (strategyKeyHint && strategyKeyHint !== ATTACHMENT_NONE_STRATEGY));

  return {
    alg,
    isMock,
    isFutureMedia,
    hasEncryption,
    canEncryptEnvelope: !alg || isMock,
    canDecryptEnvelope: isMock,
    canValidateWrappedMediaKey: isMock,
    strategyKey: isMock
      ? ATTACHMENT_MOCK_MEDIA_STRATEGY
      : isFutureMedia
        ? ATTACHMENT_FUTURE_MEDIA_STRATEGY
        : (alg ? ATTACHMENT_EXTERNAL_CONTRACT_STRATEGY : ATTACHMENT_NONE_STRATEGY),
  };
}

export function getAttachmentEncryptionCapability(encryption = {}) {
  const strategy = resolveAttachmentEncryptionStrategy(encryption);
  const binaryAccessSupported = Boolean(!strategy.hasEncryption || strategy.canDecryptEnvelope);
  const binaryAccessSupportLabel = binaryAccessSupported
    ? 'supported'
    : strategy.isFutureMedia
      ? 'future_strategy_required'
      : 'unsupported';

  return {
    ...strategy,
    binaryAccessSupported,
    binaryAccessSupportLabel,
    requiresFutureStrategySupport: Boolean(strategy.isFutureMedia && !binaryAccessSupported),
  };
}

export function decodeMockWrappedMediaKey(wrappedMediaKey = '') {
  if (!wrappedMediaKey) return null;

  try {
    return JSON.parse(fromBase64Utf8(wrappedMediaKey));
  } catch {
    return null;
  }
}

export async function unwrapMockWrappedMediaKey(encryption = {}) {
  const wrappedKeyPayload = await validateMockWrappedMediaKeyContract(encryption);

  return {
    mediaKeyId: wrappedKeyPayload.mediaKeyId || encryption?.mediaKeyId || '',
    keyWrapAlg: wrappedKeyPayload.keyWrapAlg || encryption?.keyWrapAlg || '',
    payloadSha256: wrappedKeyPayload.seed || encryption?.sha256 || '',
    wrappedMediaKey: encryption?.wrappedMediaKey || '',
    wrappedMediaKeyDigest: encryption?.wrappedMediaKeyDigest || '',
    unwrapKind: 'pulse_mock_media_key_unwrap',
  };
}

export async function unwrapAttachmentMediaKey(encryption = {}) {
  const strategy = getAttachmentEncryptionCapability(encryption);

  if (strategy.isMock) {
    return unwrapMockWrappedMediaKey(encryption);
  }

  return {
    mediaKeyId: encryption?.mediaKeyId || '',
    keyWrapAlg: encryption?.keyWrapAlg || '',
    payloadSha256: encryption?.sha256 || '',
    wrappedMediaKey: encryption?.wrappedMediaKey || '',
    wrappedMediaKeyDigest: encryption?.wrappedMediaKeyDigest || '',
    unwrapKind: strategy.hasEncryption ? 'attachment_encryption_contract' : 'none',
  };
}

export async function validateMockWrappedMediaKeyContract(encryption = {}) {
  const wrappedKeyPayload = decodeMockWrappedMediaKey(encryption?.wrappedMediaKey || '');
  if (!wrappedKeyPayload || wrappedKeyPayload.kind !== 'pulse_mock_wrapped_media_key') {
    throw new Error('Ongeldige mock wrapped media key.');
  }

  if (encryption?.mediaKeyId && wrappedKeyPayload.mediaKeyId && encryption.mediaKeyId !== wrappedKeyPayload.mediaKeyId) {
    throw new Error('Wrapped media key komt niet overeen met mediaKeyId.');
  }

  if (encryption?.keyWrapAlg && wrappedKeyPayload.keyWrapAlg && encryption.keyWrapAlg !== wrappedKeyPayload.keyWrapAlg) {
    throw new Error('Wrapped media key komt niet overeen met keyWrapAlg.');
  }

  if (encryption?.sha256 && wrappedKeyPayload.seed && encryption.sha256 !== wrappedKeyPayload.seed) {
    throw new Error('Wrapped media key komt niet overeen met attachment hash.');
  }
  if (encryption?.wrappedMediaKeyDigest && encryption?.wrappedMediaKey) {
    const actualDigest = await computeTextDigestHex(encryption.wrappedMediaKey);
    if (actualDigest !== encryption.wrappedMediaKeyDigest) {
      throw new Error('Wrapped media key digest komt niet overeen.');
    }
  }

  return wrappedKeyPayload;
}

export async function validateAttachmentMediaKeyContract(encryption = {}) {
  const strategy = getAttachmentEncryptionCapability(encryption);

  if (strategy.isMock) {
    return validateMockWrappedMediaKeyContract(encryption);
  }

  return {
    mediaKeyId: encryption?.mediaKeyId || '',
    keyWrapAlg: encryption?.keyWrapAlg || '',
    seed: encryption?.sha256 || '',
  };
}

export async function buildMockAttachmentEncryptionMetadata(attachment, envelope) {
  const originalMimeType = attachment?.mimeType || envelope?.mimeType || 'application/octet-stream';
  const payloadSha256 = envelope?.payloadSha256 || '';
  const mediaKeyId = `mock-media-key-${payloadSha256.slice(0, 16) || 'attachment'}`;
  const keyWrapAlg = ATTACHMENT_MOCK_KEY_WRAP_ALG;
  const wrappedMediaKey = buildMockWrappedMediaKey({
    seed: payloadSha256,
    mediaKeyId,
    keyWrapAlg,
  });
  const wrappedMediaKeyDigest = await computeTextDigestHex(wrappedMediaKey);

  return {
    alg: ATTACHMENT_MOCK_ENVELOPE_ALG,
    strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
    keyId: attachment?.encryption?.keyId || `mock-key-${payloadSha256.slice(0, 12) || 'attachment'}`,
    iv: attachment?.encryption?.iv || `mock-iv-${payloadSha256.slice(0, 12) || 'attachment'}`,
    sha256: payloadSha256,
    mediaKeyId,
    keyWrapAlg,
    wrappedMediaKey,
    wrappedMediaKeyDigest,
    envelopeKind: envelope?.kind || ATTACHMENT_MOCK_ENVELOPE_KIND,
    originalMimeType,
  };
}

export function buildFutureAttachmentEncryptionDraft({
  originalMimeType = '',
  payloadSha256 = '',
} = {}) {
  return {
    alg: ATTACHMENT_FUTURE_ENVELOPE_ALG,
    strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    keyId: '',
    iv: '',
    sha256: payloadSha256,
    mediaKeyId: '',
    keyWrapAlg: ATTACHMENT_FUTURE_KEY_WRAP_ALG,
    wrappedMediaKey: '',
    wrappedMediaKeyDigest: '',
    envelopeKind: ATTACHMENT_FUTURE_ENVELOPE_KIND,
    originalMimeType,
  };
}

export async function buildAttachmentEncryptionMetadata(attachment, envelope) {
  const strategy = getAttachmentEncryptionCapability(attachment?.encryption || {});
  if (strategy.isFutureMedia) {
    return buildFutureAttachmentEncryptionDraft({
      originalMimeType: attachment?.mimeType || envelope?.mimeType || 'application/octet-stream',
      payloadSha256: envelope?.payloadSha256 || '',
    });
  }
  if (!strategy.canEncryptEnvelope) {
    return attachment?.encryption || null;
  }
  return buildMockAttachmentEncryptionMetadata(attachment, envelope);
}

export async function createMockEncryptedAttachmentEnvelope(attachment) {
  const sourceUrl = attachment?.downloadUrl || attachment?.url || '';
  const parsed = parseDataUrl(sourceUrl);
  if (!parsed) {
    throw new Error('Geen bruikbare data-url beschikbaar voor mock media-encryptie.');
  }

  const originalMimeType = attachment?.mimeType || parsed.mimeType || 'application/octet-stream';
  const payloadSha256 = await computeDigestHex(base64ToBytes(parsed.base64));
  const envelope = {
    version: 1,
    kind: ATTACHMENT_MOCK_ENVELOPE_KIND,
    mimeType: originalMimeType,
    name: attachment?.name || 'Bestand',
    size: Number.isFinite(attachment?.size) ? Number(attachment.size) : null,
    payloadBase64: parsed.base64,
    payloadSha256,
  };

  return {
    envelope,
    dataUrl: `data:application/pulse-e2ee-envelope+json;base64,${toBase64Utf8(JSON.stringify(envelope))}`,
  };
}

export async function verifyMockAttachmentEnvelope(envelope, expectedSha256 = '') {
  if (envelope?.kind !== 'pulse_mock_media_envelope' || typeof envelope?.payloadBase64 !== 'string') {
    throw new Error('Ongeldige mock media-envelope.');
  }

  const computedSha256 = await computeDigestHex(base64ToBytes(envelope.payloadBase64));
  if (envelope.payloadSha256 && envelope.payloadSha256 !== computedSha256) {
    throw new Error('Mock media-envelope integriteit mislukt.');
  }
  if (expectedSha256 && expectedSha256 !== computedSha256) {
    throw new Error('Attachment integriteit komt niet overeen met metadata.');
  }

  return {
    ...envelope,
    payloadSha256: envelope.payloadSha256 || computedSha256,
  };
}

export async function decryptMockAttachmentEnvelopeBlob(blob, expectedSha256 = '') {
  let envelopeText = '';

  if (typeof blob?.text === 'function') {
    envelopeText = await blob.text();
  } else if (typeof blob?.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();
    envelopeText = new TextDecoder().decode(buffer);
  } else {
    envelopeText = await new Response(blob).text();
  }

  const envelope = JSON.parse(envelopeText || '{}');
  const verifiedEnvelope = await verifyMockAttachmentEnvelope(envelope, expectedSha256);

  const binary = base64ToBytes(verifiedEnvelope.payloadBase64);
  const mimeType = verifiedEnvelope.mimeType || 'application/octet-stream';

  return new Blob([binary], { type: mimeType });
}

export async function decryptAttachmentEnvelopeBlob(blob, attachment = {}) {
  const strategy = getAttachmentEncryptionCapability(attachment?.encryption || {});

  if (strategy.isMock) {
    return decryptMockAttachmentEnvelopeBlob(
      blob,
      attachment?.expectedPayloadSha256 || attachment?.encryption?.sha256 || ''
    );
  }

  return blob;
}

export function decodeMockAttachmentEnvelopeDataUrl(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  try {
    return JSON.parse(fromBase64Utf8(parsed.base64));
  } catch {
    return null;
  }
}
