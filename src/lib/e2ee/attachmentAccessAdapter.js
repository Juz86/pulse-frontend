import { BACKEND_URL } from '../../services/socket';
import {
  decryptMockAttachmentEnvelopeBlob,
  unwrapMockWrappedMediaKey,
  validateMockWrappedMediaKeyContract,
} from './attachmentCrypto';
import {
  isImageAttachment,
  normalizeAttachmentPayload,
  resolveAttachmentUrl,
} from './attachmentPayload';

const attachmentMetadataCache = new Map();

export async function passthroughDecryptAttachmentBlob(blob) {
  return blob;
}

export function resolveExpectedAttachmentSha256(attachment) {
  return attachment?.expectedPayloadSha256 || attachment?.encryption?.sha256 || '';
}

export function resolveAttachmentContractFields(attachment) {
  return {
    expectedPayloadSha256: resolveExpectedAttachmentSha256(attachment),
    contentEncoding: attachment?.contentEncoding || '',
    envelopeKind: attachment?.envelopeKind || attachment?.encryption?.envelopeKind || '',
    originalMimeType: attachment?.originalMimeType || attachment?.encryption?.originalMimeType || '',
    mediaKeyId: attachment?.encryption?.mediaKeyId || '',
    keyWrapAlg: attachment?.encryption?.keyWrapAlg || '',
    wrappedMediaKey: attachment?.encryption?.wrappedMediaKey || '',
    wrappedMediaKeyDigest: attachment?.encryption?.wrappedMediaKeyDigest || '',
  };
}

export function buildResolvedAttachmentAccessContract(attachment) {
  const contract = resolveAttachmentContractFields(attachment);

  return {
    ...contract,
    integrityVerified: Boolean(contract.expectedPayloadSha256),
    wrappedKeyVerified: Boolean(
      attachment?.encryption?.alg === 'mock-e2ee-envelope-v1'
      && contract.mediaKeyId
      && contract.keyWrapAlg
      && contract.wrappedMediaKey
      && contract.wrappedMediaKeyDigest
    ),
  };
}

export function buildAttachmentAccessVerification(contract = {}, unwrapContext = null) {
  return {
    integrityVerified: Boolean(contract?.integrityVerified),
    wrappedKeyVerified: Boolean(contract?.wrappedKeyVerified),
    unwrapKind: unwrapContext?.unwrapKind || '',
  };
}

export async function decryptAttachmentBlob(blob, attachment) {
  if (attachment?.encryption?.alg === 'mock-e2ee-envelope-v1') {
    await validateMockWrappedMediaKeyContract(attachment?.encryption || {});
    return decryptMockAttachmentEnvelopeBlob(blob, resolveExpectedAttachmentSha256(attachment));
  }

  return passthroughDecryptAttachmentBlob(blob);
}

export async function resolveAttachmentUnwrapContext(attachment) {
  if (attachment?.encryption?.alg === 'mock-e2ee-envelope-v1') {
    return unwrapMockWrappedMediaKey(attachment?.encryption || {});
  }

  return {
    mediaKeyId: attachment?.encryption?.mediaKeyId || '',
    keyWrapAlg: attachment?.encryption?.keyWrapAlg || '',
    payloadSha256: resolveExpectedAttachmentSha256(attachment),
    wrappedMediaKey: attachment?.encryption?.wrappedMediaKey || '',
    wrappedMediaKeyDigest: attachment?.encryption?.wrappedMediaKeyDigest || '',
    unwrapKind: attachment?.encryption ? 'attachment_encryption_contract' : 'none',
  };
}

export function getAttachmentIdFromAttachment(attachment) {
  const url = resolveAttachmentUrl(attachment);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || null;
  } catch {
    return null;
  }
}

export function getAttachmentContractFromHeaders(headers) {
  return {
    expectedPayloadSha256: headers?.get?.('X-Pulse-Expected-Sha256') || '',
    contentEncoding: headers?.get?.('X-Pulse-Content-Encoding') || '',
    envelopeKind: headers?.get?.('X-Pulse-Envelope-Kind') || '',
    originalMimeType: headers?.get?.('X-Pulse-Original-MimeType') || '',
    mediaKeyId: headers?.get?.('X-Pulse-Media-Key-Id') || '',
    keyWrapAlg: headers?.get?.('X-Pulse-Key-Wrap-Alg') || '',
    wrappedMediaKey: '',
    wrappedMediaKeyDigest: headers?.get?.('X-Pulse-Wrapped-Media-Key-Digest') || '',
  };
}

export function mapAttachmentContractError(error, {
  hashMessage = 'Attachment metadata-integriteit komt niet overeen',
  contentEncodingMessage = 'Attachment content-encoding komt niet overeen',
  envelopeKindMessage = 'Attachment envelope-kind komt niet overeen',
  originalMimeTypeMessage = 'Attachment original mime type komt niet overeen',
  mediaKeyIdMessage = 'Attachment media-key-id komt niet overeen',
  keyWrapAlgMessage = 'Attachment key-wrap-algoritme komt niet overeen',
  wrappedMediaKeyMessage = 'Attachment wrapped media key komt niet overeen',
  wrappedMediaKeyDigestMessage = 'Attachment wrapped media key digest komt niet overeen',
} = {}) {
  if (error?.message === 'Attachment metadata-integriteit komt niet overeen') {
    return new Error(hashMessage);
  }
  if (error?.message === 'Attachment content-encoding komt niet overeen') {
    return new Error(contentEncodingMessage);
  }
  if (error?.message === 'Attachment envelope-kind komt niet overeen') {
    return new Error(envelopeKindMessage);
  }
  if (error?.message === 'Attachment original mime type komt niet overeen') {
    return new Error(originalMimeTypeMessage);
  }
  if (error?.message === 'Attachment media-key-id komt niet overeen') {
    return new Error(mediaKeyIdMessage);
  }
  if (error?.message === 'Attachment key-wrap-algoritme komt niet overeen') {
    return new Error(keyWrapAlgMessage);
  }
  if (error?.message === 'Attachment wrapped media key komt niet overeen') {
    return new Error(wrappedMediaKeyMessage);
  }
  if (error?.message === 'Attachment wrapped media key digest komt niet overeen') {
    return new Error(wrappedMediaKeyDigestMessage);
  }

  return error;
}

export function getAttachmentAccessInfo(attachment) {
  const resolvedUrl = resolveAttachmentUrl(attachment);

  return {
    url: resolvedUrl,
    canOpen: !!resolvedUrl,
    canDownload: !!resolvedUrl,
    isImage: isImageAttachment(attachment),
    needsRemoteFetch: attachment?.transfer === 'remote' && !!attachment?.encryption,
  };
}

export function mergeAttachmentMetadata(baseAttachment, metadataAttachment) {
  return normalizeAttachmentPayload({
    ...baseAttachment,
    ...metadataAttachment,
  });
}

export function assertAttachmentMetadataIntegrity(baseAttachment, metadataAttachment) {
  const baseContract = resolveAttachmentContractFields(baseAttachment);
  const metadataContract = resolveAttachmentContractFields(metadataAttachment);

  if (
    baseContract.expectedPayloadSha256
    && metadataContract.expectedPayloadSha256
    && baseContract.expectedPayloadSha256 !== metadataContract.expectedPayloadSha256
  ) {
    throw new Error('Attachment metadata-integriteit komt niet overeen');
  }

  if (
    baseContract.contentEncoding
    && metadataContract.contentEncoding
    && baseContract.contentEncoding !== metadataContract.contentEncoding
  ) {
    throw new Error('Attachment content-encoding komt niet overeen');
  }

  if (
    baseContract.envelopeKind
    && metadataContract.envelopeKind
    && baseContract.envelopeKind !== metadataContract.envelopeKind
  ) {
    throw new Error('Attachment envelope-kind komt niet overeen');
  }

  if (
    baseContract.originalMimeType
    && metadataContract.originalMimeType
    && baseContract.originalMimeType !== metadataContract.originalMimeType
  ) {
    throw new Error('Attachment original mime type komt niet overeen');
  }

  if (
    baseContract.mediaKeyId
    && metadataContract.mediaKeyId
    && baseContract.mediaKeyId !== metadataContract.mediaKeyId
  ) {
    throw new Error('Attachment media-key-id komt niet overeen');
  }

  if (
    baseContract.keyWrapAlg
    && metadataContract.keyWrapAlg
    && baseContract.keyWrapAlg !== metadataContract.keyWrapAlg
  ) {
    throw new Error('Attachment key-wrap-algoritme komt niet overeen');
  }

  if (
    baseContract.wrappedMediaKey
    && metadataContract.wrappedMediaKey
    && baseContract.wrappedMediaKey !== metadataContract.wrappedMediaKey
  ) {
    throw new Error('Attachment wrapped media key komt niet overeen');
  }

  if (
    baseContract.wrappedMediaKeyDigest
    && metadataContract.wrappedMediaKeyDigest
    && baseContract.wrappedMediaKeyDigest !== metadataContract.wrappedMediaKeyDigest
  ) {
    throw new Error('Attachment wrapped media key digest komt niet overeen');
  }
}

export function buildAttachmentMetadataUrl(attachment) {
  const attachmentId = getAttachmentIdFromAttachment(attachment);
  return attachmentId ? `${BACKEND_URL}/api/attachments/${attachmentId}/meta` : '';
}

export function getCachedAttachmentMetadata(attachment) {
  const attachmentId = getAttachmentIdFromAttachment(attachment);
  return attachmentId ? attachmentMetadataCache.get(attachmentId) || null : null;
}

export function cacheAttachmentMetadata(attachment, metadataAttachment) {
  const attachmentId = getAttachmentIdFromAttachment(attachment) || getAttachmentIdFromAttachment(metadataAttachment);
  if (!attachmentId) return metadataAttachment;

  const merged = mergeAttachmentMetadata(attachment, metadataAttachment);
  attachmentMetadataCache.set(attachmentId, merged);
  return merged;
}

export function clearAttachmentMetadataCache() {
  attachmentMetadataCache.clear();
}

export async function fetchAttachmentMetadata(attachment, user, fetchImpl = fetch) {
  const cachedMetadata = getCachedAttachmentMetadata(attachment);
  if (cachedMetadata) {
    return cachedMetadata;
  }

  const metadataUrl = buildAttachmentMetadataUrl(attachment);
  if (!metadataUrl) {
    throw new Error('Geen attachment metadata-url beschikbaar.');
  }
  if (!user) {
    throw new Error('Geen gebruiker beschikbaar voor attachment metadata.');
  }

  const token = await user.getIdToken();
  const response = await fetchImpl(metadataUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.attachment) {
    throw new Error(data?.error || 'Attachment metadata ophalen mislukt');
  }

  try {
    assertAttachmentMetadataIntegrity(attachment, data.attachment);
    assertAttachmentMetadataIntegrity(data.attachment, getAttachmentContractFromHeaders(response.headers));
  } catch (error) {
    throw mapAttachmentContractError(error, {
      hashMessage: 'Attachment metadata-integriteit komt niet overeen',
      contentEncodingMessage: 'Attachment metadata content-encoding komt niet overeen',
      envelopeKindMessage: 'Attachment metadata envelope-kind komt niet overeen',
      originalMimeTypeMessage: 'Attachment metadata original mime type komt niet overeen',
      mediaKeyIdMessage: 'Attachment metadata media-key-id komt niet overeen',
      keyWrapAlgMessage: 'Attachment metadata key-wrap-algoritme komt niet overeen',
      wrappedMediaKeyMessage: 'Attachment metadata wrapped media key komt niet overeen',
      wrappedMediaKeyDigestMessage: 'Attachment metadata wrapped media key digest komt niet overeen',
    });
  }

  return cacheAttachmentMetadata(attachment, data.attachment);
}

export async function resolveAttachmentForAccess(attachment, user, fetchImpl = fetch) {
  const accessInfo = getAttachmentAccessInfo(attachment);
  if (!accessInfo.needsRemoteFetch) {
    return normalizeAttachmentPayload(attachment);
  }

  return fetchAttachmentMetadata(attachment, user, fetchImpl);
}

export async function fetchAttachmentBlob(attachment, fetchImpl = fetch) {
  const { url } = getAttachmentAccessInfo(attachment);
  if (!url) {
    throw new Error('Geen attachment download-url beschikbaar.');
  }

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error('Attachment downloaden mislukt');
  }

  const responseContract = getAttachmentContractFromHeaders(response.headers);
  const localContract = resolveAttachmentContractFields(attachment);

  try {
    assertAttachmentMetadataIntegrity(attachment, responseContract);

    if (
      localContract.mediaKeyId
      && responseContract.mediaKeyId
      && localContract.mediaKeyId !== responseContract.mediaKeyId
    ) {
      throw new Error('Attachment media-key-id komt niet overeen');
    }

    if (
      localContract.keyWrapAlg
      && responseContract.keyWrapAlg
      && localContract.keyWrapAlg !== responseContract.keyWrapAlg
    ) {
      throw new Error('Attachment key-wrap-algoritme komt niet overeen');
    }
  } catch (error) {
    throw mapAttachmentContractError(error, {
      hashMessage: 'Attachment-integriteitsmetadata komt niet overeen',
      contentEncodingMessage: 'Attachment content-encoding header komt niet overeen',
      envelopeKindMessage: 'Attachment envelope-kind header komt niet overeen',
      originalMimeTypeMessage: 'Attachment original mime type header komt niet overeen',
      mediaKeyIdMessage: 'Attachment media-key-id header komt niet overeen',
      keyWrapAlgMessage: 'Attachment key-wrap-algoritme header komt niet overeen',
      wrappedMediaKeyDigestMessage: 'Attachment wrapped media key digest header komt niet overeen',
    });
  }

  return response.blob();
}

export async function prepareAttachmentBinaryAccess(
  attachment,
  user,
  {
    fetchImpl = fetch,
    decryptAttachmentBlob: decryptAttachmentBlobOverride = decryptAttachmentBlob,
    createObjectUrl = (blob) => URL.createObjectURL(blob),
    revokeObjectUrl = (url) => URL.revokeObjectURL(url),
  } = {}
) {
  const resolvedAttachment = await resolveAttachmentForAccess(attachment, user, fetchImpl);
  const accessInfo = getAttachmentAccessInfo(resolvedAttachment);

  if (!accessInfo.needsRemoteFetch) {
    const unwrapContext = await resolveAttachmentUnwrapContext(resolvedAttachment);
    const contract = buildResolvedAttachmentAccessContract(resolvedAttachment);
    const verifiedAttachment = normalizeAttachmentPayload({
      ...resolvedAttachment,
      accessVerification: buildAttachmentAccessVerification(contract, unwrapContext),
    });
    return {
      attachment: verifiedAttachment,
      contract,
      url: accessInfo.url,
      revoke: () => {},
      isObjectUrl: false,
      unwrapContext,
    };
  }

  const encryptedBlob = await fetchAttachmentBlob(resolvedAttachment, fetchImpl);
  const decryptedBlob = await decryptAttachmentBlobOverride(encryptedBlob, resolvedAttachment);
  const objectUrl = createObjectUrl(decryptedBlob);
  const unwrapContext = await resolveAttachmentUnwrapContext(resolvedAttachment);
  const contract = buildResolvedAttachmentAccessContract(resolvedAttachment);
  const verifiedAttachment = normalizeAttachmentPayload({
    ...resolvedAttachment,
    accessVerification: buildAttachmentAccessVerification(contract, unwrapContext),
  });

  return {
    attachment: verifiedAttachment,
    contract,
    url: objectUrl,
    revoke: () => revokeObjectUrl(objectUrl),
    isObjectUrl: true,
    unwrapContext,
  };
}

export function openAttachmentInNewTab(attachment, opener = window.open) {
  const { url } = getAttachmentAccessInfo(attachment);
  if (!url) return false;
  opener(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function triggerAttachmentDownload(attachment, doc = document) {
  const { url } = getAttachmentAccessInfo(attachment);
  if (!url) return false;

  const link = doc.createElement('a');
  link.href = url;
  link.download = attachment?.name || 'bijlage';
  link.rel = 'noopener noreferrer';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}
