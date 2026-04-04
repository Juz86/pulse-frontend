import { BACKEND_URL } from '../../services/socket';
import { decryptMockAttachmentEnvelopeBlob } from './attachmentCrypto';
import {
  isImageAttachment,
  normalizeAttachmentPayload,
  resolveAttachmentUrl,
} from './attachmentPayload';

const attachmentMetadataCache = new Map();

export async function passthroughDecryptAttachmentBlob(blob) {
  return blob;
}

export async function decryptAttachmentBlob(blob, attachment) {
  if (attachment?.encryption?.alg === 'mock-e2ee-envelope-v1') {
    return decryptMockAttachmentEnvelopeBlob(blob, attachment?.encryption?.sha256 || '');
  }

  return passthroughDecryptAttachmentBlob(blob);
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
    return {
      attachment: resolvedAttachment,
      url: accessInfo.url,
      revoke: () => {},
      isObjectUrl: false,
    };
  }

  const encryptedBlob = await fetchAttachmentBlob(resolvedAttachment, fetchImpl);
  const decryptedBlob = await decryptAttachmentBlobOverride(encryptedBlob, resolvedAttachment);
  const objectUrl = createObjectUrl(decryptedBlob);

  return {
    attachment: resolvedAttachment,
    url: objectUrl,
    revoke: () => revokeObjectUrl(objectUrl),
    isObjectUrl: true,
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
