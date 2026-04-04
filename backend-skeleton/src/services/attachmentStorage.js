import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import path from 'path';

const attachmentStore = new Map();

export function getMockStorageDir() {
  return path.resolve(process.env.PULSE_ATTACHMENT_MOCK_DIR || '/tmp/pulse-e2ee-attachments');
}

function getAttachmentPaths(id) {
  const baseDir = getMockStorageDir();
  return {
    baseDir,
    binaryPath: path.join(baseDir, `${id}.bin`),
    metadataPath: path.join(baseDir, `${id}.json`),
  };
}

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

export async function storeMockAttachment({ attachment, baseUrl }) {
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

  const storedRecord = {
    id,
    name: attachment.name || 'Bestand',
    mimeType: attachment.mimeType || parsed.mimeType || 'application/octet-stream',
    size: Number.isFinite(attachment.size) ? Number(attachment.size) : parsed.buffer.length,
    contentDisposition: isPreviewableMimeType(attachment.mimeType || parsed.mimeType || '')
      ? 'inline'
      : 'attachment',
    buffer: parsed.buffer,
  };
  const { baseDir, binaryPath, metadataPath } = getAttachmentPaths(id);
  await mkdir(baseDir, { recursive: true });
  await writeFile(binaryPath, storedRecord.buffer);
  await writeFile(metadataPath, JSON.stringify({
    id: storedRecord.id,
    name: storedRecord.name,
    mimeType: storedRecord.mimeType,
    size: storedRecord.size,
    contentDisposition: storedRecord.contentDisposition,
  }, null, 2), 'utf8');

  attachmentStore.set(id, storedRecord);

  return buildStoredAttachmentMetadata({ id, baseUrl, attachment });
}

export async function getStoredAttachment(id) {
  if (attachmentStore.has(id)) {
    return attachmentStore.get(id) || null;
  }

  const { binaryPath, metadataPath } = getAttachmentPaths(id);

  try {
    await stat(binaryPath);
    const [buffer, metadataRaw] = await Promise.all([
      readFile(binaryPath),
      readFile(metadataPath, 'utf8'),
    ]);
    const metadata = JSON.parse(metadataRaw);
    const storedRecord = {
      ...metadata,
      buffer,
    };
    attachmentStore.set(id, storedRecord);
    return storedRecord;
  } catch {
    return null;
  }
}

export async function getStoredAttachmentMetadata(id) {
  const storedAttachment = await getStoredAttachment(id);
  if (!storedAttachment) return null;

  return {
    id: storedAttachment.id,
    name: storedAttachment.name,
    mimeType: storedAttachment.mimeType,
    size: storedAttachment.size,
    contentDisposition: storedAttachment.contentDisposition,
  };
}

export function getAttachmentIdFromUrl(downloadUrl = '') {
  try {
    const parsed = new URL(downloadUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || null;
  } catch {
    return null;
  }
}

export async function deleteStoredAttachment(id) {
  if (!id) return false;

  attachmentStore.delete(id);
  const { binaryPath, metadataPath } = getAttachmentPaths(id);
  await Promise.all([
    rm(binaryPath, { force: true }),
    rm(metadataPath, { force: true }),
  ]);
  return true;
}

export async function deleteStoredAttachmentFromMessageAttachment(attachment = null) {
  const attachmentId = getAttachmentIdFromUrl(attachment?.downloadUrl || attachment?.url || '');
  if (!attachmentId) return false;
  return deleteStoredAttachment(attachmentId);
}

export async function clearStoredAttachments() {
  attachmentStore.clear();
  await rm(getMockStorageDir(), { recursive: true, force: true });
}
