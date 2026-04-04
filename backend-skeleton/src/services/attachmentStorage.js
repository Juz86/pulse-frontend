import { randomUUID } from 'crypto';

const attachmentStore = new Map();

export function isDataUrl(value = '') {
  return typeof value === 'string' && value.startsWith('data:');
}

export function parseDataUrl(dataUrl = '') {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1] || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function sanitizeFileName(name = 'bestand') {
  return String(name)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'bestand';
}

function isPreviewableMimeType(mimeType = '') {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/');
}

export function buildStoredAttachmentMetadata({ id, baseUrl, attachment }) {
  const safeName = sanitizeFileName(attachment?.name || 'bestand');
  const downloadUrl = `${baseUrl}/attachments/${id}`;
  const mimeType = attachment?.mimeType || 'application/octet-stream';
  const isImage = mimeType.startsWith('image/');

  return {
    name: attachment?.name || 'Bestand',
    url: '',
    downloadUrl,
    thumbnailUrl: isImage ? downloadUrl : '',
    storageKey: attachment?.storageKey || `mock-storage/${id}/${safeName}`,
    transfer: 'remote',
    mimeType,
    size: Number.isFinite(attachment?.size) ? Number(attachment.size) : null,
    caption: attachment?.caption || '',
    encryption: attachment?.encryption || {
      alg: 'mock-storage-envelope',
      keyId: `mock-key-${id}`,
      iv: `mock-iv-${id}`,
      sha256: `mock-sha256-${Number.isFinite(attachment?.size) ? Number(attachment.size) : 0}`,
    },
  };
}

export function storeMockAttachment({ attachment, baseUrl }) {
  if (!attachment || typeof attachment !== 'object') {
    throw new Error('invalid_attachment_payload');
  }

  const id = randomUUID();
  const sourceUrl = attachment.downloadUrl || attachment.url || '';

  if (!isDataUrl(sourceUrl)) {
    return buildStoredAttachmentMetadata({ id, baseUrl, attachment });
  }

  const parsed = parseDataUrl(sourceUrl);
  if (!parsed) {
    throw new Error('unsupported_attachment_source');
  }

  attachmentStore.set(id, {
    id,
    name: attachment.name || 'Bestand',
    mimeType: attachment.mimeType || parsed.mimeType || 'application/octet-stream',
    size: Number.isFinite(attachment.size) ? Number(attachment.size) : parsed.buffer.length,
    contentDisposition: isPreviewableMimeType(attachment.mimeType || parsed.mimeType || '')
      ? 'inline'
      : 'attachment',
    buffer: parsed.buffer,
  });

  return buildStoredAttachmentMetadata({ id, baseUrl, attachment });
}

export function getStoredAttachment(id) {
  return attachmentStore.get(id) || null;
}
