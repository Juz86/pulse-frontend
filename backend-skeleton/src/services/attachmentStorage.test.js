import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  buildStoredAttachmentMetadata,
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
});
