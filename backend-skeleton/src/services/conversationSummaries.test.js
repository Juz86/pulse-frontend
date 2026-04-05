import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveConversationSummary } from './conversationSummaries.js';

test('deriveConversationSummary keeps attachment contract metadata and file name', () => {
  const summary = deriveConversationSummary({
    messageType: 'attachment',
    attachment: {
      name: 'rapport.pdf',
      transfer: 'remote',
      contentEncoding: 'mock-e2ee-envelope-v1',
      originalMimeType: 'application/pdf',
      expectedPayloadSha256: 'hash-1',
    },
  });

  assert.deepEqual(summary, {
    lastMessage: 'Bijlage: rapport.pdf',
    lastMessageType: 'attachment',
    lastAttachmentTransfer: 'remote',
    lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
    lastAttachmentOriginalMimeType: 'application/pdf',
    lastAttachmentExpectedPayloadSha256: 'hash-1',
  });
});

test('deriveConversationSummary decodes signal_v1 text payloads for previews', () => {
  const summary = deriveConversationSummary({
    protocol: 'signal_v1',
    messageType: 'text',
    ciphertext: Buffer.from('Hallo wereld', 'utf8').toString('base64'),
  });

  assert.equal(summary.lastMessage, 'Hallo wereld');
  assert.equal(summary.lastMessageType, 'text');
  assert.equal(summary.lastAttachmentTransfer, null);
});
