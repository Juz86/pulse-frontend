import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  buildStoredAttachmentMetadata,
  deleteStoredAttachmentFromMessageAttachment,
  getAttachmentIdFromUrl,
  isDataUrl,
  parseDataUrl,
  storeMockAttachment,
  getStoredAttachment,
} from './attachmentStorage.js';

let storageDir;

test.before(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'pulse-e2ee-attachments-test-'));
  process.env.PULSE_ATTACHMENT_MOCK_DIR = storageDir;
});

test.after(async () => {
  await rm(storageDir, { recursive: true, force: true });
  delete process.env.PULSE_ATTACHMENT_MOCK_DIR;
});

test('isDataUrl recognizes base64 data urls', () => {
  assert.equal(isDataUrl('data:text/plain;base64,SGVsbG8='), true);
  assert.equal(isDataUrl('https://example.com/file.txt'), false);
});

test('parseDataUrl decodes mime type and buffer', () => {
  const parsed = parseDataUrl('data:text/plain;base64,SGVsbG8=');

  assert.equal(parsed.mimeType, 'text/plain');
  assert.equal(parsed.buffer.toString('utf8'), 'Hello');
});

test('buildStoredAttachmentMetadata creates remote mock payload', () => {
  const metadata = buildStoredAttachmentMetadata({
    id: 'attachment-1',
    baseUrl: 'http://localhost:3001',
    attachment: {
      name: 'foto.png',
      mimeType: 'image/png',
      size: 123,
      caption: 'Test',
    },
  });

  assert.equal(metadata.transfer, 'remote');
  assert.equal(metadata.downloadUrl, 'http://localhost:3001/attachments/attachment-1');
  assert.equal(metadata.thumbnailUrl, 'http://localhost:3001/attachments/attachment-1');
  assert.equal(metadata.encryption.alg, 'mock-storage-envelope');
  assert.equal(metadata.contentEncoding, 'identity');
  assert.equal(metadata.originalMimeType, 'image/png');
  assert.equal(metadata.expectedPayloadSha256, '');
});

test('storeMockAttachment persists inline data for retrieval', async () => {
  const metadata = await storeMockAttachment({
    baseUrl: 'http://localhost:3001',
    attachment: {
      name: 'document.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    },
  });

  const attachmentId = metadata.downloadUrl.split('/').pop();
  const stored = await getStoredAttachment(attachmentId);

  assert.ok(stored);
  assert.equal(stored.mimeType, 'text/plain');
  assert.equal(stored.buffer.toString('utf8'), 'Hello');
  assert.equal(stored.contentEncoding, 'identity');
  assert.equal(stored.expectedPayloadSha256, '');
});

test('storeMockAttachment preserves mock envelope contract metadata', async () => {
  const metadata = await storeMockAttachment({
    baseUrl: 'http://localhost:3001',
    attachment: {
      name: 'photo.png',
      url: 'data:application/pulse-e2ee-envelope+json;base64,eyJraW5kIjoicHVsc2VfbW9ja19tZWRpYV9lbnZlbG9wZSIsIm1pbWVUeXBlIjoiaW1hZ2UvcG5nIiwicGF5bG9hZEJhc2U2NCI6ImFiYyJ9',
      mimeType: 'image/png',
      size: 3,
      encryption: {
        alg: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: 'image/png',
        sha256: 'abcd1234',
      },
    },
  });

  const attachmentId = metadata.downloadUrl.split('/').pop();
  const stored = await getStoredAttachment(attachmentId);

  assert.ok(stored);
  assert.equal(stored.mimeType, 'application/pulse-e2ee-envelope+json');
  assert.equal(stored.originalMimeType, 'image/png');
  assert.equal(stored.contentEncoding, 'mock-e2ee-envelope-v1');
  assert.equal(stored.envelopeKind, 'pulse_mock_media_envelope');
  assert.equal(stored.expectedPayloadSha256, 'abcd1234');
  assert.equal(metadata.contentEncoding, 'mock-e2ee-envelope-v1');
  assert.equal(metadata.originalMimeType, 'image/png');
  assert.equal(metadata.expectedPayloadSha256, 'abcd1234');
});

test('getAttachmentIdFromUrl extracts the stored attachment id', () => {
  assert.equal(
    getAttachmentIdFromUrl('http://localhost:3001/attachments/attachment-123'),
    'attachment-123'
  );
});

test('deleteStoredAttachmentFromMessageAttachment removes stored binary and metadata', async () => {
  const metadata = await storeMockAttachment({
    baseUrl: 'http://localhost:3001',
    attachment: {
      name: 'document.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    },
  });

  const attachmentId = metadata.downloadUrl.split('/').pop();
  assert.ok(await getStoredAttachment(attachmentId));

  const deleted = await deleteStoredAttachmentFromMessageAttachment({
    downloadUrl: metadata.downloadUrl,
  });

  assert.equal(deleted, true);
  assert.equal(await getStoredAttachment(attachmentId), null);
});
