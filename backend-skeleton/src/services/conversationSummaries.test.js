import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyConversationSummaryFields,
  buildConversationSummaryAttachmentPreview,
  buildConversationSummaryAttachmentPayload,
  deriveConversationSummary,
} from './conversationSummaries.js';

test('deriveConversationSummary keeps attachment contract metadata and file name', () => {
  const summary = deriveConversationSummary({
    messageType: 'attachment',
    attachment: {
      name: 'rapport.pdf',
      transfer: 'remote',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'application/pdf',
      expectedPayloadSha256: 'hash-1',
      encryption: {
        mediaKeyId: 'media-key-1',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
        wrappedMediaKeyDigest: 'wrapped-digest-1',
      },
    },
  });

  assert.deepEqual(summary, {
    lastMessage: 'Bijlage: rapport.pdf',
    lastMessageType: 'attachment',
    lastAttachmentName: 'rapport.pdf',
    lastAttachmentTransfer: 'remote',
    lastAttachmentStrategyKey: null,
    lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
    lastAttachmentEnvelopeKind: 'pulse_mock_media_envelope',
    lastAttachmentOriginalMimeType: 'application/pdf',
    lastAttachmentExpectedPayloadSha256: 'hash-1',
    lastAttachmentMediaKeyId: 'media-key-1',
    lastAttachmentKeyWrapAlg: 'pulse_mock_media_key_wrap_v1',
    lastAttachmentWrappedMediaKeyDigest: 'wrapped-digest-1',
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
  assert.equal(summary.lastAttachmentEnvelopeKind, null);
});

test('deriveConversationSummary falls back cleanly when no visible message remains', () => {
  const summary = deriveConversationSummary(null, '');

  assert.deepEqual(summary, {
    lastMessage: '',
    lastMessageType: null,
    lastAttachmentName: null,
    lastAttachmentTransfer: null,
    lastAttachmentStrategyKey: null,
    lastAttachmentEncoding: null,
    lastAttachmentEnvelopeKind: null,
    lastAttachmentOriginalMimeType: null,
    lastAttachmentExpectedPayloadSha256: null,
    lastAttachmentMediaKeyId: null,
    lastAttachmentKeyWrapAlg: null,
    lastAttachmentWrappedMediaKeyDigest: null,
  });
});

test('applyConversationSummaryFields projects a stable conversation summary shape', () => {
  assert.deepEqual(
    applyConversationSummaryFields(
      { id: 'conv-1', updatedAt: '2026-01-01T10:00:00.000Z', custom: true },
      { lastMessage: 'Hallo', lastMessageType: 'text' }
    ),
    {
      id: 'conv-1',
      updatedAt: '2026-01-01T10:00:00.000Z',
      custom: true,
      lastMessage: 'Hallo',
      lastMessageType: 'text',
      lastAttachmentName: null,
      lastAttachmentTransfer: null,
      lastAttachmentStrategyKey: null,
      lastAttachmentEncoding: null,
      lastAttachmentEnvelopeKind: null,
      lastAttachmentOriginalMimeType: null,
      lastAttachmentExpectedPayloadSha256: null,
      lastAttachmentMediaKeyId: null,
      lastAttachmentKeyWrapAlg: null,
      lastAttachmentWrappedMediaKeyDigest: null,
    }
  );
});

test('buildConversationSummaryAttachmentPayload reconstructs attachment contract fields from a summary', () => {
  assert.deepEqual(
    buildConversationSummaryAttachmentPayload({
      lastAttachmentTransfer: 'remote',
      lastAttachmentStrategyKey: 'mock_media_v1',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentEnvelopeKind: 'pulse_mock_media_envelope',
      lastAttachmentOriginalMimeType: 'application/pdf',
      lastAttachmentExpectedPayloadSha256: 'hash-1',
      lastAttachmentMediaKeyId: 'media-key-1',
      lastAttachmentKeyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      lastAttachmentWrappedMediaKeyDigest: 'wrapped-digest-1',
    }),
    {
      name: 'Bestand',
      transfer: 'remote',
      strategyKey: 'mock_media_v1',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'application/pdf',
      expectedPayloadSha256: 'hash-1',
      encryption: {
        strategyKey: 'mock_media_v1',
        mediaKeyId: 'media-key-1',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
        wrappedMediaKeyDigest: 'wrapped-digest-1',
        envelopeKind: 'pulse_mock_media_envelope',
      },
    }
  );
});

test('buildConversationSummaryAttachmentPreview reconstructs preview text from summary fields', () => {
  assert.deepEqual(
    buildConversationSummaryAttachmentPreview({
      lastAttachmentName: 'rapport.pdf',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
    }),
    {
      attachment: {
        name: 'rapport.pdf',
        transfer: 'remote',
        strategyKey: null,
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: '',
        originalMimeType: '',
        expectedPayloadSha256: '',
        encryption: {
          strategyKey: null,
          mediaKeyId: '',
          keyWrapAlg: '',
          wrappedMediaKeyDigest: '',
          envelopeKind: '',
        },
      },
      previewText: 'Bijlage: rapport.pdf',
    }
  );
});
