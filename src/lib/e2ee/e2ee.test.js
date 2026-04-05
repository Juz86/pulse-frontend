import {
  buildPendingMessage,
  getMessageDisplayText,
  normalizeIncomingMessage,
  patchPendingMessageAsFailed,
  patchPendingMessageAsSent,
} from './messageModel';
import {
  applyConversationSummaryToList,
  buildConversationSummaryUpdate,
  getConversationAttachmentSummaryPresentation,
  getConversationPreview,
  normalizeConversationAttachmentSummary,
} from './conversationSummaries';
import {
  buildTransportAttachmentPayload,
  buildForwardServicePayload,
  buildRetryServicePayload,
} from './messageTransportPayload';
import {
  ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE,
  canApplyPlaintextEditUpdate,
  canEditMessage,
  isEncryptedProtocol,
} from './policy';
import {
  MAX_E2EE_ATTACHMENT_BYTES,
  isImageAttachment,
  normalizeAttachmentPayload,
  resolveAttachmentUrl,
  validateAttachmentPayload,
} from './attachmentPayload';
import {
  buildMockRemoteAttachmentPayload,
  prepareAttachmentForSend,
} from './attachmentUploadAdapter';
import {
  buildMockAttachmentEncryptionMetadata,
  createMockEncryptedAttachmentEnvelope,
  decodeMockWrappedMediaKey,
  decodeMockAttachmentEnvelopeDataUrl,
  decryptMockAttachmentEnvelopeBlob,
  unwrapMockWrappedMediaKey,
  validateMockWrappedMediaKeyContract,
  verifyMockAttachmentEnvelope,
} from './attachmentCrypto';
import {
  getAttachmentAccessVerificationPresentation,
  getAttachmentContractPresentation,
  getAttachmentPreviewText,
} from './attachmentPresentation';
import {
  assertAttachmentMetadataIntegrity,
  buildAttachmentAccessVerification,
  buildResolvedAttachmentAccessContract,
  buildAttachmentMetadataUrl,
  clearAttachmentMetadataCache,
  decryptAttachmentBlob,
  fetchAttachmentBlob,
  getCachedAttachmentMetadata,
  getAttachmentContractFromHeaders,
  fetchAttachmentMetadata,
  getAttachmentAccessInfo,
  mapAttachmentContractError,
  openAttachmentInNewTab,
  prepareAttachmentBinaryAccess,
  resolveAttachmentUnwrapContext,
  resolveAttachmentContractFields,
  resolveExpectedAttachmentSha256,
  resolveAttachmentForAccess,
  triggerAttachmentDownload,
} from './attachmentAccessAdapter';
import { BACKEND_URL } from '../../services/socket';

describe('e2ee message model helpers', () => {
  test('normalizeIncomingMessage maps senderUserId to senderId and marks ownership', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderUserId: 'user-1',
        ciphertext: 'abc',
        protocol: 'signal_v1',
      },
      'user-1'
    );

    expect(normalized.senderId).toBe('user-1');
    expect(normalized.isOwn).toBe(true);
    expect(normalized.ciphertextAvailable).toBe(true);
  });

  test('buildPendingMessage creates a sending signal_v1 message', () => {
    const pending = buildPendingMessage({
      text: 'Hallo',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    expect(pending.text).toBe('Hallo');
    expect(pending.protocol).toBe('signal_v1');
    expect(pending.deliveryState).toBe('sending');
    expect(pending.pending).toBe(true);
    expect(pending.failed).toBe(false);
  });

  test('buildPendingMessage normalizes structured attachment payloads', () => {
    const pending = buildPendingMessage({
      text: 'Bijlage: foto.png',
      conversationId: 'conv-1',
      userId: 'user-1',
      type: 'attachment',
      attachment: {
        name: 'foto.png',
        downloadUrl: 'http://localhost:3001/attachments/pending-1',
        transfer: 'remote',
        mimeType: 'application/pulse-e2ee-envelope+json',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
        accessVerification: {
          integrityVerified: true,
          wrappedKeyVerified: false,
          unwrapKind: 'attachment_encryption_contract',
        },
      },
    });

    expect(pending.attachment).toEqual({
      name: 'foto.png',
      url: '',
      downloadUrl: 'http://localhost:3001/attachments/pending-1',
      thumbnailUrl: '',
      storageKey: '',
      transfer: 'remote',
      mimeType: 'application/pulse-e2ee-envelope+json',
      originalMimeType: 'image/png',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: '',
      expectedPayloadSha256: '',
      size: null,
      caption: '',
      encryption: null,
      accessVerification: {
        integrityVerified: true,
        wrappedKeyVerified: false,
        unwrapKind: 'attachment_encryption_contract',
      },
    });
  });

  test('patchPendingMessageAsSent marks a pending message as sent', () => {
    const pending = buildPendingMessage({
      text: 'Hallo',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    const sent = patchPendingMessageAsSent(pending, 'msg-2');

    expect(sent.id).toBe('msg-2');
    expect(sent.deliveryState).toBe('sent');
    expect(sent.pending).toBe(false);
    expect(sent.ciphertextAvailable).toBe(true);
  });

  test('patchPendingMessageAsFailed marks a pending message as failed', () => {
    const pending = buildPendingMessage({
      text: 'Hallo',
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    const failed = patchPendingMessageAsFailed(pending);

    expect(failed.deliveryState).toBe('failed');
    expect(failed.pending).toBe(false);
    expect(failed.failed).toBe(true);
  });

  test('getConversationPreview falls back to encrypted placeholder', () => {
    expect(getConversationPreview({ ciphertextAvailable: true, decryptedLocally: false })).toBe('Versleuteld bericht');
  });

  test('getConversationPreview includes encrypted storage signal for attachment messages', () => {
    expect(getConversationPreview({
      type: 'attachment',
      attachment: {
        name: 'foto.png',
        transfer: 'remote',
        contentEncoding: 'mock-e2ee-envelope-v1',
      },
    })).toBe('Bijlage: foto.png · versleuteld');
  });

  test('getConversationPreview prefers attachment summary fields over stale lastMessage text', () => {
    expect(getConversationPreview({
      lastMessage: 'Bijlage gedeeld',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentOriginalMimeType: 'image/png',
    })).toBe('Bijlage: Bestand · versleuteld');

    expect(getConversationPreview({
      lastMessage: 'Bijlage: rapport.pdf',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: '',
      lastAttachmentOriginalMimeType: 'application/pdf',
    })).toBe('Bijlage: rapport.pdf · opslaglink');
  });

  test('contact messages keep their shared-contact preview', () => {
    expect(getConversationPreview({
      type: 'contact',
      sharedContact: { name: 'Habiba' },
    })).toBe('Contactpersoon: Habiba');
  });

  test('getMessageDisplayText falls back to encrypted placeholder when text is unavailable', () => {
    expect(getMessageDisplayText({ ciphertextAvailable: true, decryptedLocally: false })).toBe('Versleuteld bericht');
  });

  test('getMessageDisplayText keeps attachment text compact without storage suffix', () => {
    expect(getMessageDisplayText({
      type: 'attachment',
      attachment: {
        name: 'foto.png',
        transfer: 'remote',
        contentEncoding: 'mock-e2ee-envelope-v1',
      },
    })).toBe('Bijlage: foto.png');
  });

  test('buildConversationSummaryUpdate derives attachment summary fields from structured messages', () => {
    expect(buildConversationSummaryUpdate({
      type: 'attachment',
      text: 'rapport.pdf',
      attachment: {
        name: 'rapport.pdf',
        transfer: 'remote',
        originalMimeType: 'application/pdf',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        expectedPayloadSha256: 'hash-1',
        encryption: {
          mediaKeyId: 'media-key-1',
          keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
          wrappedMediaKeyDigest: 'wrapped-digest-1',
        },
      },
    })).toEqual({
      lastMessage: 'Bijlage: rapport.pdf · versleuteld',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentEnvelopeKind: 'pulse_mock_media_envelope',
      lastAttachmentOriginalMimeType: 'application/pdf',
      lastAttachmentExpectedPayloadSha256: 'hash-1',
      lastAttachmentMediaKeyId: 'media-key-1',
      lastAttachmentKeyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      lastAttachmentWrappedMediaKeyDigest: 'wrapped-digest-1',
    });
  });

  test('normalizeIncomingMessage preserves structured contact metadata', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-contact-1',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        type: 'contact',
        messageType: 'contact',
        text: 'Contactpersoon: Habiba',
        sharedContact: { uid: 'user-3', name: 'Habiba', email: 'habiba@example.com' },
      },
      'user-1'
    );

    expect(normalized.type).toBe('contact');
    expect(normalized.messageType).toBe('contact');
    expect(normalized.sharedContact?.name).toBe('Habiba');
  });

  test('normalizeIncomingMessage preserves structured attachment metadata', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-attachment-1',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        type: 'attachment',
        messageType: 'attachment',
        text: 'document.pdf',
        attachment: {
          name: 'document.pdf',
          url: 'https://example.com/document.pdf',
          mimeType: 'application/pdf',
          accessVerification: {
            integrityVerified: true,
            wrappedKeyVerified: false,
            unwrapKind: 'attachment_encryption_contract',
          },
        },
      },
      'user-1'
    );

    expect(normalized.type).toBe('attachment');
    expect(normalized.attachment?.name).toBe('document.pdf');
    expect(normalized.attachment?.accessVerification).toEqual({
      integrityVerified: true,
      wrappedKeyVerified: false,
      unwrapKind: 'attachment_encryption_contract',
    });
  });

  test('normalizeIncomingMessage preserves reaction objects', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        reactions: { '❤️': ['user-1', 'user-2'] },
      },
      'user-1'
    );

    expect(normalized.reactions['❤️']).toEqual(['user-1', 'user-2']);
  });

  test('normalizeIncomingMessage preserves mentions', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-3',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        mentions: ['user-1', 'user-4'],
      },
      'user-1'
    );

    expect(normalized.mentions).toEqual(['user-1', 'user-4']);
  });
});

describe('e2ee policy helpers', () => {
  test('signal_v1 is treated as encrypted protocol', () => {
    expect(isEncryptedProtocol('signal_v1')).toBe(true);
    expect(isEncryptedProtocol('legacy_plaintext')).toBe(false);
  });

  test('encrypted messages cannot be edited or plaintext-updated', () => {
    const message = { protocol: 'signal_v1' };

    expect(canEditMessage(message)).toBe(false);
    expect(canApplyPlaintextEditUpdate(message)).toBe(false);
  });

  test('legacy messages can still be edited', () => {
    const message = { protocol: 'legacy_plaintext' };

    expect(canEditMessage(message)).toBe(true);
    expect(canApplyPlaintextEditUpdate(message)).toBe(true);
  });

  test('edit unavailable message stays stable', () => {
    expect(ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE).toBe('Bewerken voor versleutelde berichten is nog niet beschikbaar.');
  });
});

describe('e2ee attachment helpers', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    clearAttachmentMetadataCache();
    jest.restoreAllMocks();
  });

  test('normalizeAttachmentPayload sanitizes missing fields', () => {
    expect(normalizeAttachmentPayload({ url: 'data:text/plain;base64,SGVsbG8=' })).toEqual({
      name: 'Bestand',
      url: 'data:text/plain;base64,SGVsbG8=',
      downloadUrl: '',
      thumbnailUrl: '',
      storageKey: '',
      transfer: 'inline',
      mimeType: '',
      originalMimeType: '',
      contentEncoding: '',
      envelopeKind: '',
      expectedPayloadSha256: '',
      size: null,
      caption: '',
      encryption: null,
      accessVerification: null,
    });
  });

  test('normalizeAttachmentPayload keeps remote metadata for future encrypted storage', () => {
    expect(normalizeAttachmentPayload({
      name: 'foto.jpg',
      downloadUrl: 'https://cdn.example.com/foto.jpg',
      thumbnailUrl: 'https://cdn.example.com/foto-thumb.jpg',
      storageKey: 'attachments/conv-1/foto.jpg',
      mimeType: 'image/jpeg',
      originalMimeType: 'image/jpeg',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      transfer: 'remote',
      encryption: {
        alg: 'aes-gcm',
        keyId: 'key-1',
        iv: 'iv-1',
        sha256: 'hash-1',
        mediaKeyId: '',
        keyWrapAlg: '',
        wrappedMediaKey: '',
        wrappedMediaKeyDigest: '',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: 'image/jpeg',
      },
    })).toEqual({
      name: 'foto.jpg',
      url: '',
      downloadUrl: 'https://cdn.example.com/foto.jpg',
      thumbnailUrl: 'https://cdn.example.com/foto-thumb.jpg',
      storageKey: 'attachments/conv-1/foto.jpg',
      transfer: 'remote',
      mimeType: 'image/jpeg',
      originalMimeType: 'image/jpeg',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: '',
      size: null,
      caption: '',
      encryption: {
        alg: 'aes-gcm',
        keyId: 'key-1',
        iv: 'iv-1',
        sha256: 'hash-1',
        mediaKeyId: '',
        keyWrapAlg: '',
        wrappedMediaKey: '',
        wrappedMediaKeyDigest: '',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: 'image/jpeg',
      },
      accessVerification: null,
    });
  });

  test('normalizeAttachmentPayload keeps attachment contract fields from backend metadata', () => {
    expect(normalizeAttachmentPayload({
      name: 'smoke-note.txt',
      downloadUrl: 'http://localhost:3001/attachments/mock-2',
      transfer: 'remote',
      mimeType: 'application/pulse-e2ee-envelope+json',
      originalMimeType: 'text/plain',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: 'abcd1234',
      encryption: {
        alg: 'mock-e2ee-envelope-v1',
        mediaKeyId: '',
        keyWrapAlg: '',
        wrappedMediaKey: '',
        wrappedMediaKeyDigest: '',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: 'text/plain',
      },
    })).toEqual({
      name: 'smoke-note.txt',
      url: '',
      downloadUrl: 'http://localhost:3001/attachments/mock-2',
      thumbnailUrl: '',
      storageKey: '',
      transfer: 'remote',
      mimeType: 'application/pulse-e2ee-envelope+json',
      originalMimeType: 'text/plain',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: 'abcd1234',
      size: null,
      caption: '',
      encryption: {
        alg: 'mock-e2ee-envelope-v1',
        keyId: '',
        iv: '',
        sha256: '',
        mediaKeyId: '',
        keyWrapAlg: '',
        wrappedMediaKey: '',
        wrappedMediaKeyDigest: '',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: 'text/plain',
      },
      accessVerification: null,
    });
  });

  test('validateAttachmentPayload rejects oversized payloads', () => {
    const attachment = normalizeAttachmentPayload({
      name: 'grote-bijlage.pdf',
      url: 'https://example.com/large.pdf',
      size: MAX_E2EE_ATTACHMENT_BYTES + 1,
    });

    expect(validateAttachmentPayload(attachment)).toBe('Bijlagen mogen lokaal maximaal 2 MB zijn in deze testfase.');
  });

  test('isImageAttachment recognizes mime type and data urls', () => {
    expect(isImageAttachment({ mimeType: 'image/png', url: 'https://example.com/image.png' })).toBe(true);
    expect(isImageAttachment({ mimeType: 'application/pdf', url: 'data:image/png;base64,abc' })).toBe(true);
    expect(isImageAttachment({
      mimeType: 'application/pulse-e2ee-envelope+json',
      originalMimeType: 'image/png',
      downloadUrl: 'https://example.com/secure-image',
    })).toBe(true);
    expect(isImageAttachment({ mimeType: 'application/pdf', url: 'https://example.com/file.pdf' })).toBe(false);
  });

  test('resolveAttachmentUrl prefers remote download urls', () => {
    expect(resolveAttachmentUrl({
      url: 'data:image/png;base64,abc',
      downloadUrl: 'https://cdn.example.com/image.png',
    })).toBe('https://cdn.example.com/image.png');
  });

  test('buildMockRemoteAttachmentPayload creates future-proof remote metadata', async () => {
    const attachment = await buildMockRemoteAttachmentPayload({
      name: 'foto.png',
      url: 'data:image/png;base64,abc',
      mimeType: 'image/png',
      size: 1234,
    }, {
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    expect(attachment.transfer).toBe('remote');
    expect(attachment.downloadUrl).toContain('data:application/pulse-e2ee-envelope+json;base64,');
    expect(attachment.thumbnailUrl).toBe('data:image/png;base64,abc');
    expect(attachment.storageKey).toContain('mock-e2ee/conv-1/user-1/');
    expect(attachment.encryption?.alg).toBe('mock-e2ee-envelope-v1');
    expect(attachment.encryption?.sha256).toMatch(/^[a-f0-9]{64}$|^fallback-[a-f0-9]{8}$/);
    expect(attachment.encryption?.mediaKeyId).toMatch(/^mock-media-key-/);
    expect(attachment.encryption?.keyWrapAlg).toBe('pulse_mock_media_key_wrap_v1');
    expect(attachment.encryption?.wrappedMediaKey).toMatch(/^ey/);
    expect(attachment.encryption?.wrappedMediaKeyDigest).toMatch(/^[a-f0-9]{64}$|^fallback-[a-f0-9]{8}$/);
  });

  test('buildMockAttachmentEncryptionMetadata creates a stable mock media key contract', async () => {
    const { envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });

    await expect(buildMockAttachmentEncryptionMetadata({
      mimeType: 'text/plain',
    }, envelope)).resolves.toEqual({
      alg: 'mock-e2ee-envelope-v1',
      keyId: expect.stringMatching(/^mock-key-/),
      iv: expect.stringMatching(/^mock-iv-/),
      sha256: envelope.payloadSha256,
      mediaKeyId: expect.stringMatching(/^mock-media-key-/),
      keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      wrappedMediaKey: expect.stringMatching(/^ey/),
      wrappedMediaKeyDigest: expect.stringMatching(/^[a-f0-9]{64}$|^fallback-[a-f0-9]{8}$/),
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'text/plain',
    });
  });

  test('decodeMockWrappedMediaKey reads wrapped media key payloads', async () => {
    const { envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });
    const encryption = await buildMockAttachmentEncryptionMetadata({ mimeType: 'text/plain' }, envelope);

    expect(decodeMockWrappedMediaKey(encryption.wrappedMediaKey)).toEqual({
      version: 1,
      kind: 'pulse_mock_wrapped_media_key',
      seed: envelope.payloadSha256,
      mediaKeyId: encryption.mediaKeyId,
      keyWrapAlg: encryption.keyWrapAlg,
    });
    expect(encryption.wrappedMediaKeyDigest).toMatch(/^[a-f0-9]{64}$|^fallback-[a-f0-9]{8}$/);
  });

  test('validateMockWrappedMediaKeyContract rejects mismatched wrapped media keys', async () => {
    const { envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });
    const encryption = await buildMockAttachmentEncryptionMetadata({ mimeType: 'text/plain' }, envelope);

    await expect(validateMockWrappedMediaKeyContract({
      ...encryption,
      mediaKeyId: 'other-media-key',
    })).rejects.toThrow('Wrapped media key komt niet overeen met mediaKeyId.');
  });

  test('unwrapMockWrappedMediaKey returns a reusable unwrap context', async () => {
    const { envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });
    const encryption = await buildMockAttachmentEncryptionMetadata({ mimeType: 'text/plain' }, envelope);

    await expect(unwrapMockWrappedMediaKey(encryption)).resolves.toEqual({
      mediaKeyId: encryption.mediaKeyId,
      keyWrapAlg: encryption.keyWrapAlg,
      payloadSha256: encryption.sha256,
      wrappedMediaKey: encryption.wrappedMediaKey,
      wrappedMediaKeyDigest: encryption.wrappedMediaKeyDigest,
      unwrapKind: 'pulse_mock_media_key_unwrap',
    });
  });

  test('getAttachmentContractPresentation derives consistent labels for encrypted remote attachments', () => {
    expect(getAttachmentContractPresentation({
      transfer: 'remote',
      contentEncoding: 'mock-e2ee-envelope-v1',
      originalMimeType: 'image/png',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: 'deadbeef',
      encryption: {
        mediaKeyId: 'mock-media-key-1',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      },
    })).toEqual({
      isRemote: true,
      isEncryptedRemote: true,
      hasIntegrityContract: true,
      hasWrappedMediaKeyContract: true,
      mimeLabel: 'image/png',
      storageLabel: 'Mock versleutelde opslaglink',
      storageShortLabel: 'versleuteld',
      storageDetail: 'Envelope: pulse_mock_media_envelope · integriteitscheck actief',
      keyContractDetail: 'Media key: mock-media-key-1 · wrap: pulse_mock_media_key_wrap_v1',
    });
  });

  test('getAttachmentContractPresentation derives consistent labels for plain remote attachments', () => {
    expect(getAttachmentContractPresentation({
      transfer: 'remote',
      mimeType: 'application/pdf',
    })).toEqual({
      isRemote: true,
      isEncryptedRemote: false,
      hasIntegrityContract: false,
      hasWrappedMediaKeyContract: false,
      mimeLabel: 'application/pdf',
      storageLabel: 'Beveiligde opslaglink',
      storageShortLabel: 'opslaglink',
      storageDetail: '',
      keyContractDetail: '',
    });
  });

  test('getAttachmentAccessVerificationPresentation derives labels for verified remote access', () => {
    expect(getAttachmentAccessVerificationPresentation({
      integrityVerified: true,
      wrappedKeyVerified: true,
    }, {
      unwrapKind: 'pulse_mock_media_key_unwrap',
    })).toEqual({
      integrityAccessLabel: 'Downloadcontract bevestigd',
      wrappedKeyAccessLabel: 'Wrapped media key gevalideerd · pulse_mock_media_key_unwrap',
    });
  });

  test('getAttachmentAccessVerificationPresentation reuses persisted attachment verification state', () => {
    expect(getAttachmentAccessVerificationPresentation({
      accessVerification: {
        integrityVerified: true,
        wrappedKeyVerified: true,
        unwrapKind: 'pulse_mock_media_key_unwrap',
      },
    })).toEqual({
      integrityAccessLabel: 'Downloadcontract bevestigd',
      wrappedKeyAccessLabel: 'Wrapped media key gevalideerd · pulse_mock_media_key_unwrap',
    });
  });

  test('getAttachmentPreviewText derives list-friendly attachment labels', () => {
    expect(getAttachmentPreviewText({
      name: 'foto.png',
      transfer: 'remote',
      contentEncoding: 'mock-e2ee-envelope-v1',
    })).toBe('Bijlage: foto.png · versleuteld');

    expect(getAttachmentPreviewText({
      name: 'document.pdf',
      transfer: 'remote',
    }, {
      includeStorageSignal: false,
    })).toBe('Bijlage: document.pdf');
  });

  test('getConversationAttachmentSummaryPresentation derives preview and badge state', () => {
    expect(getConversationAttachmentSummaryPresentation({
      lastMessage: 'Bijlage: rapport.pdf',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentEnvelopeKind: 'pulse_mock_media_envelope',
      lastAttachmentOriginalMimeType: 'application/pdf',
      lastAttachmentExpectedPayloadSha256: 'hash-1',
      lastAttachmentWrappedMediaKeyDigest: 'wrapped-digest-1',
      lastAttachmentMediaKeyId: 'media-key-1',
      lastAttachmentKeyWrapAlg: 'pulse_mock_media_key_wrap_v1',
    })).toEqual({
      isAttachmentSummary: true,
      showRemoteAttachmentBadge: true,
      previewText: 'Bijlage: rapport.pdf · versleuteld',
      storageShortLabel: 'versleuteld',
      mimeLabel: 'application/pdf',
      storageDetail: 'Envelope: pulse_mock_media_envelope · integriteitscheck actief',
      keyContractDetail: 'Media key: media-key-1 · wrap: pulse_mock_media_key_wrap_v1 · digest actief',
    });
  });

  test('normalizeConversationAttachmentSummary fills attachment summary defaults', () => {
    expect(normalizeConversationAttachmentSummary({
      id: 'conv-1',
      lastMessage: 'Hallo',
    })).toEqual({
      id: 'conv-1',
      lastMessage: 'Hallo',
      lastMessageType: null,
      lastAttachmentTransfer: null,
      lastAttachmentEncoding: null,
      lastAttachmentEnvelopeKind: null,
      lastAttachmentOriginalMimeType: null,
      lastAttachmentExpectedPayloadSha256: null,
      lastAttachmentMediaKeyId: null,
      lastAttachmentKeyWrapAlg: null,
      lastAttachmentWrappedMediaKeyDigest: null,
    });
  });

  test('applyConversationSummaryToList updates and sorts the targeted conversation', () => {
    expect(applyConversationSummaryToList([
      { id: 'conv-1', updatedAt: '2026-01-01T10:00:00.000Z', lastMessage: 'Oud' },
      { id: 'conv-2', updatedAt: '2026-01-01T09:00:00.000Z', lastMessage: 'Ander' },
    ], 'conv-2', {
      type: 'attachment',
      attachment: {
        name: 'rapport.pdf',
        transfer: 'remote',
        contentEncoding: 'mock-e2ee-envelope-v1',
        originalMimeType: 'application/pdf',
        expectedPayloadSha256: 'hash-1',
      },
      createdAt: '2026-01-01T11:00:00.000Z',
    })).toEqual([
      {
        id: 'conv-2',
        updatedAt: '2026-01-01T11:00:00.000Z',
        lastMessage: 'Bijlage: rapport.pdf · versleuteld',
        lastMessageType: 'attachment',
        lastAttachmentTransfer: 'remote',
        lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
        lastAttachmentEnvelopeKind: null,
        lastAttachmentOriginalMimeType: 'application/pdf',
        lastAttachmentExpectedPayloadSha256: 'hash-1',
        lastAttachmentMediaKeyId: null,
        lastAttachmentKeyWrapAlg: null,
        lastAttachmentWrappedMediaKeyDigest: null,
        lastCallDirection: null,
        lastCallSenderId: null,
        lastCallIsVideo: null,
      },
      {
        id: 'conv-1',
        updatedAt: '2026-01-01T10:00:00.000Z',
        lastMessage: 'Oud',
      },
    ]);
  });

  test('createMockEncryptedAttachmentEnvelope wraps a data url in a mock envelope', async () => {
    const encrypted = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });

    expect(encrypted.dataUrl).toContain('data:application/pulse-e2ee-envelope+json;base64,');
    const decoded = decodeMockAttachmentEnvelopeDataUrl(encrypted.dataUrl);
    expect(decoded.kind).toBe('pulse_mock_media_envelope');
    expect(decoded.mimeType).toBe('text/plain');
    expect(decoded.payloadBase64).toBe('SGVsbG8=');
    expect(decoded.payloadSha256).toMatch(/^[a-f0-9]{64}$|^fallback-[a-f0-9]{8}$/);
  });

  test('prepareAttachmentForSend supports remote_mock mode', async () => {
    const attachment = await prepareAttachmentForSend({
      attachment: {
        name: 'document.pdf',
        url: 'data:application/pdf;base64,abc',
        mimeType: 'application/pdf',
        size: 456,
      },
      conversationId: 'conv-2',
      userId: 'user-9',
      transportMode: 'remote_mock',
      uploadAttachment: async (payload) => ({
        ...payload,
        downloadUrl: 'https://cdn.example.com/document.pdf',
        storageKey: 'mock-e2ee/conv-2/user-9/document.pdf',
      }),
    });

    expect(attachment.transfer).toBe('remote');
    expect(attachment.downloadUrl).toBe('https://cdn.example.com/document.pdf');
    expect(attachment.storageKey).toBe('mock-e2ee/conv-2/user-9/document.pdf');
  });

  test('prepareAttachmentForSend uploads through backend when no custom uploader is provided', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-123');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attachment: {
          name: 'foto.png',
          downloadUrl: 'http://localhost:3001/attachments/mock-1',
          thumbnailUrl: 'http://localhost:3001/attachments/mock-1',
          storageKey: 'mock-storage/mock-1/foto.png',
          transfer: 'remote',
          mimeType: 'image/png',
          size: 321,
          caption: 'Test',
          encryption: {
            alg: 'mock-storage-envelope',
            keyId: 'mock-key-mock-1',
            iv: 'mock-iv-mock-1',
            sha256: 'mock-sha256-321',
          },
        },
      }),
    });

    const attachment = await prepareAttachmentForSend({
      attachment: {
        name: 'foto.png',
        url: 'data:image/png;base64,abc',
        mimeType: 'image/png',
        size: 321,
        caption: 'Test',
      },
      conversationId: 'conv-5',
      userId: 'user-5',
      user: { getIdToken },
      transportMode: 'remote_mock',
    });

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/api/attachments/upload');
    expect(attachment.transfer).toBe('remote');
    expect(attachment.downloadUrl).toBe('http://localhost:3001/attachments/mock-1');
  });

  test('getAttachmentAccessInfo exposes future decrypt-related access hints', () => {
    const info = getAttachmentAccessInfo({
      transfer: 'remote',
      downloadUrl: 'https://cdn.example.com/foto.png',
      mimeType: 'image/png',
      encryption: {
        alg: 'mock-storage-envelope',
        keyId: 'key-1',
      },
    });

    expect(info.url).toBe('https://cdn.example.com/foto.png');
    expect(info.canOpen).toBe(true);
    expect(info.canDownload).toBe(true);
    expect(info.isImage).toBe(true);
    expect(info.needsRemoteFetch).toBe(true);
  });

  test('buildAttachmentMetadataUrl points to the protected metadata endpoint', () => {
    expect(buildAttachmentMetadataUrl({
      downloadUrl: 'http://localhost:3001/attachments/mock-77',
    })).toBe(`${BACKEND_URL}/api/attachments/mock-77/meta`);
  });

  test('fetchAttachmentMetadata merges protected metadata into the existing attachment', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-abc');
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': '',
          'X-Pulse-Content-Encoding': '',
          'X-Pulse-Envelope-Kind': '',
          'X-Pulse-Original-MimeType': '',
        }[name] || '')),
      },
      json: async () => ({
        attachment: {
          name: 'rapport.pdf',
          downloadUrl: 'http://localhost:3001/attachments/mock-99',
          storageKey: 'mock-storage/mock-99/rapport.pdf',
          transfer: 'remote',
          mimeType: 'application/pdf',
          size: 2048,
          encryption: {
            alg: 'mock-storage-envelope',
            keyId: 'mock-key-99',
            iv: 'mock-iv-99',
            sha256: 'mock-sha256-2048',
          },
        },
      }),
    });

    const attachment = await fetchAttachmentMetadata(
      {
        downloadUrl: 'http://localhost:3001/attachments/mock-99',
        transfer: 'remote',
        encryption: { alg: 'mock-storage-envelope', keyId: 'stale-key' },
      },
      { getIdToken },
      fetchImpl
    );

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BACKEND_URL}/api/attachments/mock-99/meta`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-abc',
        }),
      })
    );
    expect(attachment.name).toBe('rapport.pdf');
    expect(attachment.storageKey).toBe('mock-storage/mock-99/rapport.pdf');
    expect(attachment.encryption?.keyId).toBe('mock-key-99');
    expect(getCachedAttachmentMetadata({
      downloadUrl: 'http://localhost:3001/attachments/mock-99',
    })?.storageKey).toBe('mock-storage/mock-99/rapport.pdf');
  });

  test('fetchAttachmentMetadata rejects mismatched attachment hash metadata', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-abc');
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': 'server-sha-1',
          'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
          'X-Pulse-Envelope-Kind': '',
          'X-Pulse-Original-MimeType': '',
        }[name] || '')),
      },
      json: async () => ({
        attachment: {
          name: 'rapport.pdf',
          downloadUrl: 'http://localhost:3001/attachments/mock-99',
          transfer: 'remote',
          mimeType: 'application/pulse-e2ee-envelope+json',
          contentEncoding: 'mock-e2ee-envelope-v1',
          expectedPayloadSha256: 'server-sha-1',
          encryption: {
            alg: 'mock-e2ee-envelope-v1',
            sha256: 'server-sha-1',
          },
        },
      }),
    });

    await expect(fetchAttachmentMetadata(
      {
        downloadUrl: 'http://localhost:3001/attachments/mock-99',
        transfer: 'remote',
        expectedPayloadSha256: 'client-sha-2',
        encryption: { alg: 'mock-e2ee-envelope-v1', sha256: 'client-sha-2' },
      },
      { getIdToken },
      fetchImpl
    )).rejects.toThrow('Attachment metadata-integriteit komt niet overeen');
  });

  test('fetchAttachmentMetadata rejects mismatched attachment envelope metadata', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-abc');
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': 'same-sha',
          'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
          'X-Pulse-Envelope-Kind': 'server-envelope',
          'X-Pulse-Original-MimeType': 'image/png',
        }[name] || '')),
      },
      json: async () => ({
        attachment: {
          name: 'rapport.pdf',
          downloadUrl: 'http://localhost:3001/attachments/mock-99',
          transfer: 'remote',
          mimeType: 'application/pulse-e2ee-envelope+json',
          contentEncoding: 'mock-e2ee-envelope-v1',
          envelopeKind: 'server-envelope',
          originalMimeType: 'image/png',
          expectedPayloadSha256: 'same-sha',
          encryption: {
            alg: 'mock-e2ee-envelope-v1',
            sha256: 'same-sha',
            envelopeKind: 'server-envelope',
            originalMimeType: 'image/png',
          },
        },
      }),
    });

    await expect(fetchAttachmentMetadata(
      {
        downloadUrl: 'http://localhost:3001/attachments/mock-99',
        transfer: 'remote',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'client-envelope',
        originalMimeType: 'image/png',
        expectedPayloadSha256: 'same-sha',
        encryption: {
          alg: 'mock-e2ee-envelope-v1',
          sha256: 'same-sha',
          envelopeKind: 'client-envelope',
          originalMimeType: 'image/png',
        },
      },
      { getIdToken },
      fetchImpl
    )).rejects.toThrow('Attachment metadata envelope-kind komt niet overeen');
  });

  test('fetchAttachmentMetadata rejects mismatched metadata headers', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-abc');
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': 'same-sha',
          'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
          'X-Pulse-Envelope-Kind': 'header-envelope',
          'X-Pulse-Original-MimeType': 'image/png',
        }[name] || '')),
      },
      json: async () => ({
        attachment: {
          name: 'rapport.pdf',
          downloadUrl: 'http://localhost:3001/attachments/mock-99',
          transfer: 'remote',
          mimeType: 'application/pulse-e2ee-envelope+json',
          contentEncoding: 'mock-e2ee-envelope-v1',
          envelopeKind: 'body-envelope',
          originalMimeType: 'image/png',
          expectedPayloadSha256: 'same-sha',
          encryption: {
            alg: 'mock-e2ee-envelope-v1',
            sha256: 'same-sha',
            envelopeKind: 'body-envelope',
            originalMimeType: 'image/png',
          },
        },
      }),
    });

    await expect(fetchAttachmentMetadata(
      {
        downloadUrl: 'http://localhost:3001/attachments/mock-99',
        transfer: 'remote',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'body-envelope',
        originalMimeType: 'image/png',
        expectedPayloadSha256: 'same-sha',
        encryption: {
          alg: 'mock-e2ee-envelope-v1',
          sha256: 'same-sha',
          envelopeKind: 'body-envelope',
          originalMimeType: 'image/png',
        },
      },
      { getIdToken },
      fetchImpl
    )).rejects.toThrow('Attachment metadata envelope-kind komt niet overeen');
  });

  test('fetchAttachmentMetadata reuses cache for the same attachment id', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-abc');
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attachment: {
          name: 'foto.png',
          downloadUrl: `${BACKEND_URL}/attachments/mock-cached`,
          transfer: 'remote',
          mimeType: 'image/png',
          encryption: {
            alg: 'mock-storage-envelope',
            keyId: 'mock-key-cached',
            iv: 'mock-iv-cached',
            sha256: 'mock-sha256-cached',
          },
        },
      }),
    });

    const baseAttachment = {
      downloadUrl: `${BACKEND_URL}/attachments/mock-cached`,
      transfer: 'remote',
      encryption: { alg: 'mock-storage-envelope', keyId: 'stale-key' },
    };

    await fetchAttachmentMetadata(baseAttachment, { getIdToken }, fetchImpl);
    const cached = await fetchAttachmentMetadata(baseAttachment, { getIdToken }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cached.encryption?.keyId).toBe('mock-key-cached');
  });

  test('resolveAttachmentForAccess returns the original normalized attachment when no remote metadata refresh is needed', async () => {
    const attachment = await resolveAttachmentForAccess({
      name: 'inline.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      transfer: 'inline',
    });

    expect(attachment.name).toBe('inline.txt');
    expect(attachment.transfer).toBe('inline');
  });

  test('assertAttachmentMetadataIntegrity accepts matching metadata contracts', () => {
    expect(() => assertAttachmentMetadataIntegrity(
      {
        expectedPayloadSha256: 'same-sha',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: 'image/png',
        encryption: {
          mediaKeyId: 'key-1',
          keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
          wrappedMediaKey: 'wrapped-key',
          wrappedMediaKeyDigest: 'wrapped-digest',
        },
      },
      {
        expectedPayloadSha256: 'same-sha',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: 'image/png',
        encryption: {
          mediaKeyId: 'key-1',
          keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
          wrappedMediaKey: 'wrapped-key',
          wrappedMediaKeyDigest: 'wrapped-digest',
        },
      }
    )).not.toThrow();
  });

  test('resolveAttachmentContractFields normalizes attachment contract fields', () => {
    expect(resolveAttachmentContractFields({
      expectedPayloadSha256: 'sha-top',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'image/png',
      mediaKeyId: 'ignored-top-level',
      keyWrapAlg: 'ignored-top-level',
      wrappedMediaKey: 'ignored-top-level',
      encryption: {
        sha256: 'sha-nested',
        mediaKeyId: 'media-key-1',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
        wrappedMediaKey: 'wrapped-key-1',
        wrappedMediaKeyDigest: 'wrapped-digest-1',
        envelopeKind: 'ignored-envelope',
        originalMimeType: 'ignored/type',
      },
    })).toEqual({
      expectedPayloadSha256: 'sha-top',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'image/png',
      mediaKeyId: 'media-key-1',
      keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      wrappedMediaKey: 'wrapped-key-1',
      wrappedMediaKeyDigest: 'wrapped-digest-1',
    });
  });

  test('buildResolvedAttachmentAccessContract derives verification hints', () => {
    expect(buildResolvedAttachmentAccessContract({
      expectedPayloadSha256: 'hash-1',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'text/plain',
      encryption: {
        alg: 'mock-e2ee-envelope-v1',
        mediaKeyId: 'mock-media-key-1',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
        wrappedMediaKey: 'wrapped-key',
        wrappedMediaKeyDigest: 'wrapped-digest',
      },
    })).toEqual({
      expectedPayloadSha256: 'hash-1',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'text/plain',
      mediaKeyId: 'mock-media-key-1',
      keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      wrappedMediaKey: 'wrapped-key',
      wrappedMediaKeyDigest: 'wrapped-digest',
      integrityVerified: true,
      wrappedKeyVerified: true,
    });
  });

  test('buildAttachmentAccessVerification derives session-level access state', () => {
    expect(buildAttachmentAccessVerification({
      integrityVerified: true,
      wrappedKeyVerified: true,
    }, {
      unwrapKind: 'pulse_mock_media_key_unwrap',
    })).toEqual({
      integrityVerified: true,
      wrappedKeyVerified: true,
      unwrapKind: 'pulse_mock_media_key_unwrap',
    });
  });

  test('getAttachmentContractFromHeaders reads attachment contract headers', () => {
    expect(getAttachmentContractFromHeaders({
      get: jest.fn((name) => ({
        'X-Pulse-Expected-Sha256': 'sha-top',
        'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
        'X-Pulse-Envelope-Kind': 'pulse_mock_media_envelope',
        'X-Pulse-Original-MimeType': 'image/png',
        'X-Pulse-Media-Key-Id': 'media-key-1',
        'X-Pulse-Key-Wrap-Alg': 'pulse_mock_media_key_wrap_v1',
        'X-Pulse-Wrapped-Media-Key-Digest': 'wrapped-digest-1',
      }[name] || '')),
    })).toEqual({
      expectedPayloadSha256: 'sha-top',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'image/png',
      mediaKeyId: 'media-key-1',
      keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      wrappedMediaKey: '',
      wrappedMediaKeyDigest: 'wrapped-digest-1',
    });
  });

  test('mapAttachmentContractError remaps low-level contract errors', () => {
    expect(mapAttachmentContractError(new Error('Attachment envelope-kind komt niet overeen'), {
      envelopeKindMessage: 'Aangepaste envelope mismatch',
    }).message).toBe('Aangepaste envelope mismatch');
  });

  test('fetchAttachmentMetadata rejects mismatched wrapped media key metadata', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-abc');
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': 'same-sha',
          'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
          'X-Pulse-Envelope-Kind': 'pulse_mock_media_envelope',
          'X-Pulse-Original-MimeType': 'image/png',
        }[name] || '')),
      },
      json: async () => ({
        attachment: {
          name: 'rapport.pdf',
          downloadUrl: 'http://localhost:3001/attachments/mock-99',
          transfer: 'remote',
          mimeType: 'application/pulse-e2ee-envelope+json',
          contentEncoding: 'mock-e2ee-envelope-v1',
          envelopeKind: 'pulse_mock_media_envelope',
          originalMimeType: 'image/png',
          expectedPayloadSha256: 'same-sha',
          encryption: {
            alg: 'mock-e2ee-envelope-v1',
            sha256: 'same-sha',
            envelopeKind: 'pulse_mock_media_envelope',
            originalMimeType: 'image/png',
            mediaKeyId: 'server-media-key',
            keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
            wrappedMediaKey: 'server-wrapped-key',
          },
        },
      }),
    });

    await expect(fetchAttachmentMetadata(
      {
        downloadUrl: 'http://localhost:3001/attachments/mock-99',
        transfer: 'remote',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: 'image/png',
        expectedPayloadSha256: 'same-sha',
        encryption: {
          alg: 'mock-e2ee-envelope-v1',
          sha256: 'same-sha',
          envelopeKind: 'pulse_mock_media_envelope',
          originalMimeType: 'image/png',
          mediaKeyId: 'client-media-key',
          keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
          wrappedMediaKey: 'client-wrapped-key',
        },
      },
      { getIdToken },
      fetchImpl
    )).rejects.toThrow('Attachment metadata media-key-id komt niet overeen');
  });

  test('fetchAttachmentBlob downloads a blob from the resolved attachment url', async () => {
    const blob = new Blob(['hello remote attachment'], { type: 'text/plain' });
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': '',
          'X-Pulse-Content-Encoding': '',
          'X-Pulse-Envelope-Kind': '',
          'X-Pulse-Original-MimeType': '',
        }[name] || '')),
      },
      blob: async () => blob,
    });

    const result = await fetchAttachmentBlob({
      downloadUrl: 'https://cdn.example.com/blob.txt',
    }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith('https://cdn.example.com/blob.txt');
    expect(result).toBe(blob);
  });

  test('fetchAttachmentBlob rejects mismatched backend integrity headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': 'header-sha-1',
          'X-Pulse-Content-Encoding': '',
          'X-Pulse-Envelope-Kind': '',
          'X-Pulse-Original-MimeType': '',
        }[name] || '')),
      },
      blob: async () => new Blob(['hello remote attachment'], { type: 'text/plain' }),
    });

    await expect(fetchAttachmentBlob({
      downloadUrl: 'https://cdn.example.com/blob.txt',
      expectedPayloadSha256: 'local-sha-2',
    }, fetchImpl)).rejects.toThrow('Attachment-integriteitsmetadata komt niet overeen');
  });

  test('fetchAttachmentBlob rejects mismatched backend envelope headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': 'same-sha',
          'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
          'X-Pulse-Envelope-Kind': 'server-envelope',
          'X-Pulse-Original-MimeType': 'image/png',
          'X-Pulse-Media-Key-Id': 'same-media-key',
          'X-Pulse-Key-Wrap-Alg': 'pulse_mock_media_key_wrap_v1',
        }[name] || '')),
      },
      blob: async () => new Blob(['hello remote attachment'], { type: 'text/plain' }),
    });

    await expect(fetchAttachmentBlob({
      downloadUrl: 'https://cdn.example.com/blob.txt',
      expectedPayloadSha256: 'same-sha',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'client-envelope',
      originalMimeType: 'image/png',
      encryption: {
        mediaKeyId: 'same-media-key',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      },
    }, fetchImpl)).rejects.toThrow('Attachment envelope-kind header komt niet overeen');
  });

  test('fetchAttachmentBlob rejects mismatched backend media key headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': 'same-sha',
          'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
          'X-Pulse-Envelope-Kind': 'pulse_mock_media_envelope',
          'X-Pulse-Original-MimeType': 'image/png',
          'X-Pulse-Media-Key-Id': 'server-media-key',
          'X-Pulse-Key-Wrap-Alg': 'pulse_mock_media_key_wrap_v1',
        }[name] || '')),
      },
      blob: async () => new Blob(['hello remote attachment'], { type: 'text/plain' }),
    });

    await expect(fetchAttachmentBlob({
      downloadUrl: 'https://cdn.example.com/blob.txt',
      expectedPayloadSha256: 'same-sha',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'image/png',
      encryption: {
        mediaKeyId: 'client-media-key',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      },
    }, fetchImpl)).rejects.toThrow('Attachment media-key-id header komt niet overeen');
  });

  test('fetchAttachmentBlob rejects mismatched backend key wrap headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn((name) => ({
          'X-Pulse-Expected-Sha256': 'same-sha',
          'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
          'X-Pulse-Envelope-Kind': 'pulse_mock_media_envelope',
          'X-Pulse-Original-MimeType': 'image/png',
          'X-Pulse-Media-Key-Id': 'same-media-key',
          'X-Pulse-Key-Wrap-Alg': 'server-wrap-alg',
        }[name] || '')),
      },
      blob: async () => new Blob(['hello remote attachment'], { type: 'text/plain' }),
    });

    await expect(fetchAttachmentBlob({
      downloadUrl: 'https://cdn.example.com/blob.txt',
      expectedPayloadSha256: 'same-sha',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      originalMimeType: 'image/png',
      encryption: {
        mediaKeyId: 'same-media-key',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      },
    }, fetchImpl)).rejects.toThrow('Attachment key-wrap-algoritme header komt niet overeen');
  });

  test('decryptMockAttachmentEnvelopeBlob restores the original attachment blob', async () => {
    const { dataUrl, envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });
    const base64 = dataUrl.split(',')[1];
    const encryptedBlob = new Blob([atob(base64)], { type: 'application/pulse-e2ee-envelope+json' });

    const decryptedBlob = await decryptMockAttachmentEnvelopeBlob(encryptedBlob, envelope.payloadSha256);

    expect(decryptedBlob.type).toBe('text/plain');
    expect(await new Response(decryptedBlob).text()).toBe('Hello');
  });

  test('verifyMockAttachmentEnvelope rejects integrity mismatches', async () => {
    await expect(verifyMockAttachmentEnvelope({
      kind: 'pulse_mock_media_envelope',
      mimeType: 'text/plain',
      payloadBase64: 'SGVsbG8=',
      payloadSha256: 'deadbeef',
    })).rejects.toThrow('Mock media-envelope integriteit mislukt.');
  });

  test('decryptAttachmentBlob routes mock envelopes through the envelope decryptor', async () => {
    const expectedSha256 = (await verifyMockAttachmentEnvelope({
      kind: 'pulse_mock_media_envelope',
      mimeType: 'text/plain',
      payloadBase64: 'SGVsbG8=',
    })).payloadSha256;
    const encryptedBlob = new Blob([JSON.stringify({
      kind: 'pulse_mock_media_envelope',
      mimeType: 'text/plain',
      payloadBase64: 'SGVsbG8=',
      payloadSha256: expectedSha256,
    })], { type: 'application/pulse-e2ee-envelope+json' });

    const decryptedBlob = await decryptAttachmentBlob(encryptedBlob, {
      encryption: {
        ...(await buildMockAttachmentEncryptionMetadata({ mimeType: 'text/plain' }, {
          kind: 'pulse_mock_media_envelope',
          mimeType: 'text/plain',
          payloadSha256: expectedSha256,
        })),
      },
      expectedPayloadSha256: expectedSha256,
    });

    expect(await new Response(decryptedBlob).text()).toBe('Hello');
  });

  test('decryptAttachmentBlob rejects mismatched wrapped media key contracts', async () => {
    const expectedSha256 = (await verifyMockAttachmentEnvelope({
      kind: 'pulse_mock_media_envelope',
      mimeType: 'text/plain',
      payloadBase64: 'SGVsbG8=',
    })).payloadSha256;
    const encryptedBlob = new Blob([JSON.stringify({
      kind: 'pulse_mock_media_envelope',
      mimeType: 'text/plain',
      payloadBase64: 'SGVsbG8=',
      payloadSha256: expectedSha256,
    })], { type: 'application/pulse-e2ee-envelope+json' });

    await expect(decryptAttachmentBlob(encryptedBlob, {
      encryption: {
        ...(await buildMockAttachmentEncryptionMetadata({ mimeType: 'text/plain' }, {
          kind: 'pulse_mock_media_envelope',
          mimeType: 'text/plain',
          payloadSha256: expectedSha256,
        })),
        mediaKeyId: 'wrong-media-key',
      },
      expectedPayloadSha256: expectedSha256,
    })).rejects.toThrow('Wrapped media key komt niet overeen met mediaKeyId.');
  });

  test('resolveExpectedAttachmentSha256 prefers explicit attachment metadata', () => {
    expect(resolveExpectedAttachmentSha256({
      expectedPayloadSha256: 'top-level-sha',
      encryption: { sha256: 'nested-sha' },
    })).toBe('top-level-sha');

    expect(resolveExpectedAttachmentSha256({
      encryption: { sha256: 'nested-sha' },
    })).toBe('nested-sha');
  });

  test('prepareAttachmentBinaryAccess creates a temporary object url for remote encrypted attachments', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-xyz');
    const blob = new Blob(['secret payload'], { type: 'text/plain' });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          attachment: {
            name: 'secret.txt',
            downloadUrl: `${BACKEND_URL}/attachments/mock-binary`,
            transfer: 'remote',
            mimeType: 'text/plain',
            encryption: {
              alg: 'mock-storage-envelope',
              keyId: 'mock-key-binary',
              iv: 'mock-iv-binary',
              sha256: 'mock-sha256-binary',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => blob,
      });
    const decryptAttachmentBlob = jest.fn(async (inputBlob) => inputBlob);
    const createObjectUrl = jest.fn(() => 'blob:prepared-access');
    const revokeObjectUrl = jest.fn();

    const prepared = await prepareAttachmentBinaryAccess(
      {
        downloadUrl: `${BACKEND_URL}/attachments/mock-binary`,
        transfer: 'remote',
        encryption: { alg: 'mock-storage-envelope', keyId: 'stale-binary-key' },
      },
      { getIdToken },
      {
        fetchImpl,
        decryptAttachmentBlob,
        createObjectUrl,
        revokeObjectUrl,
      }
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `${BACKEND_URL}/api/attachments/mock-binary/meta`,
      expect.any(Object)
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(2, `${BACKEND_URL}/attachments/mock-binary`);
    expect(decryptAttachmentBlob).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(prepared.url).toBe('blob:prepared-access');
    expect(prepared.isObjectUrl).toBe(true);
    expect(prepared.attachment.accessVerification).toEqual({
      integrityVerified: true,
      wrappedKeyVerified: false,
      unwrapKind: 'attachment_encryption_contract',
    });
    expect(prepared.contract).toEqual({
      expectedPayloadSha256: 'mock-sha256-binary',
      contentEncoding: '',
      envelopeKind: '',
      originalMimeType: '',
      mediaKeyId: '',
      keyWrapAlg: '',
      wrappedMediaKey: '',
      wrappedMediaKeyDigest: '',
      integrityVerified: true,
      wrappedKeyVerified: false,
    });
    expect(prepared.unwrapContext).toEqual({
      mediaKeyId: '',
      keyWrapAlg: '',
      payloadSha256: 'mock-sha256-binary',
      wrappedMediaKey: '',
      wrappedMediaKeyDigest: '',
      unwrapKind: 'attachment_encryption_contract',
    });
    prepared.revoke();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:prepared-access');
  });

  test('resolveAttachmentUnwrapContext exposes wrapped media key contract for encrypted attachments', async () => {
    const { envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'secure.txt',
      url: 'data:text/plain;base64,U2VjdXJl',
      mimeType: 'text/plain',
      size: 6,
    });
    const encryption = await buildMockAttachmentEncryptionMetadata({ mimeType: 'text/plain' }, envelope);

    await expect(resolveAttachmentUnwrapContext({
      transfer: 'remote',
      contentEncoding: 'mock-e2ee-envelope-v1',
      expectedPayloadSha256: encryption.sha256,
      encryption,
    })).resolves.toEqual({
      mediaKeyId: encryption.mediaKeyId,
      keyWrapAlg: encryption.keyWrapAlg,
      payloadSha256: encryption.sha256,
      wrappedMediaKey: encryption.wrappedMediaKey,
      wrappedMediaKeyDigest: encryption.wrappedMediaKeyDigest,
      unwrapKind: 'pulse_mock_media_key_unwrap',
    });
  });

  test('openAttachmentInNewTab uses provided opener', () => {
    const opener = jest.fn();
    const opened = openAttachmentInNewTab({
      downloadUrl: 'https://cdn.example.com/file.pdf',
    }, opener);

    expect(opened).toBe(true);
    expect(opener).toHaveBeenCalledWith('https://cdn.example.com/file.pdf', '_blank', 'noopener,noreferrer');
  });

  test('triggerAttachmentDownload creates a downloadable link', () => {
    const click = jest.fn();
    const remove = jest.fn();
    const appendChild = jest.fn();
    const createElement = jest.fn(() => ({
      click,
      remove,
      href: '',
      download: '',
      rel: '',
    }));
    const doc = {
      createElement,
      body: { appendChild },
    };

    const downloaded = triggerAttachmentDownload({
      name: 'rapport.pdf',
      downloadUrl: 'https://cdn.example.com/rapport.pdf',
    }, doc);

    expect(downloaded).toBe(true);
    expect(createElement).toHaveBeenCalledWith('a');
    expect(appendChild).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});

describe('e2ee transport payload helpers', () => {
  test('buildTransportAttachmentPayload strips transient urls but keeps verification state', () => {
    expect(buildTransportAttachmentPayload({
      name: 'foto.png',
      url: 'blob:temporary-preview',
      downloadUrl: 'http://localhost:3001/attachments/transport-1',
      transfer: 'remote',
      mimeType: 'application/pulse-e2ee-envelope+json',
      originalMimeType: 'image/png',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      accessVerification: {
        integrityVerified: true,
        wrappedKeyVerified: true,
        unwrapKind: 'pulse_mock_media_key_unwrap',
      },
    })).toEqual({
      name: 'foto.png',
      url: '',
      downloadUrl: 'http://localhost:3001/attachments/transport-1',
      thumbnailUrl: '',
      storageKey: '',
      transfer: 'remote',
      mimeType: 'application/pulse-e2ee-envelope+json',
      originalMimeType: 'image/png',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: '',
      size: null,
      caption: '',
      encryption: null,
      accessVerification: {
        integrityVerified: true,
        wrappedKeyVerified: true,
        unwrapKind: 'pulse_mock_media_key_unwrap',
      },
    });
  });

  test('buildRetryServicePayload keeps structured attachment data intact', () => {
    const payload = buildRetryServicePayload({
      text: 'Bijlage: foto.png',
      type: 'attachment',
      replyTo: { id: 'msg-parent-1' },
      attachment: {
        name: 'foto.png',
        url: 'blob:temporary-preview',
        downloadUrl: 'http://localhost:3001/attachments/retry-1',
        transfer: 'remote',
        mimeType: 'application/pulse-e2ee-envelope+json',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        accessVerification: {
          integrityVerified: true,
          wrappedKeyVerified: false,
          unwrapKind: 'attachment_encryption_contract',
        },
      },
    });

    expect(payload).toEqual({
      plaintext: 'Bijlage: foto.png',
      messageType: 'attachment',
      replyToMessageId: 'msg-parent-1',
      sharedContact: null,
      attachment: {
        name: 'foto.png',
        url: '',
        downloadUrl: 'http://localhost:3001/attachments/retry-1',
        thumbnailUrl: '',
        storageKey: '',
        transfer: 'remote',
        mimeType: 'application/pulse-e2ee-envelope+json',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        expectedPayloadSha256: '',
        size: null,
        caption: '',
        encryption: null,
        accessVerification: {
          integrityVerified: true,
          wrappedKeyVerified: false,
          unwrapKind: 'attachment_encryption_contract',
        },
      },
    });
  });

  test('buildForwardServicePayload preserves attachment contracts for forwarding', () => {
    const payload = buildForwardServicePayload({
      type: 'attachment',
      text: 'foto.png',
      attachment: {
        name: 'foto.png',
        url: 'blob:temporary-preview',
        downloadUrl: 'http://localhost:3001/attachments/fwd-1',
        transfer: 'remote',
        mimeType: 'application/pulse-e2ee-envelope+json',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        accessVerification: {
          integrityVerified: true,
          wrappedKeyVerified: true,
          unwrapKind: 'pulse_mock_media_key_unwrap',
        },
        encryption: {
          alg: 'mock-e2ee-envelope-v1',
          envelopeKind: 'pulse_mock_media_envelope',
          originalMimeType: 'image/png',
        },
      },
    });

    expect(payload.messageType).toBe('attachment');
    expect(payload.plaintext).toBe('foto.png');
    expect(payload.attachment.originalMimeType).toBe('image/png');
    expect(payload.attachment.contentEncoding).toBe('mock-e2ee-envelope-v1');
    expect(payload.attachment.envelopeKind).toBe('pulse_mock_media_envelope');
    expect(payload.attachment.expectedPayloadSha256).toBe('');
    expect(payload.attachment.url).toBe('');
    expect(payload.attachment.accessVerification).toEqual({
      integrityVerified: true,
      wrappedKeyVerified: true,
      unwrapKind: 'pulse_mock_media_key_unwrap',
    });
  });

  test('buildForwardServicePayload prefixes plain text forwards but not structured contact forwards', () => {
    expect(buildForwardServicePayload({ text: 'Hallo' })).toEqual({
      plaintext: '↪️ Hallo',
      messageType: 'text',
      sharedContact: null,
      attachment: null,
    });

    expect(buildForwardServicePayload({
      type: 'contact',
      text: 'Contactpersoon: Habiba',
      sharedContact: { uid: 'user-2', name: 'Habiba' },
    })).toEqual({
      plaintext: 'Contactpersoon: Habiba',
      messageType: 'contact',
      sharedContact: { uid: 'user-2', name: 'Habiba' },
      attachment: null,
    });
  });
});
