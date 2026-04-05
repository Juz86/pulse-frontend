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

function getAttachmentEnvelopeContract(attachment = {}, fallbackMimeType = 'application/octet-stream') {
  const encryption = attachment?.encryption || {};
  const isMockEnvelope = encryption.alg === 'mock-e2ee-envelope-v1';
  const strategyKey = typeof encryption.strategyKey === 'string' && encryption.strategyKey
    ? encryption.strategyKey
    : (isMockEnvelope ? 'mock_media_v1' : (encryption.alg ? 'external_contract' : 'none'));

  return {
    isMockEnvelope,
    strategyKey,
    contentEncoding: isMockEnvelope ? 'mock-e2ee-envelope-v1' : 'identity',
    envelopeKind: typeof encryption.envelopeKind === 'string' ? encryption.envelopeKind : '',
    expectedPayloadSha256: typeof encryption.sha256 === 'string' ? encryption.sha256 : '',
    mediaKeyId: typeof encryption.mediaKeyId === 'string' ? encryption.mediaKeyId : '',
    keyWrapAlg: typeof encryption.keyWrapAlg === 'string' ? encryption.keyWrapAlg : '',
    wrappedMediaKey: typeof encryption.wrappedMediaKey === 'string' ? encryption.wrappedMediaKey : '',
    wrappedMediaKeyDigest: typeof encryption.wrappedMediaKeyDigest === 'string' ? encryption.wrappedMediaKeyDigest : '',
    originalMimeType: typeof encryption.originalMimeType === 'string' && encryption.originalMimeType
      ? encryption.originalMimeType
      : (attachment?.mimeType || fallbackMimeType || 'application/octet-stream'),
  };
}

function buildStoredAttachmentEncryption(attachment = {}, id, fallbackSha = '') {
  const encryption = attachment?.encryption || {};

  return {
    alg: typeof encryption.alg === 'string' && encryption.alg ? encryption.alg : 'mock-storage-envelope',
    strategyKey: typeof encryption.strategyKey === 'string' && encryption.strategyKey
      ? encryption.strategyKey
      : (typeof encryption.alg === 'string' && encryption.alg === 'mock-e2ee-envelope-v1'
        ? 'mock_media_v1'
        : (typeof encryption.alg === 'string' && encryption.alg ? 'external_contract' : 'none')),
    keyId: typeof encryption.keyId === 'string' && encryption.keyId ? encryption.keyId : `mock-key-${id}`,
    iv: typeof encryption.iv === 'string' && encryption.iv ? encryption.iv : `mock-iv-${id}`,
    sha256: typeof encryption.sha256 === 'string' ? encryption.sha256 : fallbackSha,
    mediaKeyId: typeof encryption.mediaKeyId === 'string' ? encryption.mediaKeyId : '',
    keyWrapAlg: typeof encryption.keyWrapAlg === 'string' ? encryption.keyWrapAlg : '',
    wrappedMediaKey: typeof encryption.wrappedMediaKey === 'string' ? encryption.wrappedMediaKey : '',
    wrappedMediaKeyDigest: typeof encryption.wrappedMediaKeyDigest === 'string' ? encryption.wrappedMediaKeyDigest : '',
    envelopeKind: typeof encryption.envelopeKind === 'string' ? encryption.envelopeKind : '',
    originalMimeType: typeof encryption.originalMimeType === 'string'
      ? encryption.originalMimeType
      : (attachment?.mimeType || 'application/octet-stream'),
  };
}

export function buildStoredAttachmentMetadata({ id, baseUrl, attachment }) {
  const safeName = sanitizeFileName(attachment?.name || 'bestand');
  const downloadUrl = `${baseUrl}/attachments/${id}`;
  const mimeType = attachment?.mimeType || 'application/octet-stream';
  const contract = getAttachmentEnvelopeContract(attachment, mimeType);
  const isImage = contract.originalMimeType.startsWith('image/');

  return {
    name: attachment?.name || 'Bestand',
    url: '',
    downloadUrl,
    thumbnailUrl: isImage ? downloadUrl : '',
    storageKey: attachment?.storageKey || `mock-storage/${id}/${safeName}`,
    transfer: 'remote',
    mimeType,
    strategyKey: contract.strategyKey,
    originalMimeType: contract.originalMimeType,
    contentEncoding: contract.contentEncoding,
    envelopeKind: contract.envelopeKind,
    expectedPayloadSha256: contract.expectedPayloadSha256,
    size: Number.isFinite(attachment?.size) ? Number(attachment.size) : null,
    caption: attachment?.caption || '',
    encryption: buildStoredAttachmentEncryption(
      attachment,
      id,
      `mock-sha256-${Number.isFinite(attachment?.size) ? Number(attachment.size) : 0}`
    ),
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

  const contract = getAttachmentEnvelopeContract(attachment, parsed.mimeType || 'application/octet-stream');

  const storedRecord = {
    id,
    name: attachment.name || 'Bestand',
    mimeType: parsed.mimeType || 'application/octet-stream',
    strategyKey: contract.strategyKey,
    originalMimeType: contract.originalMimeType,
    contentEncoding: contract.contentEncoding,
    envelopeKind: contract.envelopeKind,
    expectedPayloadSha256: contract.expectedPayloadSha256,
    mediaKeyId: contract.mediaKeyId,
    keyWrapAlg: contract.keyWrapAlg,
    wrappedMediaKey: contract.wrappedMediaKey,
    wrappedMediaKeyDigest: contract.wrappedMediaKeyDigest,
    size: Number.isFinite(attachment.size) ? Number(attachment.size) : parsed.buffer.length,
    contentDisposition: isPreviewableMimeType(contract.originalMimeType)
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
    strategyKey: storedRecord.strategyKey,
    originalMimeType: storedRecord.originalMimeType,
    contentEncoding: storedRecord.contentEncoding,
    envelopeKind: storedRecord.envelopeKind,
    expectedPayloadSha256: storedRecord.expectedPayloadSha256,
    mediaKeyId: storedRecord.mediaKeyId,
    keyWrapAlg: storedRecord.keyWrapAlg,
    wrappedMediaKey: storedRecord.wrappedMediaKey,
    wrappedMediaKeyDigest: storedRecord.wrappedMediaKeyDigest,
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
    strategyKey: storedAttachment.strategyKey || (storedAttachment.contentEncoding === 'mock-e2ee-envelope-v1' ? 'mock_media_v1' : 'none'),
    originalMimeType: storedAttachment.originalMimeType || storedAttachment.mimeType,
    contentEncoding: storedAttachment.contentEncoding || 'identity',
    envelopeKind: storedAttachment.envelopeKind || '',
    expectedPayloadSha256: storedAttachment.expectedPayloadSha256 || '',
    mediaKeyId: storedAttachment.mediaKeyId || '',
    keyWrapAlg: storedAttachment.keyWrapAlg || '',
    wrappedMediaKey: storedAttachment.wrappedMediaKey || '',
    wrappedMediaKeyDigest: storedAttachment.wrappedMediaKeyDigest || '',
    size: storedAttachment.size,
    contentDisposition: storedAttachment.contentDisposition,
    encryption: {
      alg: storedAttachment.contentEncoding === 'mock-e2ee-envelope-v1' ? 'mock-e2ee-envelope-v1' : 'mock-storage-envelope',
      strategyKey: storedAttachment.strategyKey || (storedAttachment.contentEncoding === 'mock-e2ee-envelope-v1' ? 'mock_media_v1' : 'none'),
      sha256: storedAttachment.expectedPayloadSha256 || '',
      mediaKeyId: storedAttachment.mediaKeyId || '',
      keyWrapAlg: storedAttachment.keyWrapAlg || '',
      wrappedMediaKey: storedAttachment.wrappedMediaKey || '',
      wrappedMediaKeyDigest: storedAttachment.wrappedMediaKeyDigest || '',
      envelopeKind: storedAttachment.envelopeKind || '',
      originalMimeType: storedAttachment.originalMimeType || storedAttachment.mimeType,
    },
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
