import {
  buildPendingMessage,
  getMessageDisplayText,
  normalizeIncomingMessage,
  patchPendingMessageAsFailed,
  patchPendingMessageAsSent,
} from './messageModel';
import {
  getDeletedMessageDisplayText,
  getEncryptedMessageDisplayText,
  getSharedContactFallbackDisplayText,
  getSharedContactDisplayText,
} from './messageCopy';
import {
  applyCallConversationSummaryToList,
  applyConversationSummaryToList,
  buildConversationPreviewPresentation,
  normalizeConversationSummaryRecord,
} from './conversationSummaries';
import {
  buildForwardServicePayload,
  buildServiceMessageResult,
  buildRetryServicePayload,
  buildSocketMessagePayload,
  getOutgoingMessageScopeError,
  isSupportedOutgoingMessageType,
  OUTGOING_ATTACHMENT_SCOPE_ERROR,
  resolveSupportedOutgoingMessageType,
} from './messageTransportPayload';
import {
  ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE,
  canApplyPlaintextEditUpdate,
  canEditMessage,
  isEncryptedProtocol,
} from './policy';
import {
  ENCRYPTED_MESSAGE_PROTOCOL,
  PLAINTEXT_MESSAGE_PROTOCOL,
} from './messageProtocolConstants';
import {
  normalizeSingleUserReaction,
  toggleSingleUserReaction,
} from './messageReactions';
import {
  getAttachmentDisplayName,
  MAX_E2EE_ATTACHMENT_BYTES,
  isImageAttachment,
  normalizeAttachmentPayload,
  resolveAttachmentUrl,
  validateAttachmentPayload,
} from './attachmentPayload';
import {
  ACTIVE_OUTGOING_MESSAGE_TYPES,
  KNOWN_PULSE_MESSAGE_TYPES,
  resolveKnownPulseMessageType,
} from './messageTypeConstants';
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
  getAttachmentBaseDisplayText,
  buildAttachmentMessageCardPresentation,
} from './attachmentPresentation';
import {
  getServiceTransportFallbackBannerState,
} from './config';
import {
  createAttachmentActionRunner,
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
        protocol: ENCRYPTED_MESSAGE_PROTOCOL,
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
    expect(pending.protocol).toBe(ENCRYPTED_MESSAGE_PROTOCOL);
    expect(pending.deliveryState).toBe('sending');
    expect(pending.pending).toBe(true);
    expect(pending.failed).toBe(false);
  });

  test('buildPendingMessage can reflect plaintext socket fallback protocol', () => {
    const pending = buildPendingMessage({
      text: 'Hallo',
      conversationId: 'conv-1',
      userId: 'user-1',
      protocol: PLAINTEXT_MESSAGE_PROTOCOL,
    });

    expect(pending.protocol).toBe(PLAINTEXT_MESSAGE_PROTOCOL);
    expect(pending.deliveryState).toBe('sending');
  });

  test('buildPendingMessage limits outgoing pending types to the active Pulse scope', () => {
    const pending = buildPendingMessage({
      text: 'Bijlage: foto.png',
      conversationId: 'conv-1',
      userId: 'user-1',
      type: 'attachment',
      sharedContact: { name: 'Habiba' },
    });

    expect(pending.type).toBe('text');
    expect(pending.messageType).toBe('text');
    expect(pending.sharedContact).toBeNull();
    expect(pending.attachment).toBeNull();
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

  test('buildConversationPreviewPresentation falls back to encrypted placeholder', () => {
    expect(buildConversationPreviewPresentation({ ciphertextAvailable: true, decryptedLocally: false })).toMatchObject({
      previewText: 'Versleuteld bericht',
      attachmentSummary: null,
    });
  });

  test('buildConversationPreviewPresentation centralizes deleted message copy', () => {
    expect(buildConversationPreviewPresentation({ deleted: true })).toMatchObject({
      previewText: getDeletedMessageDisplayText(),
      attachmentSummary: null,
    });
  });

  test('buildConversationPreviewPresentation includes encrypted storage signal for attachment messages', () => {
    expect(buildConversationPreviewPresentation({
      type: 'attachment',
      attachment: {
        name: 'foto.png',
        transfer: 'remote',
        contentEncoding: 'mock-e2ee-envelope-v1',
      },
    })).toMatchObject({
      previewText: 'Bijlage: foto.png · versleuteld',
      attachmentSummary: {
        previewText: 'Bijlage: foto.png · versleuteld',
      },
    });
  });

  test('attachment base display text stays centralized across preview flows', () => {
    expect(getAttachmentBaseDisplayText({ name: 'foto.png' })).toBe('Bijlage: foto.png');
    expect(getMessageDisplayText({
      type: 'attachment',
      attachment: { name: 'foto.png' },
    })).toBe(getAttachmentBaseDisplayText({ name: 'foto.png' }));
  });

  test('attachment display name stays centralized across attachment helpers', () => {
    expect(getAttachmentDisplayName({ name: ' rapport.pdf ' })).toBe('rapport.pdf');
    expect(getAttachmentDisplayName()).toBe('Bestand');
    expect(getAttachmentBaseDisplayText()).toBe('Bijlage: Bestand');
  });

  test('buildConversationPreviewPresentation prefers attachment summary fields over stale lastMessage text', () => {
    expect(buildConversationPreviewPresentation({
      lastMessage: 'Bijlage gedeeld',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentOriginalMimeType: 'image/png',
    }).previewText).toBe('Bijlage: Bestand · versleuteld');

    expect(buildConversationPreviewPresentation({
      lastMessage: 'Bijlage: rapport.pdf',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: '',
      lastAttachmentOriginalMimeType: 'application/pdf',
    }).previewText).toBe('Bijlage: rapport.pdf · opslaglink');
  });

  test('normalizeConversationSummaryRecord centralizes attachment summary field normalization', () => {
    expect(normalizeConversationSummaryRecord({
      id: 'conv-1',
      lastMessage: 'Bijlage gedeeld',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentOriginalMimeType: 'image/png',
    })).toMatchObject({
      id: 'conv-1',
      lastMessage: 'Bijlage gedeeld',
      lastMessageType: 'attachment',
      lastAttachmentName: 'Bestand',
      lastAttachmentTransfer: 'remote',
      lastAttachmentEncoding: 'mock-e2ee-envelope-v1',
      lastAttachmentOriginalMimeType: 'image/png',
    });
  });

  test('normalizeConversationSummaryRecord uses lastMessageAt as the visible timestamp fallback', () => {
    expect(normalizeConversationSummaryRecord({
      id: 'conv-1',
      lastMessage: 'Hallo',
      lastMessageAt: '2026-04-24T09:02:00.000Z',
    })).toMatchObject({
      id: 'conv-1',
      lastMessage: 'Hallo',
      lastMessageAt: '2026-04-24T09:02:00.000Z',
      updatedAt: '2026-04-24T09:02:00.000Z',
    });
  });

  test('contact messages keep their shared-contact preview', () => {
    expect(buildConversationPreviewPresentation({
      type: 'contact',
      sharedContact: { name: 'Habiba' },
    })).toMatchObject({
      previewText: 'Contactpersoon: Habiba',
      attachmentSummary: null,
    });
  });

  test('shared contact display text stays centralized across the active message flow', () => {
    expect(getSharedContactDisplayText({ name: 'Habiba' })).toBe('Contactpersoon: Habiba');
    expect(getSharedContactFallbackDisplayText()).toBe('Contactpersoon gedeeld');
    expect(getMessageDisplayText({
      type: 'contact',
      text: 'Afwijkende tekst',
      sharedContact: { name: 'Habiba' },
    })).toBe('Contactpersoon: Habiba');
  });

  test('encrypted placeholder display text stays centralized across the active message flow', () => {
    expect(getEncryptedMessageDisplayText()).toBe('Versleuteld bericht');
    expect(getMessageDisplayText({ ciphertextAvailable: true, decryptedLocally: false })).toBe(
      getEncryptedMessageDisplayText()
    );
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

  test('normalizeIncomingMessage normalizes unsupported and conflicting message types', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-weird-1',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        type: 'sticker',
        messageType: 'attachment',
        text: 'Hallo',
        attachment: {
          name: 'foto.png',
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,abcd',
        },
      },
      'user-1'
    );

    expect(normalized.type).toBe('text');
    expect(normalized.messageType).toBe('text');
    expect(normalized.attachment).toBeNull();
  });

  test('normalizeIncomingMessage drops structured payloads that do not match the message type', () => {
    const normalized = normalizeIncomingMessage(
      {
        id: 'msg-text-1',
        conversationId: 'conv-1',
        senderUserId: 'user-2',
        type: 'text',
        messageType: 'text',
        text: 'Hallo',
        sharedContact: { uid: 'user-3', name: 'Habiba' },
        attachment: {
          name: 'document.pdf',
          transfer: 'remote',
        },
      },
      'user-1'
    );

    expect(normalized.sharedContact).toBeNull();
    expect(normalized.attachment).toBeNull();
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

  test('message reactions keep one current-user emoji while preserving other users', () => {
    expect(normalizeSingleUserReaction({
      '😮': ['me', 'you'],
      '😢': ['me'],
      '😂': ['other'],
    }, 'me')).toEqual({
      '😮': ['you'],
      '😢': ['me'],
      '😂': ['other'],
    });

    expect(toggleSingleUserReaction({
      '😮': ['me', 'you'],
      '😢': ['me'],
    }, '😂', 'me')).toEqual({
      '😮': ['you'],
      '😂': ['me'],
    });
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
    expect(isEncryptedProtocol(ENCRYPTED_MESSAGE_PROTOCOL)).toBe(true);
    expect(isEncryptedProtocol(PLAINTEXT_MESSAGE_PROTOCOL)).toBe(false);
  });

  test('encrypted messages cannot be edited or plaintext-updated', () => {
    const message = { protocol: ENCRYPTED_MESSAGE_PROTOCOL };

    expect(canEditMessage(message)).toBe(false);
    expect(canApplyPlaintextEditUpdate(message)).toBe(false);
  });

  test('legacy messages can still be edited', () => {
    const message = { protocol: PLAINTEXT_MESSAGE_PROTOCOL };

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

  test('buildConversationPreviewPresentation derives preview and badge state for attachment summaries', () => {
    expect(buildConversationPreviewPresentation({
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
      attachmentSummary: expect.any(Object),
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

  test('applyCallConversationSummaryToList updates call preview and call metadata centrally', () => {
    expect(applyCallConversationSummaryToList([
      {
        id: 'conv-1',
        updatedAt: '2026-01-01T10:00:00.000Z',
        lastMessage: 'Oud',
        lastAttachmentName: 'rapport.pdf',
        lastAttachmentTransfer: 'remote',
      },
      { id: 'conv-2', updatedAt: '2026-01-01T09:00:00.000Z', lastMessage: 'Ander' },
    ], 'conv-2', {
      type: 'call',
      senderId: 'user-2',
      direction: 'completed',
      isVideo: true,
      createdAt: '2026-01-01T11:00:00.000Z',
    }, 'user-1')).toEqual([
      {
        id: 'conv-2',
        updatedAt: '2026-01-01T11:00:00.000Z',
        lastMessage: 'Video-oproep',
        lastMessageType: 'call',
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
        lastCallDirection: 'completed',
        lastCallSenderId: 'user-2',
        lastCallIsVideo: true,
      },
      {
        id: 'conv-1',
        updatedAt: '2026-01-01T10:00:00.000Z',
        lastMessage: 'Oud',
        lastAttachmentName: 'rapport.pdf',
        lastAttachmentTransfer: 'remote',
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

  test('createAttachmentActionRunner centralizes runner setup for message attachments', async () => {
    const setAttachmentBusy = jest.fn();
    const setResolvedAttachment = jest.fn();
    const setResolvedAttachmentAccess = jest.fn();
    const setAttachmentActionError = jest.fn();

    const runAttachmentAction = createAttachmentActionRunner(
      {
        name: 'hello.txt',
        downloadUrl: 'https://cdn.example.com/hello.txt',
        transfer: 'remote',
      },
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

    expect(typeof runAttachmentAction).toBe('function');

    const result = await runAttachmentAction('open');

    expect(result.succeeded).toBe(true);
    expect(setAttachmentBusy).not.toHaveBeenCalled();
    expect(setResolvedAttachment).toHaveBeenCalled();
    expect(setResolvedAttachmentAccess).toHaveBeenCalled();
    expect(setAttachmentActionError).toHaveBeenCalledWith('');
  });

  test('createAttachmentActionRunner centralizes attachment action failure copy', async () => {
    const setAttachmentBusy = jest.fn();
    const setResolvedAttachment = jest.fn();
    const setResolvedAttachmentAccess = jest.fn();
    const setAttachmentActionError = jest.fn();

    const runAttachmentAction = createAttachmentActionRunner(
      {
        name: 'hello.txt',
        downloadUrl: 'https://cdn.example.com/hello.txt',
        transfer: 'remote',
      },
      null,
      {
        setAttachmentBusy,
        setResolvedAttachment,
        setResolvedAttachmentAccess,
        setAttachmentActionError,
        resolveAttachment: async () => {
          throw new Error('');
        },
        opener: jest.fn(),
      }
    );

    const result = await runAttachmentAction('download');

    expect(result.succeeded).toBe(false);
    expect(setResolvedAttachment).not.toHaveBeenCalled();
    expect(setResolvedAttachmentAccess).not.toHaveBeenCalled();
    expect(setAttachmentActionError).toHaveBeenCalledWith('Bijlage downloaden mislukt');
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
    expect(ACTIVE_OUTGOING_MESSAGE_TYPES).toEqual(['text', 'contact']);
    expect(KNOWN_PULSE_MESSAGE_TYPES).toEqual(['text', 'contact', 'attachment', 'call', 'system']);
    expect(resolveKnownPulseMessageType('call')).toBe('call');
    expect(resolveKnownPulseMessageType('sticker')).toBe('text');
    expect(isSupportedOutgoingMessageType('text')).toBe(true);
    expect(isSupportedOutgoingMessageType('contact')).toBe(true);
    expect(isSupportedOutgoingMessageType('attachment')).toBe(false);
    expect(resolveSupportedOutgoingMessageType('contact')).toBe('contact');
    expect(resolveSupportedOutgoingMessageType('attachment')).toBe('text');
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

  test('buildSocketMessagePayload centralizes the active socket fallback message shape', () => {
    expect(buildSocketMessagePayload({
      conversationId: 'conv-1',
      senderId: 'user-1',
      senderName: 'Yushua',
      senderDeviceId: 'device-1',
      plaintext: 'Hallo',
      createdAt: '2026-04-08T10:00:00.000Z',
      mentions: ['user-2'],
    })).toMatchObject({
      convId: 'conv-1',
      senderId: 'user-1',
      senderName: 'Yushua',
      senderDeviceId: 'device-1',
      text: 'Hallo',
      protocol: PLAINTEXT_MESSAGE_PROTOCOL,
      type: 'text',
      messageType: 'text',
      mentions: ['user-2'],
    });

    expect(buildSocketMessagePayload({
      conversationId: 'conv-1',
      senderId: 'user-1',
      senderName: 'Yushua',
      plaintext: 'Contactpersoon: Habiba',
      messageType: 'contact',
      sharedContact: { name: 'Habiba' },
    })).toMatchObject({
      type: 'contact',
      messageType: 'contact',
      sharedContact: { name: 'Habiba' },
    });

    expect(buildSocketMessagePayload({
      conversationId: 'conv-1',
      senderId: 'user-1',
      senderName: 'Yushua',
      plaintext: 'Bijlage: foto.png',
      messageType: 'attachment',
    })).toMatchObject({
      type: 'text',
      messageType: 'text',
      text: 'Bijlage: foto.png',
    });
  });

  test('buildServiceMessageResult centralizes the active service result shape', () => {
    expect(buildServiceMessageResult({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      senderDeviceId: 'device-1',
      plaintext: 'Hallo',
      createdAt: '2026-04-08T10:00:00.000Z',
      replyToMessageId: 'msg-parent-1',
    })).toMatchObject({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      senderUserId: 'user-1',
      senderDeviceId: 'device-1',
      text: 'Hallo',
      protocol: ENCRYPTED_MESSAGE_PROTOCOL,
      deliveryState: 'sent',
      replyToMessageId: 'msg-parent-1',
      type: 'text',
      messageType: 'text',
    });

    expect(buildServiceMessageResult({
      messageId: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'user-1',
      plaintext: 'Contactpersoon: Habiba',
      messageType: 'contact',
      sharedContact: { name: 'Habiba' },
    })).toMatchObject({
      type: 'contact',
      messageType: 'contact',
      sharedContact: { name: 'Habiba' },
    });

    expect(buildServiceMessageResult({
      messageId: 'msg-3',
      conversationId: 'conv-1',
      senderId: 'user-1',
      plaintext: 'Bijlage: foto.png',
      messageType: 'attachment',
    })).toMatchObject({
      type: 'text',
      messageType: 'text',
      text: 'Bijlage: foto.png',
    });
  });
});
