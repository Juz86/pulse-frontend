import {
  buildPendingMessage,
  getMessageDisplayText,
  normalizeIncomingMessage,
  patchPendingMessageAsFailed,
  patchPendingMessageAsSent,
} from './messageModel';
import {
  applyConversationSummaryToList,
  buildConversationAttachmentSummaryPreview,
  buildConversationSummaryAttachmentSource,
  buildConversationSummaryAttachmentPayload,
  hasConversationAttachmentSummaryFields,
  buildConversationSummaryUpdate,
  getConversationAttachmentSummaryPresentation,
  getConversationPreview,
  normalizeConversationAttachmentSummary,
} from './conversationSummaries';
import {
  buildForwardServicePayload,
  buildRetryServicePayload,
  getOutgoingMessageScopeError,
  isSupportedOutgoingMessageType,
  OUTGOING_ATTACHMENT_SCOPE_ERROR,
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
  ATTACHMENT_EXTERNAL_CONTRACT_STRATEGY,
  ATTACHMENT_FUTURE_ENVELOPE_ALG,
  ATTACHMENT_FUTURE_ENVELOPE_KIND,
  ATTACHMENT_FUTURE_KEY_WRAP_ALG,
  ATTACHMENT_FUTURE_MEDIA_STRATEGY,
  ATTACHMENT_MOCK_ENVELOPE_ALG,
  ATTACHMENT_MOCK_MEDIA_STRATEGY,
  ATTACHMENT_NONE_STRATEGY,
  getAttachmentStrategyDisplayName,
} from './attachmentStrategyConstants';
import {
  buildAttachmentEncryptionMetadata,
  buildFutureAttachmentEncryptionDraft,
  buildMockAttachmentEncryptionMetadata,
  createMockEncryptedAttachmentEnvelope,
  decodeMockWrappedMediaKey,
  decodeMockAttachmentEnvelopeDataUrl,
  decryptAttachmentEnvelopeBlob,
  decryptMockAttachmentEnvelopeBlob,
  getAttachmentEncryptionCapability,
  isMockAttachmentEncryption,
  resolveAttachmentEncryptionStrategy,
  unwrapAttachmentMediaKey,
  unwrapMockWrappedMediaKey,
  validateAttachmentMediaKeyContract,
  validateMockWrappedMediaKeyContract,
  verifyMockAttachmentEnvelope,
} from './attachmentCrypto';
import {
  buildAttachmentMessageCardPresentation,
  buildAttachmentRenderState,
  buildAttachmentInteractionState,
  getAttachmentActionPresentation,
  getAttachmentActionButtonStyle,
  getAttachmentActionRowStyle,
  getAttachmentActionButtonsPresentation,
  getAttachmentAccessVerificationPresentation,
  getAttachmentDetailLines,
  getAttachmentDetailLineStyle,
  getAttachmentErrorStyle,
  getAttachmentImagePreviewStyle,
  getAttachmentMetaStyle,
  getAttachmentTimestampStyle,
  getAttachmentContentPresentation,
  getAttachmentBodyPresentation,
  getAttachmentBodyLayoutPresentation,
  getAttachmentFileBadgePresentation,
  getAttachmentVariantPresentation,
  getAttachmentCardPresentation,
  getAttachmentCardInteractionProps,
  getAttachmentContractPresentation,
  getAttachmentInteractionPresentation,
  getAttachmentActionsPresentation,
  getAttachmentActionButtonProps,
  getAttachmentPreviewText,
  getAttachmentStrategyPresentation,
} from './attachmentPresentation';
import {
  getServiceTransportFallbackBannerState,
} from './config';
import {
  assertAttachmentBinaryAccessSupported,
  createAttachmentMessageActionRuntime,
  clearAttachmentMetadataCache,
  getAttachmentAccessInfo,
} from './attachmentAccessAdapter';
import { messagingService } from './messagingService';

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
      strategyKey: '',
      originalMimeType: 'image/png',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: '',
      expectedPayloadSha256: '',
      size: null,
      caption: '',
      encryption: null,
      accessVerification: {
        strategyKey: '',
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
      strategyKey: '',
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

describe('e2ee messaging service scope guards', () => {
  test('sendMessage rejects attachment messages in the active Pulse scope', async () => {
    await expect(
      messagingService.sendMessage({
        user: {
          uid: 'user-1',
          getIdToken: async () => 'token',
        },
        conversationId: 'conv-1',
        recipientUserIds: ['user-2'],
        plaintext: 'Bijlage',
        messageType: 'attachment',
        attachment: {
          name: 'foto.png',
          url: 'data:image/png;base64,AA==',
        },
      }, 'device-1')
    ).rejects.toThrow('Bijlagen versturen is niet beschikbaar in Pulse.');
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

describe('e2ee config helpers', () => {
  test('getAttachmentStrategyDisplayName derives human-readable strategy labels', () => {
    expect(getAttachmentStrategyDisplayName('mock_media_v1')).toBe('mock-profiel (mock_media_v1)');
    expect(getAttachmentStrategyDisplayName('pulse_media_v1')).toBe('future-draft (pulse_media_v1)');
    expect(getAttachmentStrategyDisplayName('external_contract')).toBe('external_contract');
  });

  test('getServiceTransportFallbackBannerState derives visibility and copy together', () => {
    expect(getServiceTransportFallbackBannerState({
      transport: 'service',
      serviceTransportReady: false,
    })).toEqual({
      visible: true,
      tone: 'fallback',
      text: 'Serviceversleuteling is tijdelijk niet beschikbaar. Pulse gebruikt nu automatisch socketfallback.',
    });

    expect(getServiceTransportFallbackBannerState({
      transport: 'socket',
      serviceTransportReady: false,
    })).toEqual({
      visible: false,
      tone: 'fallback',
      text: 'Serviceversleuteling is tijdelijk niet beschikbaar. Pulse gebruikt nu automatisch socketfallback.',
    });
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
      strategyKey: '',
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
        strategyKey: '',
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
      strategyKey: '',
      originalMimeType: 'image/jpeg',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: '',
      size: null,
      caption: '',
      encryption: {
        alg: 'aes-gcm',
        strategyKey: '',
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
      strategyKey: '',
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
      strategyKey: '',
      originalMimeType: 'text/plain',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: 'abcd1234',
      size: null,
      caption: '',
      encryption: {
        alg: 'mock-e2ee-envelope-v1',
        strategyKey: '',
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
      strategyKey: 'mock_media_v1',
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

  test('buildAttachmentEncryptionMetadata routes through the current attachment encryption strategy', async () => {
    const { envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });

    await expect(buildAttachmentEncryptionMetadata({
      mimeType: 'text/plain',
    }, envelope)).resolves.toEqual({
      alg: 'mock-e2ee-envelope-v1',
      strategyKey: 'mock_media_v1',
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

    await expect(buildAttachmentEncryptionMetadata({
      mimeType: 'text/plain',
      encryption: {
        strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      },
    }, envelope)).resolves.toEqual({
      alg: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      keyId: '',
      iv: '',
      sha256: envelope.payloadSha256,
      mediaKeyId: '',
      keyWrapAlg: ATTACHMENT_FUTURE_KEY_WRAP_ALG,
      wrappedMediaKey: '',
      wrappedMediaKeyDigest: '',
      envelopeKind: ATTACHMENT_FUTURE_ENVELOPE_KIND,
      originalMimeType: 'text/plain',
    });
  });

  test('isMockAttachmentEncryption detects the current mock media algorithm', () => {
    expect(isMockAttachmentEncryption({ alg: 'mock-e2ee-envelope-v1' })).toBe(true);
    expect(isMockAttachmentEncryption({ alg: 'future-media-v1' })).toBe(false);
  });

  test('resolveAttachmentEncryptionStrategy classifies current media encryption strategies', () => {
    expect(resolveAttachmentEncryptionStrategy({ alg: 'mock-e2ee-envelope-v1' })).toEqual({
      alg: 'mock-e2ee-envelope-v1',
      isMock: true,
      isFutureMedia: false,
      hasEncryption: true,
      canEncryptEnvelope: true,
      canDecryptEnvelope: true,
      canValidateWrappedMediaKey: true,
      strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
    });

    expect(resolveAttachmentEncryptionStrategy({ alg: 'future-media-v1' })).toEqual({
      alg: 'future-media-v1',
      isMock: false,
      isFutureMedia: false,
      hasEncryption: true,
      canEncryptEnvelope: false,
      canDecryptEnvelope: false,
      canValidateWrappedMediaKey: false,
      strategyKey: ATTACHMENT_EXTERNAL_CONTRACT_STRATEGY,
    });

    expect(resolveAttachmentEncryptionStrategy({ alg: ATTACHMENT_FUTURE_ENVELOPE_ALG })).toEqual({
      alg: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      isMock: false,
      isFutureMedia: true,
      hasEncryption: true,
      canEncryptEnvelope: false,
      canDecryptEnvelope: false,
      canValidateWrappedMediaKey: false,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    });

    expect(resolveAttachmentEncryptionStrategy({})).toEqual({
      alg: '',
      isMock: false,
      isFutureMedia: false,
      hasEncryption: false,
      canEncryptEnvelope: true,
      canDecryptEnvelope: false,
      canValidateWrappedMediaKey: false,
      strategyKey: ATTACHMENT_NONE_STRATEGY,
    });
  });

  test('getAttachmentEncryptionCapability exposes binary access support state', () => {
    expect(getAttachmentEncryptionCapability({ alg: ATTACHMENT_MOCK_ENVELOPE_ALG })).toMatchObject({
      strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
      binaryAccessSupported: true,
      binaryAccessSupportLabel: 'supported',
      requiresFutureStrategySupport: false,
    });

    expect(getAttachmentEncryptionCapability({ alg: ATTACHMENT_FUTURE_ENVELOPE_ALG })).toMatchObject({
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      binaryAccessSupported: false,
      binaryAccessSupportLabel: 'future_strategy_required',
      requiresFutureStrategySupport: true,
    });
  });

  test('buildFutureAttachmentEncryptionDraft creates a stable placeholder contract for real media storage', () => {
    expect(buildFutureAttachmentEncryptionDraft({
      originalMimeType: 'image/png',
      payloadSha256: 'future-sha-1',
    })).toEqual({
      alg: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      keyId: '',
      iv: '',
      sha256: 'future-sha-1',
      mediaKeyId: '',
      keyWrapAlg: ATTACHMENT_FUTURE_KEY_WRAP_ALG,
      wrappedMediaKey: '',
      wrappedMediaKeyDigest: '',
      envelopeKind: ATTACHMENT_FUTURE_ENVELOPE_KIND,
      originalMimeType: 'image/png',
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

  test('validateAttachmentMediaKeyContract routes through the active media key strategy', async () => {
    const { envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });
    const encryption = await buildMockAttachmentEncryptionMetadata({ mimeType: 'text/plain' }, envelope);

    await expect(validateAttachmentMediaKeyContract({
      alg: 'mock-e2ee-envelope-v1',
      ...encryption,
    })).resolves.toEqual({
      version: 1,
      kind: 'pulse_mock_wrapped_media_key',
      seed: envelope.payloadSha256,
      mediaKeyId: encryption.mediaKeyId,
      keyWrapAlg: encryption.keyWrapAlg,
    });
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

  test('unwrapAttachmentMediaKey routes through the active media key strategy', async () => {
    const { envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });
    const encryption = await buildMockAttachmentEncryptionMetadata({ mimeType: 'text/plain' }, envelope);

    await expect(unwrapAttachmentMediaKey({
      alg: 'mock-e2ee-envelope-v1',
      ...encryption,
    })).resolves.toEqual({
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
      strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
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
      hasUnsupportedBinaryAccess: false,
      availabilityHintLabel: '',
      mimeLabel: 'image/png',
      storageLabel: 'Mock versleutelde opslaglink',
      storageShortLabel: 'versleuteld',
      strategyHintLabel: 'mock-profiel',
      storageDetail: 'Envelope: pulse_mock_media_envelope · strategie mock_media_v1 · integriteitscheck actief',
      keyContractDetail: 'Media key: mock-media-key-1 · wrap: pulse_mock_media_key_wrap_v1',
    });
  });

  test('getAttachmentContractPresentation derives consistent labels for future encrypted remote attachments', () => {
    expect(getAttachmentContractPresentation({
      transfer: 'remote',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      contentEncoding: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      originalMimeType: 'image/png',
      envelopeKind: ATTACHMENT_FUTURE_ENVELOPE_KIND,
      expectedPayloadSha256: 'future-deadbeef',
      encryption: {
        mediaKeyId: 'future-media-key-1',
        keyWrapAlg: ATTACHMENT_FUTURE_KEY_WRAP_ALG,
        wrappedMediaKeyDigest: 'future-digest-1',
      },
    })).toEqual({
      isRemote: true,
      isEncryptedRemote: true,
      hasIntegrityContract: true,
      hasWrappedMediaKeyContract: true,
      hasUnsupportedBinaryAccess: true,
      availabilityHintLabel: 'binary access volgt later',
      mimeLabel: 'image/png',
      storageLabel: 'Toekomstige versleutelde opslaglink',
      storageShortLabel: 'versleuteld',
      strategyHintLabel: 'future-draft',
      storageDetail: 'Envelope: pulse_media_envelope · strategie pulse_media_v1 · integriteitscheck actief',
      keyContractDetail: 'Media key: future-media-key-1 · wrap: pulse_media_key_wrap_v1 · digest actief',
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
      hasUnsupportedBinaryAccess: false,
      availabilityHintLabel: '',
      mimeLabel: 'application/pdf',
      storageLabel: 'Beveiligde opslaglink',
      storageShortLabel: 'opslaglink',
      strategyHintLabel: '',
      storageDetail: '',
      keyContractDetail: '',
    });
  });

  test('getAttachmentStrategyPresentation derives strategy-aware labels from attachment contracts', () => {
    expect(getAttachmentStrategyPresentation({
      transfer: 'remote',
      contentEncoding: 'mock-e2ee-envelope-v1',
    })).toEqual({
      strategyKey: 'mock_media_v1',
      isMockStrategy: true,
      isFutureStrategy: false,
      strategyHintLabel: 'mock-profiel',
      storageLabelPrefix: 'Mock',
    });

    expect(getAttachmentStrategyPresentation({
      strategyKey: 'pulse_media_v1',
      transfer: 'remote',
    })).toEqual({
      strategyKey: 'pulse_media_v1',
      isMockStrategy: false,
      isFutureStrategy: true,
      strategyHintLabel: 'future-draft',
      storageLabelPrefix: 'Toekomstige',
    });
  });

  test('getAttachmentAccessVerificationPresentation derives labels for verified remote access', () => {
    expect(getAttachmentAccessVerificationPresentation({
      strategyKey: 'mock_media_v1',
      integrityVerified: true,
      wrappedKeyVerified: true,
    }, {
      unwrapKind: 'pulse_mock_media_key_unwrap',
    })).toEqual({
      strategyLabel: 'Media-strategie: mock_media_v1',
      availabilityLabel: '',
      integrityAccessLabel: 'Downloadcontract bevestigd',
      wrappedKeyAccessLabel: 'Wrapped media key gevalideerd · pulse_mock_media_key_unwrap',
    });
  });

  test('getAttachmentAccessVerificationPresentation flags future media drafts before decrypt support exists', () => {
    expect(getAttachmentAccessVerificationPresentation({
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      integrityVerified: false,
      wrappedKeyVerified: false,
    })).toEqual({
      strategyLabel: 'Media-strategie: pulse_media_v1',
      availabilityLabel: 'Decrypt-draft actief voor pulse_media_v1',
      integrityAccessLabel: '',
      wrappedKeyAccessLabel: '',
    });
  });

  test('getAttachmentAccessVerificationPresentation reuses persisted attachment verification state', () => {
    expect(getAttachmentAccessVerificationPresentation({
      accessVerification: {
        strategyKey: 'mock_media_v1',
        integrityVerified: true,
        wrappedKeyVerified: true,
        unwrapKind: 'pulse_mock_media_key_unwrap',
      },
    })).toEqual({
      strategyLabel: 'Media-strategie: mock_media_v1',
      availabilityLabel: '',
      integrityAccessLabel: 'Downloadcontract bevestigd',
      wrappedKeyAccessLabel: 'Wrapped media key gevalideerd · pulse_mock_media_key_unwrap',
    });
  });

  test('getAttachmentActionPresentation keeps binary actions enabled for supported attachments', () => {
    expect(getAttachmentActionPresentation({
      canOpen: true,
      requiresFutureStrategySupport: false,
    })).toEqual({
      actionsEnabled: true,
      openLabel: 'Openen',
      downloadLabel: 'Downloaden',
      availabilityDetail: '',
    });
  });

  test('getAttachmentActionPresentation disables binary actions for future draft attachments', () => {
    expect(getAttachmentActionPresentation({
      canOpen: true,
      binaryAccessSupportLabel: 'future_strategy_required',
      requiresFutureStrategySupport: true,
    })).toEqual({
      actionsEnabled: false,
      openLabel: 'Nog niet beschikbaar',
      downloadLabel: 'Downloaden',
      availabilityDetail: 'Openen en downloaden worden actief zodra deze decrypt-strategie beschikbaar is.',
    });
  });

  test('getAttachmentActionPresentation disables binary actions for unsupported attachment strategies', () => {
    expect(getAttachmentActionPresentation({
      canOpen: true,
      binaryAccessSupportLabel: 'unsupported',
    })).toEqual({
      actionsEnabled: false,
      openLabel: 'Nog niet beschikbaar',
      downloadLabel: 'Downloaden',
      availabilityDetail: 'Deze versleutelingsstrategie ondersteunt nu nog geen openen of downloaden in de client.',
    });
  });

  test('getAttachmentInteractionPresentation combines access contract verification and actions', () => {
    expect(getAttachmentInteractionPresentation({
      name: 'future.png',
      transfer: 'remote',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      contentEncoding: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      encryption: { alg: ATTACHMENT_FUTURE_ENVELOPE_ALG },
    })).toMatchObject({
      access: {
        isFutureEncryptedRemote: true,
        requiresFutureStrategySupport: true,
      },
      contract: {
        isEncryptedRemote: true,
        hasUnsupportedBinaryAccess: true,
      },
      actions: {
        actionsEnabled: false,
        openLabel: 'Nog niet beschikbaar',
      },
      verification: {
        availabilityLabel: 'Decrypt-draft actief voor pulse_media_v1',
      },
    });
  });

  test('buildAttachmentInteractionState centralizes attachment preview and interaction derivation', () => {
    expect(buildAttachmentInteractionState(
      {
        name: 'foto.png',
        downloadUrl: 'https://cdn.example.com/foto.png',
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        transfer: 'remote',
        mimeType: 'application/pulse-e2ee-envelope+json',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
        expectedPayloadSha256: 'mock-sha256',
        encryption: {
          strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
          mediaKeyId: 'key-1',
          keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
          wrappedMediaKeyDigest: 'digest-1',
        },
      },
      null,
      {
        unwrapContext: {
          unwrapKind: 'pulse_mock_media_key_unwrap',
        },
      }
    )).toMatchObject({
      attachment: {
        name: 'foto.png',
      },
      previewUrl: 'https://cdn.example.com/thumb.png',
      access: {
        isImage: true,
      },
      contract: {
        storageShortLabel: 'versleuteld',
      },
      verification: {
        integrityAccessLabel: '',
      },
      actions: {
        actionsEnabled: true,
      },
    });
  });

  test('getAttachmentCardPresentation derives stable card interactivity props', () => {
    expect(getAttachmentCardPresentation(
      { name: 'foto.png' },
      { actionsEnabled: true }
    )).toEqual({
      interactive: true,
      role: 'button',
      tabIndex: 0,
      ariaLabel: 'Open bijlage foto.png',
      cursor: 'pointer',
    });

    expect(getAttachmentCardPresentation(
      { name: 'draft.png' },
      { actionsEnabled: false }
    )).toEqual({
      interactive: false,
      role: undefined,
      tabIndex: undefined,
      ariaLabel: undefined,
      cursor: 'default',
    });
  });

  test('getAttachmentCardInteractionProps centralizes attachment card event wiring', () => {
    const onOpen = jest.fn();
    const preventDefault = jest.fn();
    const interactiveProps = getAttachmentCardInteractionProps(
      {
        interactive: true,
        cursor: 'pointer',
      },
      onOpen
    );

    interactiveProps.onClick();
    interactiveProps.onKeyDown({ key: 'Enter', preventDefault });

    expect(interactiveProps.style).toEqual({ cursor: 'pointer' });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(2);

    expect(getAttachmentCardInteractionProps(
      {
        interactive: false,
        cursor: 'default',
      },
      onOpen
    )).toEqual({
      style: { cursor: 'default' },
      onClick: undefined,
      onKeyDown: undefined,
    });
  });

  test('getAttachmentActionButtonsPresentation derives button state from action availability and busy state', () => {
    expect(getAttachmentActionButtonsPresentation(
      {
        actionsEnabled: true,
        openLabel: 'Openen',
        downloadLabel: 'Downloaden',
      },
      { busy: false }
    )).toEqual({
      buttonsEnabled: true,
      openDisabled: false,
      downloadDisabled: false,
      openLabel: 'Openen',
      downloadLabel: 'Downloaden',
    });

    expect(getAttachmentActionButtonsPresentation(
      {
        actionsEnabled: true,
        openLabel: 'Openen',
        downloadLabel: 'Downloaden',
      },
      { busy: true }
    )).toEqual({
      buttonsEnabled: false,
      openDisabled: true,
      downloadDisabled: true,
      openLabel: 'Voorbereiden…',
      downloadLabel: 'Downloaden',
    });
  });

  test('getAttachmentActionButtonProps centralizes open and download button interaction wiring', () => {
    const onAction = jest.fn();
    const stopPropagation = jest.fn();
    const openButtonProps = getAttachmentActionButtonProps('open', onAction);

    openButtonProps.onClick({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('open');
  });

  test('getAttachmentActionsPresentation centralizes the full action row configuration', () => {
    const onAction = jest.fn();
    const presentation = getAttachmentActionsPresentation(
      {
        openDisabled: false,
        downloadDisabled: true,
        openLabel: 'Openen',
        downloadLabel: 'Downloaden',
      },
      { isOwn: true, onAction }
    );

    expect(presentation.rowStyle).toEqual({
      display: 'flex',
      gap: 8,
      marginTop: 10,
      flexWrap: 'wrap',
    });
    expect(presentation.buttons).toHaveLength(2);
    expect(presentation.buttons[0]).toMatchObject({
      key: 'open',
      disabled: false,
      label: 'Openen',
    });
    expect(presentation.buttons[1]).toMatchObject({
      key: 'download',
      disabled: true,
      label: 'Downloaden',
    });
  });

  test('getAttachmentActionButtonStyle derives stable open and download button styles', () => {
    expect(getAttachmentActionButtonStyle('open', true)).toMatchObject({
      minHeight: 32,
      background: 'rgba(255,255,255,0.14)',
      color: '#fff',
    });

    expect(getAttachmentActionButtonStyle('download', false)).toMatchObject({
      minHeight: 32,
      background: 'transparent',
      color: 'var(--text2)',
    });
  });

  test('getAttachmentActionRowStyle derives stable layout for attachment action rows', () => {
    expect(getAttachmentActionRowStyle()).toEqual({
      display: 'flex',
      gap: 8,
      marginTop: 10,
      flexWrap: 'wrap',
    });
  });

  test('getAttachmentImagePreviewStyle derives stable image preview styling', () => {
    expect(getAttachmentImagePreviewStyle()).toEqual({
      display: 'block',
      width: '100%',
      maxWidth: 280,
      maxHeight: 240,
      objectFit: 'cover',
      borderRadius: 14,
      marginBottom: 10,
    });
  });

  test('getAttachmentMetaStyle centralizes attachment metadata styling', () => {
    expect(getAttachmentMetaStyle(true)).toEqual({
      color: 'rgba(255,255,255,.65)',
    });

    expect(getAttachmentMetaStyle(false)).toEqual({
      color: 'var(--text3)',
    });
  });

  test('getAttachmentTimestampStyle centralizes attachment timestamp styling', () => {
    expect(getAttachmentTimestampStyle(true)).toEqual({
      fontSize: '11px',
      color: 'rgba(255,255,255,.5)',
      alignSelf: 'flex-end',
    });

    expect(getAttachmentTimestampStyle(false)).toEqual({
      fontSize: '11px',
      color: 'var(--text3)',
      alignSelf: 'flex-end',
    });
  });

  test('getAttachmentContentPresentation centralizes attachment titles subtitles and detail spacing', () => {
    const imagePresentation = getAttachmentContentPresentation(
      {
        name: 'foto.png',
        caption: 'Omslagfoto',
      },
      {
        mimeLabel: 'image/png',
      },
      { isImage: true }
    );

    expect(imagePresentation.title).toBe('foto.png');
    expect(imagePresentation.subtitle).toBe('Omslagfoto');
    expect(imagePresentation.imageAlt).toBe('foto.png');
    expect(imagePresentation.detailMarginTopForTone('storage')).toBe(8);
    expect(imagePresentation.detailMarginTopForTone('detail')).toBe(4);

    const filePresentation = getAttachmentContentPresentation(
      {},
      {
        mimeLabel: 'application/pdf',
      },
      { isImage: false }
    );

    expect(filePresentation.title).toBe('Bijlage');
    expect(filePresentation.subtitle).toBe('application/pdf');
    expect(filePresentation.imageAlt).toBe('Gedeelde afbeelding');
    expect(filePresentation.detailMarginTopForTone('storage')).toBe(6);
    expect(filePresentation.detailMarginTopForTone('availability')).toBe(4);
  });

  test('getAttachmentBodyPresentation centralizes attachment body copy detail rows and errors', () => {
    const bodyPresentation = getAttachmentBodyPresentation(
      {
        title: 'foto.png',
        subtitle: 'image/png',
        detailMarginTopForTone: (tone) => (tone === 'storage' ? 8 : 4),
      },
      [
        { tone: 'storage', text: 'Mock versleutelde opslaglink' },
        { tone: 'detail', text: 'Integriteit bevestigd via SHA-256 metadata' },
      ],
      'Download mislukt',
      { isOwn: true, actionsPresentation: { buttons: [{ key: 'open' }] } }
    );

    expect(bodyPresentation.title).toBe('foto.png');
    expect(bodyPresentation.subtitle).toBe('image/png');
    expect(bodyPresentation.subtitleStyle).toEqual({
      color: 'rgba(255,255,255,.65)',
    });
    expect(bodyPresentation.details).toEqual([
      {
        key: 'storage-0',
        text: 'Mock versleutelde opslaglink',
        className: 'u-fs-12',
        style: {
          marginTop: 8,
          color: 'rgba(255,255,255,.78)',
          opacity: 0.9,
        },
      },
      {
        key: 'detail-1',
        text: 'Integriteit bevestigd via SHA-256 metadata',
        className: 'u-fs-12',
        style: {
          marginTop: 4,
          color: 'rgba(255,255,255,.58)',
          opacity: 0.82,
        },
      },
    ]);
    expect(bodyPresentation.errorText).toBe('Download mislukt');
    expect(bodyPresentation.errorStyle).toEqual({
      marginTop: 8,
      color: 'rgba(255,215,215,.92)',
    });
    expect(bodyPresentation.actionsPresentation).toEqual({
      buttons: [{ key: 'open' }],
    });
  });

  test('getAttachmentBodyLayoutPresentation centralizes image and file wrapper layout', () => {
    expect(getAttachmentBodyLayoutPresentation(
      { showsImagePreview: true, showsFileBadge: false },
      { imageAlt: 'foto.png' },
      { previewUrl: 'https://cdn.example.com/foto.png' }
    )).toEqual({
      wrapperClassName: 'u-flex-1 u-min-w-0',
      preview: {
        src: 'https://cdn.example.com/foto.png',
        alt: 'foto.png',
        style: {
          display: 'block',
          width: '100%',
          maxWidth: 280,
          maxHeight: 240,
          objectFit: 'cover',
          borderRadius: 14,
          marginBottom: 10,
        },
      },
      fileBadge: null,
    });

    expect(getAttachmentBodyLayoutPresentation(
      { showsImagePreview: false, showsFileBadge: true },
      {},
      { fileBadgePresentation: { label: 'F', style: { borderRadius: 12 } } }
    )).toEqual({
      wrapperClassName: 'u-flex-1 u-min-w-0',
      preview: null,
      fileBadge: {
        label: 'F',
        style: {
          borderRadius: 12,
        },
      },
    });
  });

  test('getAttachmentFileBadgePresentation centralizes file badge defaults', () => {
    expect(getAttachmentFileBadgePresentation()).toEqual({
      label: 'F',
      style: {
        borderRadius: 12,
      },
    });
  });

  test('getAttachmentVariantPresentation centralizes image versus file layout state', () => {
    expect(getAttachmentVariantPresentation({ isImage: true })).toEqual({
      isImage: true,
      layout: 'image',
      showsImagePreview: true,
      showsFileBadge: false,
    });

    expect(getAttachmentVariantPresentation({ isImage: false })).toEqual({
      isImage: false,
      layout: 'file',
      showsImagePreview: false,
      showsFileBadge: true,
    });
  });

  test('buildAttachmentRenderState combines interaction card and button presentation', () => {
    expect(buildAttachmentRenderState(
      {
        name: 'foto.png',
        downloadUrl: 'https://cdn.example.com/foto.png',
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        transfer: 'remote',
        mimeType: 'application/pulse-e2ee-envelope+json',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
      },
      null,
      null,
      { busy: true }
    )).toMatchObject({
      attachment: {
        name: 'foto.png',
      },
      previewUrl: 'https://cdn.example.com/thumb.png',
      access: {
        isImage: true,
      },
      variant: {
        layout: 'image',
        showsImagePreview: true,
      },
      content: {
        title: 'foto.png',
        subtitle: 'image/png',
        imageAlt: 'foto.png',
      },
      fileBadge: null,
      card: {
        interactive: true,
        role: 'button',
      },
      buttons: {
        openDisabled: true,
        downloadDisabled: true,
        openLabel: 'Voorbereiden…',
      },
    });
  });

  test('buildAttachmentRenderState includes file badge and file-specific content defaults', () => {
    expect(buildAttachmentRenderState(
      {
        transfer: 'remote',
        mimeType: 'application/pdf',
      },
      null,
      null,
      { busy: false }
    )).toMatchObject({
      access: {
        isImage: false,
      },
      variant: {
        layout: 'file',
        showsFileBadge: true,
      },
      content: {
        title: 'Bijlage',
        subtitle: 'application/pdf',
        imageAlt: 'Gedeelde afbeelding',
      },
      fileBadge: {
        label: 'F',
      },
    });
  });

  test('buildAttachmentMessageCardPresentation centralizes the full attachment message card state', () => {
    const presentation = buildAttachmentMessageCardPresentation(
      {
        name: 'foto.png',
        downloadUrl: 'https://cdn.example.com/foto.png',
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        transfer: 'remote',
        mimeType: 'application/pulse-e2ee-envelope+json',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
      },
      null,
      null,
      {
        busy: false,
        isOwn: true,
        actionError: '',
        onOpen: jest.fn(),
        onAction: jest.fn(),
      }
    );

    expect(presentation.variant).toMatchObject({
      layout: 'image',
      showsImagePreview: true,
    });
    expect(presentation.cardInteraction.style).toEqual({ cursor: 'pointer' });
    expect(presentation.body.title).toBe('foto.png');
    expect(presentation.bodyLayout.preview).toMatchObject({
      src: 'https://cdn.example.com/thumb.png',
      alt: 'foto.png',
    });
    expect(presentation.actionsPresentation.buttons).toHaveLength(2);
    expect(presentation.timestampStyle).toEqual({
      fontSize: '11px',
      color: 'rgba(255,255,255,.5)',
      alignSelf: 'flex-end',
    });
  });

  test('getAttachmentDetailLines centralizes attachment contract and availability copy', () => {
    expect(getAttachmentDetailLines(
      {
        isRemote: true,
        storageLabel: 'Mock versleutelde opslaglink',
        storageDetail: 'Envelope: pulse_mock_media_envelope',
        hasIntegrityContract: true,
        keyContractDetail: 'Media key: key-1 · wrap: pulse_mock_media_key_wrap_v1',
      },
      {
        integrityAccessLabel: 'Downloadcontract bevestigd',
        availabilityLabel: 'Decrypt-draft actief voor pulse_media_v1',
        wrappedKeyAccessLabel: 'Wrapped media key gevalideerd · pulse_mock_media_key_unwrap',
      },
      {
        availabilityDetail: 'Openen en downloaden worden actief zodra deze decrypt-strategie beschikbaar is.',
      }
    )).toEqual([
      { tone: 'storage', text: 'Mock versleutelde opslaglink' },
      { tone: 'detail', text: 'Envelope: pulse_mock_media_envelope' },
      { tone: 'detail', text: 'Integriteit bevestigd via SHA-256 metadata' },
      { tone: 'detail', text: 'Media key: key-1 · wrap: pulse_mock_media_key_wrap_v1' },
      { tone: 'detail', text: 'Downloadcontract bevestigd' },
      { tone: 'availability', text: 'Decrypt-draft actief voor pulse_media_v1' },
      { tone: 'availability', text: 'Openen en downloaden worden actief zodra deze decrypt-strategie beschikbaar is.' },
      { tone: 'availability', text: 'Wrapped media key gevalideerd · pulse_mock_media_key_unwrap' },
    ]);
  });

  test('getAttachmentDetailLineStyle centralizes visual tone styles for attachment details', () => {
    expect(getAttachmentDetailLineStyle(true, 'storage', 8)).toEqual({
      marginTop: 8,
      color: 'rgba(255,255,255,.78)',
      opacity: 0.9,
    });

    expect(getAttachmentDetailLineStyle(false, 'availability', 4)).toEqual({
      marginTop: 4,
      color: 'var(--text3)',
      opacity: 0.78,
    });
  });

  test('getAttachmentErrorStyle centralizes attachment action error styling', () => {
    expect(getAttachmentErrorStyle(true)).toEqual({
      marginTop: 8,
      color: 'rgba(255,215,215,.92)',
    });

    expect(getAttachmentErrorStyle(false)).toEqual({
      marginTop: 8,
      color: '#ef4444',
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
      lastAttachmentName: 'rapport.pdf',
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
      strategyHintLabel: 'mock-profiel',
      availabilityHintLabel: '',
      mimeLabel: 'application/pdf',
      storageDetail: 'Envelope: pulse_mock_media_envelope · strategie mock_media_v1 · integriteitscheck actief',
      keyContractDetail: 'Media key: media-key-1 · wrap: pulse_mock_media_key_wrap_v1 · digest actief',
    });
  });

  test('buildConversationSummaryAttachmentPayload reconstructs attachment contracts from conversation summaries', () => {
    expect(buildConversationSummaryAttachmentPayload({
      lastMessage: 'Bijlage: rapport.pdf',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: 'remote',
      lastAttachmentStrategyKey: 'mock_media_v1',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentEnvelopeKind: 'pulse_mock_media_envelope',
      lastAttachmentOriginalMimeType: 'application/pdf',
      lastAttachmentExpectedPayloadSha256: 'hash-1',
      lastAttachmentMediaKeyId: 'media-key-1',
      lastAttachmentKeyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      lastAttachmentWrappedMediaKeyDigest: 'wrapped-digest-1',
    })).toEqual({
      name: 'rapport.pdf',
      url: '',
      downloadUrl: '',
      thumbnailUrl: '',
      storageKey: '',
      transfer: 'remote',
      mimeType: 'application/pdf',
      strategyKey: 'mock_media_v1',
      originalMimeType: 'application/pdf',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: 'hash-1',
      size: null,
      caption: '',
      encryption: {
        alg: '',
        strategyKey: 'mock_media_v1',
        keyId: '',
        iv: '',
        sha256: '',
        mediaKeyId: 'media-key-1',
        keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
        wrappedMediaKey: '',
        wrappedMediaKeyDigest: 'wrapped-digest-1',
        envelopeKind: 'pulse_mock_media_envelope',
        originalMimeType: '',
      },
      accessVerification: null,
    });
  });

  test('buildConversationAttachmentSummaryPreview centralizes attachment preview text and presentation', () => {
    expect(buildConversationAttachmentSummaryPreview({
      lastMessage: 'Bijlage: rapport.pdf',
      lastMessageType: 'attachment',
      lastAttachmentName: 'rapport.pdf',
      lastAttachmentTransfer: 'remote',
      lastAttachmentStrategyKey: 'mock_media_v1',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentEnvelopeKind: 'pulse_mock_media_envelope',
      lastAttachmentOriginalMimeType: 'application/pdf',
      lastAttachmentExpectedPayloadSha256: 'hash-1',
      lastAttachmentMediaKeyId: 'media-key-1',
      lastAttachmentKeyWrapAlg: 'pulse_mock_media_key_wrap_v1',
      lastAttachmentWrappedMediaKeyDigest: 'wrapped-digest-1',
    })).toEqual({
      attachment: {
        name: 'rapport.pdf',
        url: '',
        downloadUrl: '',
        thumbnailUrl: '',
        storageKey: '',
        transfer: 'remote',
        mimeType: 'application/pdf',
        strategyKey: 'mock_media_v1',
        originalMimeType: 'application/pdf',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        expectedPayloadSha256: 'hash-1',
        size: null,
        caption: '',
        encryption: {
          alg: '',
          strategyKey: 'mock_media_v1',
          keyId: '',
          iv: '',
          sha256: '',
          mediaKeyId: 'media-key-1',
          keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
          wrappedMediaKey: '',
          wrappedMediaKeyDigest: 'wrapped-digest-1',
          envelopeKind: 'pulse_mock_media_envelope',
          originalMimeType: '',
        },
        accessVerification: null,
      },
      presentation: {
        isRemote: true,
        isEncryptedRemote: true,
        hasIntegrityContract: true,
        hasWrappedMediaKeyContract: true,
        hasUnsupportedBinaryAccess: false,
        availabilityHintLabel: '',
        strategyHintLabel: 'mock-profiel',
        mimeLabel: 'application/pdf',
        storageLabel: 'Mock versleutelde opslaglink',
        storageShortLabel: 'versleuteld',
        storageDetail: 'Envelope: pulse_mock_media_envelope · strategie mock_media_v1 · integriteitscheck actief',
        keyContractDetail: 'Media key: media-key-1 · wrap: pulse_mock_media_key_wrap_v1 · digest actief',
      },
      previewText: 'Bijlage: rapport.pdf · versleuteld',
    });
  });

  test('buildConversationSummaryAttachmentSource prefers explicit attachment name over preview text', () => {
    expect(buildConversationSummaryAttachmentSource({
      lastMessage: 'Bijlage: oud.pdf · versleuteld',
      lastAttachmentName: 'nieuw.pdf',
      lastAttachmentTransfer: 'remote',
      lastAttachmentStrategyKey: 'mock_media_v1',
    })).toEqual({
      name: 'nieuw.pdf',
      transfer: 'remote',
      strategyKey: 'mock_media_v1',
      mimeType: '',
      originalMimeType: '',
      contentEncoding: '',
      envelopeKind: '',
      expectedPayloadSha256: '',
      encryption: {
        strategyKey: 'mock_media_v1',
        mediaKeyId: '',
        keyWrapAlg: '',
        wrappedMediaKeyDigest: '',
        envelopeKind: '',
      },
    });
  });

  test('hasConversationAttachmentSummaryFields detects when summary contract data exists', () => {
    expect(hasConversationAttachmentSummaryFields({})).toBe(false);
    expect(hasConversationAttachmentSummaryFields({
      lastAttachmentStrategyKey: 'mock_media_v1',
    })).toBe(true);
  });

  test('normalizeConversationAttachmentSummary fills attachment summary defaults', () => {
    expect(normalizeConversationAttachmentSummary({
      id: 'conv-1',
      lastMessage: 'Hallo',
    })).toEqual({
      id: 'conv-1',
      lastMessage: 'Hallo',
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
        lastAttachmentName: 'rapport.pdf',
        lastAttachmentTransfer: 'remote',
        lastAttachmentStrategyKey: null,
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

  test('getAttachmentAccessInfo exposes future decrypt-related access hints', () => {
    const info = getAttachmentAccessInfo({
      transfer: 'remote',
      downloadUrl: 'https://cdn.example.com/foto.png',
      mimeType: 'image/png',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      contentEncoding: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      encryption: {
        alg: ATTACHMENT_FUTURE_ENVELOPE_ALG,
        keyId: 'key-1',
        strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      },
    });

    expect(info.url).toBe('https://cdn.example.com/foto.png');
    expect(info.canOpen).toBe(true);
    expect(info.canDownload).toBe(true);
    expect(info.isImage).toBe(true);
    expect(info.needsRemoteFetch).toBe(true);
    expect(info.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
    expect(info.isEncryptedRemote).toBe(true);
    expect(info.isFutureEncryptedRemote).toBe(true);
    expect(info.canDecryptEnvelope).toBe(false);
    expect(info.canValidateWrappedMediaKey).toBe(false);
    expect(info.requiresFutureStrategySupport).toBe(true);
  });

  test('assertAttachmentBinaryAccessSupported rejects future media drafts without decrypt support', () => {
    expect(() => assertAttachmentBinaryAccessSupported({
      transfer: 'remote',
      downloadUrl: 'https://cdn.example.com/foto.png',
      mimeType: 'image/png',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      contentEncoding: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      encryption: {
        alg: ATTACHMENT_FUTURE_ENVELOPE_ALG,
        strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      },
    })).toThrow('Decrypt voor pulse_media_v1 is nog niet beschikbaar.');
  });

  test('createAttachmentMessageActionRuntime centralizes runner setup for message attachments', async () => {
    const setAttachmentBusy = jest.fn();
    const setResolvedAttachment = jest.fn();
    const setResolvedAttachmentAccess = jest.fn();
    const setAttachmentActionError = jest.fn();

    const runtime = createAttachmentMessageActionRuntime(
      {
        name: 'hello.txt',
        downloadUrl: 'https://cdn.example.com/hello.txt',
        transfer: 'remote',
      },
      null,
      null,
      {
        setAttachmentBusy,
        setResolvedAttachment,
        setResolvedAttachmentAccess,
        setAttachmentActionError,
        resolveAttachment: async (attachment) => ({
          ...attachment,
          expectedPayloadSha256: 'mock-sha256-binary',
        }),
        opener: jest.fn(),
      }
    );

    expect(runtime.activeAttachment).toMatchObject({
      name: 'hello.txt',
    });
    expect(typeof runtime.runAttachmentAction).toBe('function');

    const result = await runtime.runAttachmentAction('open');

    expect(result.succeeded).toBe(true);
    expect(setAttachmentBusy).not.toHaveBeenCalled();
    expect(setResolvedAttachment).toHaveBeenCalled();
    expect(setResolvedAttachmentAccess).toHaveBeenCalled();
    expect(setAttachmentActionError).toHaveBeenCalledWith('');
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

  test('decryptAttachmentEnvelopeBlob routes through the active envelope strategy', async () => {
    const { dataUrl, envelope } = await createMockEncryptedAttachmentEnvelope({
      name: 'hello.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
      size: 5,
    });
    const base64 = dataUrl.split(',')[1];
    const encryptedBlob = new Blob([atob(base64)], { type: 'application/pulse-e2ee-envelope+json' });

    const decryptedBlob = await decryptAttachmentEnvelopeBlob(encryptedBlob, {
      expectedPayloadSha256: envelope.payloadSha256,
      encryption: {
        alg: 'mock-e2ee-envelope-v1',
      },
    });

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

});

describe('e2ee transport payload helpers', () => {
  test('outgoing message scope helpers only allow text and contact messages', () => {
    expect(isSupportedOutgoingMessageType('text')).toBe(true);
    expect(isSupportedOutgoingMessageType('contact')).toBe(true);
    expect(isSupportedOutgoingMessageType('attachment')).toBe(false);
    expect(getOutgoingMessageScopeError('text')).toBe('');
    expect(getOutgoingMessageScopeError('attachment')).toBe(OUTGOING_ATTACHMENT_SCOPE_ERROR);
  });

  test('buildRetryServicePayload flags unsupported attachment messages in the active scope', () => {
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
        strategyKey: '',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
        accessVerification: {
          strategyKey: '',
          integrityVerified: true,
          wrappedKeyVerified: false,
          unwrapKind: 'attachment_encryption_contract',
        },
      },
    });

    expect(payload).toEqual({
      plaintext: 'Bijlage: foto.png',
      messageType: 'attachment',
      scopeError: OUTGOING_ATTACHMENT_SCOPE_ERROR,
      replyToMessageId: 'msg-parent-1',
      sharedContact: null,
    });
  });

  test('buildForwardServicePayload flags unsupported attachment forwards in the active scope', () => {
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
          strategyKey: '',
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

    expect(payload).toEqual({
      plaintext: 'foto.png',
      messageType: 'attachment',
      scopeError: OUTGOING_ATTACHMENT_SCOPE_ERROR,
      sharedContact: null,
    });
  });

  test('buildForwardServicePayload prefixes plain text forwards but not structured contact forwards', () => {
    expect(buildForwardServicePayload({ text: 'Hallo' })).toEqual({
      plaintext: '↪️ Hallo',
      messageType: 'text',
      scopeError: '',
      sharedContact: null,
    });

    expect(buildForwardServicePayload({
      type: 'contact',
      text: 'Contactpersoon: Habiba',
      sharedContact: { uid: 'user-2', name: 'Habiba' },
    })).toEqual({
      plaintext: 'Contactpersoon: Habiba',
      messageType: 'contact',
      scopeError: '',
      sharedContact: { uid: 'user-2', name: 'Habiba' },
    });
  });
});
