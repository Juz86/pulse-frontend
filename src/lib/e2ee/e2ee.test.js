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
  buildRemoteAttachmentUploadPayload,
  createAttachmentStorageProvider,
  createDefaultAttachmentStorageProviderRegistry,
  createFutureDraftAttachmentStorageProvider,
  createInlineAttachmentStorageProvider,
  createRemoteMockAttachmentStorageProvider,
  buildFutureRemoteAttachmentDraftPayload,
  buildMockRemoteAttachmentPayload,
  prepareAttachmentForSend,
} from './attachmentUploadAdapter';
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
  buildAttachmentRenderState,
  buildAttachmentInteractionState,
  getAttachmentActionPresentation,
  getAttachmentActionButtonsPresentation,
  getAttachmentAccessVerificationPresentation,
  getAttachmentDetailLines,
  getAttachmentCardPresentation,
  getAttachmentContractPresentation,
  getAttachmentInteractionPresentation,
  getAttachmentPreviewText,
  getAttachmentStrategyPresentation,
} from './attachmentPresentation';
import {
  getAttachmentRuntimeState,
  getAttachmentRuntimePresentation,
  getAttachmentSendRuntimeConfig,
  getAttachmentStrategyComposerHintState,
  getFutureAttachmentStrategyBannerState,
  getFutureAttachmentStrategyBannerCopy,
  getServiceTransportFallbackBannerState,
  getAttachmentStrategyRuntimeCopy,
  getAttachmentStrategyRuntimeState,
  isAttachmentStrategySupportedByBackend,
  normalizeE2EEBackendCapabilities,
  resolveEffectiveAttachmentStrategy,
} from './config';
import {
  applyAttachmentActionResultState,
  assertAttachmentBinaryAccessSupported,
  assertAttachmentMetadataIntegrity,
  buildAttachmentAccessVerification,
  buildAttachmentActionErrorState,
  buildAttachmentActionSuccessState,
  createAttachmentActionRunner,
  createAttachmentActionCallbacks,
  createAttachmentAccessProvider,
  createDefaultAttachmentAccessProviderRegistry,
  createDirectAttachmentAccessProvider,
  createFutureDraftAttachmentAccessProvider,
  createRemoteAttachmentAccessProvider,
  buildResolvedAttachmentAccessContract,
  buildAttachmentMetadataUrl,
  clearAttachmentMetadataCache,
  buildPreparedAttachmentActionTarget,
  decryptAttachmentBlob,
  executePreparedAttachmentAction,
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
  getInitialAttachmentActionState,
  resolveAttachmentForBinaryAction,
  resolveExpectedAttachmentSha256,
  resolveAttachmentForAccess,
  runAttachmentActionFlow,
  runAttachmentBinaryAction,
  runAttachmentBinaryActionWithState,
  triggerAttachmentDownload,
} from './attachmentAccessAdapter';
import {
  ATTACHMENT_ACCESS_PROVIDER_DIRECT,
  ATTACHMENT_ACCESS_PROVIDER_REMOTE,
  ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
  ATTACHMENT_STORAGE_PROVIDER_INLINE,
  ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK,
  ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
  buildAttachmentAccessProviderDescriptor,
  buildAttachmentStorageProviderDescriptor,
  resolveAttachmentAccessProviderKind,
  resolveAttachmentStorageProviderKind,
} from './attachmentProviderKinds';
import {
  createAttachmentAccessProviderRegistry,
  createAttachmentStorageProviderRegistry,
  getAttachmentProviderRuntimeState,
  resolveAttachmentAccessProvider,
  resolveAttachmentAccessProviderEntry,
  resolveAttachmentStorageProvider,
  resolveAttachmentStorageProviderEntry,
} from './attachmentProviders';
import {
  createDefaultAttachmentProviderRegistries,
  getDefaultAttachmentProviderRuntimeState,
} from './attachmentDefaultProviders';
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

describe('e2ee backend capability helpers', () => {
  test('normalizeE2EEBackendCapabilities extracts attachment strategy support from config payloads', () => {
    expect(normalizeE2EEBackendCapabilities({
      e2ee: {
        attachmentTransport: 'remote_mock',
        attachmentStrategies: ['mock_media_v1', 'pulse_media_v1'],
        defaultAttachmentStrategy: 'mock_media_v1',
        draftAttachmentStrategy: 'pulse_media_v1',
      },
    })).toEqual({
      attachmentTransport: 'remote_mock',
      attachmentStrategies: ['mock_media_v1', 'pulse_media_v1'],
      defaultAttachmentStrategy: 'mock_media_v1',
      draftAttachmentStrategy: 'pulse_media_v1',
    });
  });

  test('isAttachmentStrategySupportedByBackend checks advertised backend strategy support', () => {
    expect(isAttachmentStrategySupportedByBackend({
      e2ee: {
        attachmentStrategies: ['mock_media_v1', 'pulse_media_v1'],
      },
    }, 'pulse_media_v1')).toBe(true);

    expect(isAttachmentStrategySupportedByBackend({
      e2ee: {
        attachmentStrategies: ['mock_media_v1'],
      },
    }, 'pulse_media_v1')).toBe(false);
  });

  test('resolveEffectiveAttachmentStrategy falls back when pulse_media_v1 is not advertised', () => {
    expect(resolveEffectiveAttachmentStrategy({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
      },
    })).toBe('mock_media_v1');
  });

  test('resolveEffectiveAttachmentStrategy keeps pulse_media_v1 when backend support is advertised', () => {
    expect(resolveEffectiveAttachmentStrategy({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1', 'pulse_media_v1'],
      },
    })).toBe('pulse_media_v1');
  });

  test('resolveEffectiveAttachmentStrategy prefers the backend default strategy when the preferred one is unsupported', () => {
    expect(resolveEffectiveAttachmentStrategy({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1', 'external_contract'],
        defaultAttachmentStrategy: 'external_contract',
      },
    })).toBe('external_contract');
  });

  test('resolveEffectiveAttachmentStrategy falls back to mock_media_v1 when backend default is unsupported too', () => {
    expect(resolveEffectiveAttachmentStrategy({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
        defaultAttachmentStrategy: 'external_contract',
      },
    })).toBe('mock_media_v1');
  });

  test('getAttachmentStrategyRuntimeState exposes fallback status and effective strategy', () => {
    expect(getAttachmentStrategyRuntimeState({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1', 'external_contract'],
        defaultAttachmentStrategy: 'external_contract',
      },
    })).toMatchObject({
      preferredStrategy: 'pulse_media_v1',
      effectiveStrategy: 'external_contract',
      fallbackStrategy: 'external_contract',
      fallbackActive: true,
      preferredStrategySupported: false,
    });
  });

  test('getAttachmentRuntimeState combines strategy fallback with default provider runtime', () => {
    expect(getAttachmentRuntimeState({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
        defaultAttachmentStrategy: 'mock_media_v1',
      },
      attachmentTransport: 'remote_mock',
      needsRemoteFetch: true,
    })).toMatchObject({
      preferredStrategy: 'pulse_media_v1',
      effectiveStrategy: 'mock_media_v1',
      fallbackActive: true,
      providerRuntime: {
        storageProviderKind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK,
        accessProviderKind: ATTACHMENT_ACCESS_PROVIDER_REMOTE,
        usesRemoteStorage: true,
        usesRemoteFetch: true,
        isFutureDraft: false,
        supportsBinaryAccess: true,
      },
    });
  });

  test('getAttachmentRuntimePresentation exposes stable provider-facing labels', () => {
    expect(getAttachmentRuntimePresentation({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
        defaultAttachmentStrategy: 'mock_media_v1',
      },
      attachmentTransport: 'remote_mock',
      needsRemoteFetch: true,
    })).toMatchObject({
      strategyLabel: 'mock-profiel (mock_media_v1)',
      storageProviderLabel: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK,
      accessProviderLabel: ATTACHMENT_ACCESS_PROVIDER_REMOTE,
      providerModeLabel: 'remote',
      binaryAccessLabel: 'binary-ready',
    });
  });

  test('getAttachmentSendRuntimeConfig derives strategy and transport from attachment runtime', () => {
    expect(getAttachmentSendRuntimeConfig({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
        defaultAttachmentStrategy: 'mock_media_v1',
      },
      attachmentTransport: 'remote_mock',
    })).toMatchObject({
      effectiveStrategy: 'mock_media_v1',
      transportMode: 'remote_mock',
      storageProviderKind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK,
      usesRemoteStorage: true,
    });
  });

  test('getAttachmentStrategyDisplayName derives human-readable strategy labels', () => {
    expect(getAttachmentStrategyDisplayName('mock_media_v1')).toBe('mock-profiel (mock_media_v1)');
    expect(getAttachmentStrategyDisplayName('pulse_media_v1')).toBe('future-draft (pulse_media_v1)');
    expect(getAttachmentStrategyDisplayName('external_contract')).toBe('external_contract');
  });

  test('getAttachmentStrategyRuntimeCopy describes fallback selection consistently', () => {
    expect(getAttachmentStrategyRuntimeCopy({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
      },
      effectiveStrategyOverride: 'mock_media_v1',
    })).toEqual({
      tone: 'fallback',
      text: 'Bijlagen gebruiken nu de remote mock-opslagtest met fallbackprofiel mock-profiel (mock_media_v1). Backendondersteuning voor future-draft (pulse_media_v1) ontbreekt nog.',
    });
  });

  test('getAttachmentStrategyComposerHintState derives visibility and runtime copy together', () => {
    expect(getAttachmentStrategyComposerHintState({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
      },
      effectiveStrategyOverride: 'mock_media_v1',
      attachmentTransport: 'remote_mock',
      paused: false,
      attachmentStatus: '',
    })).toEqual({
      visible: true,
      tone: 'fallback',
      text: 'Bijlagen gebruiken nu de remote mock-opslagtest met fallbackprofiel mock-profiel (mock_media_v1). Backendondersteuning voor future-draft (pulse_media_v1) ontbreekt nog.',
    });

    expect(getAttachmentStrategyComposerHintState({
      attachmentTransport: 'remote_mock',
      paused: true,
      attachmentStatus: '',
    }).visible).toBe(false);

    expect(getAttachmentStrategyComposerHintState({
      attachmentTransport: 'remote_mock',
      paused: false,
      attachmentStatus: 'Bijlage voorbereiden…',
    }).visible).toBe(false);
  });

  test('getFutureAttachmentStrategyBannerCopy describes supported future media banners consistently', () => {
    expect(getFutureAttachmentStrategyBannerCopy({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1', 'pulse_media_v1'],
      },
      effectiveStrategyOverride: 'pulse_media_v1',
    })).toEqual({
      tone: 'future',
      text: 'Pulse test nu het toekomstige attachment-profiel future-draft (pulse_media_v1) via de remote mock-opslagflow.',
    });
  });

  test('getFutureAttachmentStrategyBannerState derives visibility and copy together', () => {
    expect(getFutureAttachmentStrategyBannerState({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1', 'pulse_media_v1'],
      },
      effectiveStrategyOverride: 'pulse_media_v1',
      showFutureMediaBanner: true,
      attachmentTransport: 'remote_mock',
    })).toEqual({
      visible: true,
      tone: 'future',
      text: 'Pulse test nu het toekomstige attachment-profiel future-draft (pulse_media_v1) via de remote mock-opslagflow.',
    });

    expect(getFutureAttachmentStrategyBannerState({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
      },
      effectiveStrategyOverride: 'mock_media_v1',
      showFutureMediaBanner: false,
      attachmentTransport: 'remote_mock',
    })).toEqual({
      visible: false,
      tone: 'fallback',
      text: 'Het attachment-profiel future-draft (pulse_media_v1) staat lokaal aan, maar deze backend adverteert die draftondersteuning nog niet via /configz. Pulse valt daarom nu terug op mock-profiel (mock_media_v1).',
    });
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

  test('getFutureAttachmentStrategyBannerCopy describes fallback future media banners consistently', () => {
    expect(getFutureAttachmentStrategyBannerCopy({
      preferredStrategy: 'pulse_media_v1',
      capabilities: {
        attachmentStrategies: ['mock_media_v1'],
      },
      effectiveStrategyOverride: 'mock_media_v1',
    })).toEqual({
      tone: 'fallback',
      text: 'Het attachment-profiel future-draft (pulse_media_v1) staat lokaal aan, maar deze backend adverteert die draftondersteuning nog niet via /configz. Pulse valt daarom nu terug op mock-profiel (mock_media_v1).',
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

  test('buildFutureRemoteAttachmentDraftPayload creates a pulse_media_v1 storage draft', async () => {
    const attachment = await buildFutureRemoteAttachmentDraftPayload({
      name: 'future-photo.png',
      url: 'data:image/png;base64,abc',
      mimeType: 'image/png',
      size: 1234,
    }, {
      conversationId: 'conv-1',
      userId: 'user-1',
    });

    expect(attachment.transfer).toBe('remote');
    expect(attachment.url).toBe('');
    expect(attachment.downloadUrl).toBe('');
    expect(attachment.thumbnailUrl).toBe('data:image/png;base64,abc');
    expect(attachment.storageKey).toContain('future-e2ee/conv-1/user-1/');
    expect(attachment.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
    expect(attachment.contentEncoding).toBe(ATTACHMENT_FUTURE_ENVELOPE_ALG);
    expect(attachment.envelopeKind).toBe(ATTACHMENT_FUTURE_ENVELOPE_KIND);
    expect(attachment.expectedPayloadSha256).toMatch(/^[a-f0-9]{64}$|^fallback-[a-f0-9]{8}$/);
    expect(attachment.encryption).toEqual({
      alg: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      keyId: '',
      iv: '',
      sha256: expect.stringMatching(/^[a-f0-9]{64}$|^fallback-[a-f0-9]{8}$/),
      mediaKeyId: '',
      keyWrapAlg: ATTACHMENT_FUTURE_KEY_WRAP_ALG,
      wrappedMediaKey: '',
      wrappedMediaKeyDigest: '',
      envelopeKind: ATTACHMENT_FUTURE_ENVELOPE_KIND,
      originalMimeType: 'image/png',
    });
  });

  test('buildRemoteAttachmentUploadPayload supports pulse_media_v1 upload contracts', async () => {
    const attachment = await buildRemoteAttachmentUploadPayload({
      name: 'future-upload.png',
      url: 'data:image/png;base64,abc',
      mimeType: 'image/png',
      size: 1234,
    }, {
      conversationId: 'conv-1',
      userId: 'user-1',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    });

    expect(attachment.transfer).toBe('remote');
    expect(attachment.url).toContain('data:application/pulse-e2ee-envelope+json;base64,');
    expect(attachment.downloadUrl).toContain('data:application/pulse-e2ee-envelope+json;base64,');
    expect(attachment.storageKey).toContain('future-e2ee/conv-1/user-1/');
    expect(attachment.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
    expect(attachment.contentEncoding).toBe(ATTACHMENT_FUTURE_ENVELOPE_ALG);
    expect(attachment.envelopeKind).toBe(ATTACHMENT_FUTURE_ENVELOPE_KIND);
    expect(attachment.encryption?.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
    expect(attachment.encryption?.keyWrapAlg).toBe(ATTACHMENT_FUTURE_KEY_WRAP_ALG);
  });

  test('createInlineAttachmentStorageProvider keeps inline attachments unchanged', async () => {
    const provider = createInlineAttachmentStorageProvider();
    const inlineAttachment = normalizeAttachmentPayload({
      name: 'inline.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
    });

    const preparedAttachment = await provider.prepareAttachment(inlineAttachment);
    const uploadedAttachment = await provider.uploadPreparedAttachment(preparedAttachment);

    expect(provider.kind).toBe('inline');
    expect(uploadedAttachment).toEqual(inlineAttachment);
  });

  test('createRemoteMockAttachmentStorageProvider prepares and uploads remote mock attachments', async () => {
    const uploadAttachment = jest.fn(async (attachment) => ({
      ...attachment,
      downloadUrl: 'https://cdn.example.com/attachment-1',
    }));
    const provider = createRemoteMockAttachmentStorageProvider({
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      uploadAttachment,
    });

    const preparedAttachment = await provider.prepareAttachment({
      name: 'future-upload.png',
      url: 'data:image/png;base64,abc',
      mimeType: 'image/png',
    }, {
      conversationId: 'conv-1',
      userId: 'user-1',
    });
    const uploadedAttachment = await provider.uploadPreparedAttachment(preparedAttachment, {
      conversationId: 'conv-1',
    });

    expect(provider.kind).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT);
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    expect(uploadedAttachment.transfer).toBe('remote');
    expect(uploadedAttachment.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
    expect(uploadedAttachment.downloadUrl).toBe('https://cdn.example.com/attachment-1');
  });

  test('createAttachmentStorageProvider resolves the correct provider for each transport mode', () => {
    expect(createAttachmentStorageProvider({ transportMode: 'inline' }).kind).toBe(ATTACHMENT_STORAGE_PROVIDER_INLINE);
    expect(createAttachmentStorageProvider({ transportMode: 'remote_mock' }).kind).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK);
    expect(createAttachmentStorageProvider({
      transportMode: 'remote_mock',
      attachmentStrategy: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    }).kind).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT);
  });

  test('createDefaultAttachmentStorageProviderRegistry exposes all built-in storage providers', () => {
    const registry = createDefaultAttachmentStorageProviderRegistry();

    expect(typeof registry[ATTACHMENT_STORAGE_PROVIDER_INLINE]).toBe('function');
    expect(typeof registry[ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK]).toBe('function');
    expect(typeof registry[ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT]).toBe('function');
  });

  test('createFutureDraftAttachmentStorageProvider exposes a dedicated future provider factory', async () => {
    const uploadAttachment = jest.fn(async (attachment) => attachment);
    const provider = createFutureDraftAttachmentStorageProvider({ uploadAttachment });
    const preparedAttachment = await provider.prepareAttachment({
      name: 'future-draft.pdf',
      url: 'data:application/pdf;base64,JVBERi0x',
      mimeType: 'application/pdf',
    }, {
      conversationId: 'conv-future',
      userId: 'user-future',
    });

    expect(provider.kind).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT);
    expect(preparedAttachment.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
  });

  test('buildAttachmentStorageProviderDescriptor exposes shared provider capabilities', () => {
    expect(buildAttachmentStorageProviderDescriptor(ATTACHMENT_STORAGE_PROVIDER_INLINE)).toEqual({
      kind: ATTACHMENT_STORAGE_PROVIDER_INLINE,
      strategyKey: '',
      transportMode: 'inline',
      usesRemoteStorage: false,
      isFutureDraft: false,
      supportsUpload: true,
    });

    expect(buildAttachmentStorageProviderDescriptor(
      ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
      ATTACHMENT_FUTURE_MEDIA_STRATEGY
    )).toEqual({
      kind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      transportMode: 'remote_mock',
      usesRemoteStorage: true,
      isFutureDraft: true,
      supportsUpload: true,
    });
  });

  test('resolveAttachmentStorageProviderKind centralizes transport-driven provider selection', () => {
    expect(resolveAttachmentStorageProviderKind({
      transportMode: 'inline',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    })).toBe(ATTACHMENT_STORAGE_PROVIDER_INLINE);

    expect(resolveAttachmentStorageProviderKind({
      transportMode: 'remote_mock',
      strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
    })).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK);

    expect(resolveAttachmentStorageProviderKind({
      transportMode: 'remote_mock',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    })).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT);
  });

  test('attachment storage provider registry resolves inline and remote providers centrally', () => {
    const createInlineProvider = jest.fn(() => ({ kind: ATTACHMENT_STORAGE_PROVIDER_INLINE }));
    const createRemoteMockProvider = jest.fn(({ strategyKey }) => ({
      kind: strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
        ? ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT
        : ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK,
    }));
    const createFutureDraftProvider = jest.fn(({ strategyKey }) => ({
      kind: strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
        ? ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT
        : ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK,
    }));
    const registry = createAttachmentStorageProviderRegistry({
      createInlineProvider,
      createRemoteMockProvider,
      createFutureDraftProvider,
    });

    expect(resolveAttachmentStorageProvider(registry, {
      transportMode: 'inline',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    }).kind).toBe(ATTACHMENT_STORAGE_PROVIDER_INLINE);

    expect(resolveAttachmentStorageProvider(registry, {
      transportMode: 'remote_mock',
      strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
    }).kind).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK);

    expect(resolveAttachmentStorageProvider(registry, {
      transportMode: 'remote_mock',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    }).kind).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT);

    expect(createInlineProvider).toHaveBeenCalledTimes(1);
    expect(createRemoteMockProvider).toHaveBeenCalledTimes(1);
    expect(createFutureDraftProvider).toHaveBeenCalledTimes(1);
  });

  test('attachment storage provider registry exposes a resolved entry with descriptor', () => {
    const registry = createAttachmentStorageProviderRegistry({
      createInlineProvider: () => ({ kind: ATTACHMENT_STORAGE_PROVIDER_INLINE }),
      createRemoteMockProvider: () => ({ kind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK }),
      createFutureDraftProvider: () => ({ kind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT }),
    });

    const entry = resolveAttachmentStorageProviderEntry(registry, {
      transportMode: 'remote_mock',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    });

    expect(entry.kind).toBe(ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT);
    expect(entry.descriptor).toEqual({
      kind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      transportMode: 'remote_mock',
      usesRemoteStorage: true,
      isFutureDraft: true,
      supportsUpload: true,
    });
    expect(typeof entry.factory).toBe('function');
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

  test('prepareAttachmentForSend supports pulse_media_v1 attachment strategy in remote_mock mode', async () => {
    const attachment = await prepareAttachmentForSend({
      attachment: {
        name: 'future-document.pdf',
        url: 'data:application/pdf;base64,abc',
        mimeType: 'application/pdf',
        size: 456,
      },
      conversationId: 'conv-2',
      userId: 'user-9',
      transportMode: 'remote_mock',
      attachmentStrategy: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      uploadAttachment: async (payload) => ({
        ...payload,
        downloadUrl: 'https://cdn.example.com/future-document.pdf',
      }),
    });

    expect(attachment.transfer).toBe('remote');
    expect(attachment.downloadUrl).toBe('https://cdn.example.com/future-document.pdf');
    expect(attachment.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
    expect(attachment.contentEncoding).toBe(ATTACHMENT_FUTURE_ENVELOPE_ALG);
    expect(attachment.encryption?.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
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

  test('createDirectAttachmentAccessProvider returns normalized local attachments', async () => {
    const provider = createDirectAttachmentAccessProvider();
    const attachment = await provider.resolveAttachment({
      name: 'inline.txt',
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
    });

    expect(provider.kind).toBe('direct');
    expect(attachment.name).toBe('inline.txt');
    await expect(provider.fetchBinaryBlob()).rejects.toThrow('Direct attachment provider heeft geen remote blob-download.');
  });

  test('createRemoteAttachmentAccessProvider resolves metadata and downloads binary blobs', async () => {
    const getIdToken = jest.fn().mockResolvedValue('token-123');
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: jest.fn(() => '') },
        json: async () => ({
          attachment: {
            name: 'remote.txt',
            downloadUrl: `${BACKEND_URL}/attachments/remote-1`,
            transfer: 'remote',
            mimeType: 'text/plain',
            encryption: {
              alg: 'mock-storage-envelope',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: jest.fn(() => '') },
        blob: async () => new Blob(['remote payload'], { type: 'text/plain' }),
      });
    const provider = createRemoteAttachmentAccessProvider({
      user: { getIdToken },
      fetchImpl,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    });
    const baseAttachment = {
      downloadUrl: `${BACKEND_URL}/attachments/remote-1`,
      transfer: 'remote',
      encryption: { alg: 'mock-storage-envelope' },
    };

    const resolvedAttachment = await provider.resolveAttachment(baseAttachment);
    const blob = await provider.fetchBinaryBlob(resolvedAttachment);

    expect(provider.kind).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT);
    expect(getIdToken).toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(resolvedAttachment.name).toBe('remote.txt');
    expect(await new Response(blob).text()).toBe('remote payload');
  });

  test('createAttachmentAccessProvider selects direct or remote providers from attachment access info', () => {
    expect(createAttachmentAccessProvider({
      url: 'data:text/plain;base64,SGVsbG8=',
      mimeType: 'text/plain',
    }).kind).toBe(ATTACHMENT_ACCESS_PROVIDER_DIRECT);

    expect(createAttachmentAccessProvider({
      downloadUrl: `${BACKEND_URL}/attachments/remote-2`,
      transfer: 'remote',
      encryption: { alg: 'mock-storage-envelope' },
    }).kind).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE);

    expect(createAttachmentAccessProvider({
      downloadUrl: `${BACKEND_URL}/attachments/future-2`,
      transfer: 'remote',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      contentEncoding: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      encryption: { alg: ATTACHMENT_FUTURE_ENVELOPE_ALG },
    }).kind).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT);
  });

  test('createDefaultAttachmentAccessProviderRegistry exposes all built-in access providers', () => {
    const registry = createDefaultAttachmentAccessProviderRegistry();

    expect(typeof registry[ATTACHMENT_ACCESS_PROVIDER_DIRECT]).toBe('function');
    expect(typeof registry[ATTACHMENT_ACCESS_PROVIDER_REMOTE]).toBe('function');
    expect(typeof registry[ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT]).toBe('function');
  });

  test('createFutureDraftAttachmentAccessProvider exposes a dedicated future access provider factory', () => {
    const provider = createFutureDraftAttachmentAccessProvider();

    expect(provider.kind).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT);
    expect(provider.strategyKey).toBe(ATTACHMENT_FUTURE_MEDIA_STRATEGY);
  });

  test('buildAttachmentAccessProviderDescriptor exposes shared access capabilities', () => {
    expect(buildAttachmentAccessProviderDescriptor(ATTACHMENT_ACCESS_PROVIDER_DIRECT)).toEqual({
      kind: ATTACHMENT_ACCESS_PROVIDER_DIRECT,
      strategyKey: '',
      usesRemoteFetch: false,
      isFutureDraft: false,
      supportsBinaryAccess: true,
    });

    expect(buildAttachmentAccessProviderDescriptor(
      ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
      ATTACHMENT_FUTURE_MEDIA_STRATEGY
    )).toEqual({
      kind: ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      usesRemoteFetch: true,
      isFutureDraft: true,
      supportsBinaryAccess: false,
    });
  });

  test('resolveAttachmentAccessProviderKind centralizes access-driven provider selection', () => {
    expect(resolveAttachmentAccessProviderKind({
      needsRemoteFetch: false,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    })).toBe(ATTACHMENT_ACCESS_PROVIDER_DIRECT);

    expect(resolveAttachmentAccessProviderKind({
      needsRemoteFetch: true,
      strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
    })).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE);

    expect(resolveAttachmentAccessProviderKind({
      needsRemoteFetch: true,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    })).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT);
  });

  test('attachment access provider registry resolves direct and remote providers centrally', () => {
    const createDirectProvider = jest.fn(() => ({ kind: ATTACHMENT_ACCESS_PROVIDER_DIRECT }));
    const createRemoteProvider = jest.fn(({ strategyKey }) => ({
      kind: strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
        ? ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT
        : ATTACHMENT_ACCESS_PROVIDER_REMOTE,
    }));
    const createFutureDraftProvider = jest.fn(({ strategyKey }) => ({
      kind: strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
        ? ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT
        : ATTACHMENT_ACCESS_PROVIDER_REMOTE,
    }));
    const registry = createAttachmentAccessProviderRegistry({
      createDirectProvider,
      createRemoteProvider,
      createFutureDraftProvider,
    });

    expect(resolveAttachmentAccessProvider(registry, {
      needsRemoteFetch: false,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    }).kind).toBe(ATTACHMENT_ACCESS_PROVIDER_DIRECT);

    expect(resolveAttachmentAccessProvider(registry, {
      needsRemoteFetch: true,
      strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
    }).kind).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE);

    expect(resolveAttachmentAccessProvider(registry, {
      needsRemoteFetch: true,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    }).kind).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT);

    expect(createDirectProvider).toHaveBeenCalledTimes(1);
    expect(createRemoteProvider).toHaveBeenCalledTimes(1);
    expect(createFutureDraftProvider).toHaveBeenCalledTimes(1);
  });

  test('attachment access provider registry exposes a resolved entry with descriptor', () => {
    const registry = createAttachmentAccessProviderRegistry({
      createDirectProvider: () => ({ kind: ATTACHMENT_ACCESS_PROVIDER_DIRECT }),
      createRemoteProvider: () => ({ kind: ATTACHMENT_ACCESS_PROVIDER_REMOTE }),
      createFutureDraftProvider: () => ({ kind: ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT }),
    });

    const entry = resolveAttachmentAccessProviderEntry(registry, {
      needsRemoteFetch: true,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    });

    expect(entry.kind).toBe(ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT);
    expect(entry.descriptor).toEqual({
      kind: ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      usesRemoteFetch: true,
      isFutureDraft: true,
      supportsBinaryAccess: false,
    });
    expect(typeof entry.factory).toBe('function');
  });

  test('getAttachmentProviderRuntimeState combines storage and access descriptors for future drafts', () => {
    const storageRegistry = createAttachmentStorageProviderRegistry({
      createInlineProvider: () => ({ kind: ATTACHMENT_STORAGE_PROVIDER_INLINE }),
      createRemoteMockProvider: () => ({ kind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK }),
      createFutureDraftProvider: () => ({ kind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT }),
    });
    const accessRegistry = createAttachmentAccessProviderRegistry({
      createDirectProvider: () => ({ kind: ATTACHMENT_ACCESS_PROVIDER_DIRECT }),
      createRemoteProvider: () => ({ kind: ATTACHMENT_ACCESS_PROVIDER_REMOTE }),
      createFutureDraftProvider: () => ({ kind: ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT }),
    });

    expect(getAttachmentProviderRuntimeState({
      storageRegistry,
      accessRegistry,
      transportMode: 'remote_mock',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      needsRemoteFetch: true,
    })).toEqual({
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      transportMode: 'remote_mock',
      needsRemoteFetch: true,
      storageProviderKind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
      accessProviderKind: ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
      storageDescriptor: {
        kind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
        strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
        transportMode: 'remote_mock',
        usesRemoteStorage: true,
        isFutureDraft: true,
        supportsUpload: true,
      },
      accessDescriptor: {
        kind: ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
        strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
        usesRemoteFetch: true,
        isFutureDraft: true,
        supportsBinaryAccess: false,
      },
      usesRemoteStorage: true,
      usesRemoteFetch: true,
      isFutureDraft: true,
      supportsBinaryAccess: false,
    });
  });

  test('createDefaultAttachmentProviderRegistries exposes built-in storage and access registries together', () => {
    const registries = createDefaultAttachmentProviderRegistries();

    expect(typeof registries.storageRegistry[ATTACHMENT_STORAGE_PROVIDER_INLINE]).toBe('function');
    expect(typeof registries.storageRegistry[ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK]).toBe('function');
    expect(typeof registries.storageRegistry[ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT]).toBe('function');
    expect(typeof registries.accessRegistry[ATTACHMENT_ACCESS_PROVIDER_DIRECT]).toBe('function');
    expect(typeof registries.accessRegistry[ATTACHMENT_ACCESS_PROVIDER_REMOTE]).toBe('function');
    expect(typeof registries.accessRegistry[ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT]).toBe('function');
  });

  test('getDefaultAttachmentProviderRuntimeState derives built-in future runtime state without manual registry wiring', () => {
    expect(getDefaultAttachmentProviderRuntimeState({
      transportMode: 'remote_mock',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      needsRemoteFetch: true,
    })).toMatchObject({
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      transportMode: 'remote_mock',
      needsRemoteFetch: true,
      storageProviderKind: ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
      accessProviderKind: ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
      usesRemoteStorage: true,
      usesRemoteFetch: true,
      isFutureDraft: true,
      supportsBinaryAccess: false,
    });
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

  test('resolveAttachmentForBinaryAction uses callback-driven remote refresh state', async () => {
    const onBusyChange = jest.fn();
    const onResolvedAttachment = jest.fn();
    const onErrorReset = jest.fn();
    const resolvedAttachment = await resolveAttachmentForBinaryAction({
      name: 'remote.txt',
      downloadUrl: 'https://cdn.example.com/remote.txt',
      transfer: 'remote',
      encryption: {
        strategyKey: ATTACHMENT_MOCK_MEDIA_STRATEGY,
      },
    }, null, {
      resolveAttachment: async (attachment) => ({
        ...attachment,
        expectedPayloadSha256: 'mock-sha256',
      }),
      onBusyChange,
      onResolvedAttachment,
      onErrorReset,
    });

    expect(resolvedAttachment.expectedPayloadSha256).toBe('mock-sha256');
    expect(onErrorReset).toHaveBeenCalledTimes(1);
    expect(onBusyChange).not.toHaveBeenCalled();
    expect(onResolvedAttachment).not.toHaveBeenCalled();
  });

  test('getInitialAttachmentActionState returns a clean local interaction state', () => {
    expect(getInitialAttachmentActionState()).toEqual({
      resolvedAttachment: null,
      resolvedAttachmentAccess: null,
      attachmentActionError: '',
      attachmentBusy: false,
    });
  });

  test('buildAttachmentActionSuccessState derives resolved attachment UI state', () => {
    expect(buildAttachmentActionSuccessState({
      attachment: { name: 'hello.txt' },
      unwrapContext: { unwrapKind: 'none' },
    })).toEqual({
      resolvedAttachment: { name: 'hello.txt' },
      resolvedAttachmentAccess: {
        attachment: { name: 'hello.txt' },
        unwrapContext: { unwrapKind: 'none' },
      },
      attachmentActionError: '',
    });
  });

  test('buildAttachmentActionErrorState derives stable open/download error copy', () => {
    expect(buildAttachmentActionErrorState(new Error('kapot'), 'open')).toEqual({
      attachmentActionError: 'kapot',
    });
    expect(buildAttachmentActionErrorState(null, 'download')).toEqual({
      attachmentActionError: 'Bijlage downloaden mislukt',
    });
  });

  test('createAttachmentActionCallbacks derives stable adapter callbacks from state setters', () => {
    const setAttachmentBusy = jest.fn();
    const setResolvedAttachment = jest.fn();
    const setAttachmentActionError = jest.fn();

    const callbacks = createAttachmentActionCallbacks({
      setAttachmentBusy,
      setResolvedAttachment,
      setAttachmentActionError,
    });

    callbacks.onBusyChange(true);
    callbacks.onResolvedAttachment({ name: 'foto.png' });
    callbacks.onErrorReset();

    expect(setAttachmentBusy).toHaveBeenCalledWith(true);
    expect(setResolvedAttachment).toHaveBeenCalledWith({ name: 'foto.png' });
    expect(setAttachmentActionError).toHaveBeenCalledWith('');
  });

  test('applyAttachmentActionResultState applies success and error payloads through state setters', () => {
    const setResolvedAttachment = jest.fn();
    const setResolvedAttachmentAccess = jest.fn();
    const setAttachmentActionError = jest.fn();

    applyAttachmentActionResultState({
      successState: {
        resolvedAttachment: { name: 'foto.png' },
        resolvedAttachmentAccess: { url: 'blob:abc' },
        attachmentActionError: '',
      },
    }, {
      setResolvedAttachment,
      setResolvedAttachmentAccess,
      setAttachmentActionError,
    });

    applyAttachmentActionResultState({
      errorState: {
        attachmentActionError: 'kapot',
      },
    }, {
      setResolvedAttachment,
      setResolvedAttachmentAccess,
      setAttachmentActionError,
    });

    expect(setResolvedAttachment).toHaveBeenCalledWith({ name: 'foto.png' });
    expect(setResolvedAttachmentAccess).toHaveBeenCalledWith({ url: 'blob:abc' });
    expect(setAttachmentActionError).toHaveBeenNthCalledWith(1, '');
    expect(setAttachmentActionError).toHaveBeenNthCalledWith(2, 'kapot');
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
      strategyKey: '',
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
      strategyKey: 'mock_media_v1',
      canDecryptEnvelope: true,
      canValidateWrappedMediaKey: true,
      integrityVerified: true,
      wrappedKeyVerified: true,
    });
  });

  test('buildAttachmentAccessVerification derives session-level access state', () => {
    expect(buildAttachmentAccessVerification({
      strategyKey: 'mock_media_v1',
      integrityVerified: true,
      wrappedKeyVerified: true,
    }, {
      unwrapKind: 'pulse_mock_media_key_unwrap',
    })).toEqual({
      strategyKey: 'mock_media_v1',
      integrityVerified: true,
      wrappedKeyVerified: true,
      unwrapKind: 'pulse_mock_media_key_unwrap',
    });
  });

  test('getAttachmentContractFromHeaders reads attachment contract headers', () => {
    expect(getAttachmentContractFromHeaders({
      get: jest.fn((name) => ({
        'X-Pulse-Expected-Sha256': 'sha-top',
        'X-Pulse-Encryption-Strategy': 'mock_media_v1',
        'X-Pulse-Content-Encoding': 'mock-e2ee-envelope-v1',
        'X-Pulse-Envelope-Kind': 'pulse_mock_media_envelope',
        'X-Pulse-Original-MimeType': 'image/png',
        'X-Pulse-Media-Key-Id': 'media-key-1',
        'X-Pulse-Key-Wrap-Alg': 'pulse_mock_media_key_wrap_v1',
        'X-Pulse-Wrapped-Media-Key-Digest': 'wrapped-digest-1',
      }[name] || '')),
    })).toEqual({
      expectedPayloadSha256: 'sha-top',
      strategyKey: 'mock_media_v1',
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
      strategyKey: 'external_contract',
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
      strategyKey: 'external_contract',
      canDecryptEnvelope: false,
      canValidateWrappedMediaKey: false,
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

  test('prepareAttachmentBinaryAccess rejects future media drafts before binary fetch', async () => {
    const fetchImpl = jest.fn();

    await expect(prepareAttachmentBinaryAccess({
      transfer: 'remote',
      downloadUrl: 'https://cdn.example.com/future.bin',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      contentEncoding: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      encryption: {
        alg: ATTACHMENT_FUTURE_ENVELOPE_ALG,
        strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      },
    }, {
      getIdToken: async () => 'token-1',
    }, {
      fetchImpl,
    })).rejects.toThrow('Decrypt voor pulse_media_v1 is nog niet beschikbaar.');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('buildPreparedAttachmentActionTarget converts object-url access into an actionable attachment target', () => {
    expect(buildPreparedAttachmentActionTarget({
      attachment: {
        name: 'proof.pdf',
        downloadUrl: '',
        url: '',
      },
      url: 'blob:prepared-1',
      isObjectUrl: true,
    })).toEqual({
      name: 'proof.pdf',
      downloadUrl: 'blob:prepared-1',
      url: '',
    });
  });

  test('executePreparedAttachmentAction opens object-url attachments and schedules cleanup', () => {
    const opener = jest.fn();
    const revoke = jest.fn();
    const scheduleCleanup = jest.fn((callback) => callback());

    const succeeded = executePreparedAttachmentAction({
      attachment: {
        name: 'proof.pdf',
        downloadUrl: '',
        url: '',
      },
      url: 'blob:prepared-2',
      isObjectUrl: true,
      revoke,
    }, {
      action: 'open',
      opener,
      scheduleCleanup,
    });

    expect(succeeded).toBe(true);
    expect(opener).toHaveBeenCalledWith('blob:prepared-2', '_blank', 'noopener,noreferrer');
    expect(scheduleCleanup).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  test('executePreparedAttachmentAction downloads object-url attachments and schedules cleanup', () => {
    const revoke = jest.fn();
    const click = jest.fn();
    const remove = jest.fn();
    const appendChild = jest.fn();
    const scheduleCleanup = jest.fn((callback) => callback());
    const doc = {
      createElement: jest.fn(() => ({
        click,
        remove,
      })),
      body: { appendChild },
    };

    const succeeded = executePreparedAttachmentAction({
      attachment: {
        name: 'proof.pdf',
        downloadUrl: '',
        url: '',
      },
      url: 'blob:prepared-3',
      isObjectUrl: true,
      revoke,
    }, {
      action: 'download',
      doc,
      scheduleCleanup,
    });

    expect(succeeded).toBe(true);
    expect(doc.createElement).toHaveBeenCalledWith('a');
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(scheduleCleanup).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  test('runAttachmentBinaryAction orchestrates prepare and execute for open actions', async () => {
    const opener = jest.fn();
    const scheduleCleanup = jest.fn((callback) => callback());
    const onBusyChange = jest.fn();
    const onResolvedAttachment = jest.fn();
    const onErrorReset = jest.fn();

    const { preparedAccess, succeeded } = await runAttachmentBinaryAction({
      name: 'hello.txt',
      downloadUrl: 'https://cdn.example.com/hello.txt',
      transfer: 'remote',
    }, null, {
      action: 'open',
      resolveAttachment: async (attachment) => ({
        ...attachment,
        expectedPayloadSha256: 'mock-sha256-binary',
      }),
      onBusyChange,
      onResolvedAttachment,
      onErrorReset,
      opener,
      scheduleCleanup,
    });

    expect(succeeded).toBe(true);
    expect(preparedAccess.url).toBe('https://cdn.example.com/hello.txt');
    expect(preparedAccess.isObjectUrl).toBe(false);
    expect(onErrorReset).toHaveBeenCalledTimes(1);
    expect(onBusyChange).not.toHaveBeenCalled();
    expect(onResolvedAttachment).not.toHaveBeenCalled();
    expect(opener).toHaveBeenCalledWith('https://cdn.example.com/hello.txt', '_blank', 'noopener,noreferrer');
    expect(scheduleCleanup).toHaveBeenCalledTimes(0);
  });

  test('runAttachmentBinaryActionWithState returns success state for successful actions', async () => {
    const result = await runAttachmentBinaryActionWithState({
      name: 'hello.txt',
      downloadUrl: 'https://cdn.example.com/hello.txt',
      transfer: 'remote',
    }, null, {
      action: 'open',
      resolveAttachment: async (attachment) => ({
        ...attachment,
        expectedPayloadSha256: 'mock-sha256-binary',
      }),
      opener: jest.fn(),
    });

    expect(result.succeeded).toBe(true);
    expect(result.error).toBeNull();
    expect(result.successState).toMatchObject({
      resolvedAttachment: {
        name: 'hello.txt',
        downloadUrl: 'https://cdn.example.com/hello.txt',
        transfer: 'remote',
        expectedPayloadSha256: 'mock-sha256-binary',
        accessVerification: {
          strategyKey: 'none',
          integrityVerified: true,
          wrappedKeyVerified: false,
          unwrapKind: 'none',
        },
      },
      resolvedAttachmentAccess: expect.objectContaining({
        isObjectUrl: false,
      }),
      attachmentActionError: '',
    });
    expect(result.errorState).toBeNull();
  });

  test('runAttachmentBinaryActionWithState returns error state for failed actions', async () => {
    const result = await runAttachmentBinaryActionWithState({
      name: 'future.png',
      transfer: 'remote',
      strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      contentEncoding: ATTACHMENT_FUTURE_ENVELOPE_ALG,
      encryption: { alg: ATTACHMENT_FUTURE_ENVELOPE_ALG },
    }, null, {
      action: 'download',
      resolveAttachment: async (attachment) => attachment,
    });

    expect(result.succeeded).toBe(false);
    expect(result.successState).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.errorState).toEqual({
      attachmentActionError: `Decrypt voor ${ATTACHMENT_FUTURE_MEDIA_STRATEGY} is nog niet beschikbaar.`,
    });
  });

  test('runAttachmentActionFlow executes action and applies attachment state setters', async () => {
    const setResolvedAttachment = jest.fn();
    const setResolvedAttachmentAccess = jest.fn();
    const setAttachmentActionError = jest.fn();
    const setAttachmentBusy = jest.fn();

    const result = await runAttachmentActionFlow({
      name: 'hello.txt',
      downloadUrl: 'https://cdn.example.com/hello.txt',
      transfer: 'remote',
    }, null, {
      action: 'open',
      resolveAttachment: async (attachment) => ({
        ...attachment,
        expectedPayloadSha256: 'mock-sha256-binary',
      }),
      onBusyChange: setAttachmentBusy,
      onResolvedAttachment: setResolvedAttachment,
      onErrorReset: () => setAttachmentActionError(''),
      setResolvedAttachment,
      setResolvedAttachmentAccess,
      setAttachmentActionError,
      opener: jest.fn(),
    });

    expect(result.succeeded).toBe(true);
    expect(setResolvedAttachment).toHaveBeenCalled();
    expect(setResolvedAttachmentAccess).toHaveBeenCalledWith(
      expect.objectContaining({ isObjectUrl: false })
    );
    expect(setAttachmentActionError).toHaveBeenCalledWith('');
    expect(setAttachmentBusy).not.toHaveBeenCalled();
  });

  test('createAttachmentActionRunner builds a reusable action dispatcher', async () => {
    const runner = createAttachmentActionRunner({
      name: 'hello.txt',
      downloadUrl: 'https://cdn.example.com/hello.txt',
      transfer: 'remote',
    }, null, {
      resolveAttachment: async (attachment) => ({
        ...attachment,
        expectedPayloadSha256: 'mock-sha256-binary',
      }),
      opener: jest.fn(),
    });

    const result = await runner('open');

    expect(result.succeeded).toBe(true);
    expect(result.successState).toMatchObject({
      resolvedAttachment: {
        name: 'hello.txt',
        expectedPayloadSha256: 'mock-sha256-binary',
      },
    });
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
      strategyKey: '',
      originalMimeType: 'image/png',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      accessVerification: {
        strategyKey: '',
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
      strategyKey: '',
      originalMimeType: 'image/png',
      contentEncoding: 'mock-e2ee-envelope-v1',
      envelopeKind: 'pulse_mock_media_envelope',
      expectedPayloadSha256: '',
      size: null,
      caption: '',
      encryption: null,
      accessVerification: {
        strategyKey: '',
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
        strategyKey: '',
        originalMimeType: 'image/png',
        contentEncoding: 'mock-e2ee-envelope-v1',
        envelopeKind: 'pulse_mock_media_envelope',
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

    expect(payload.messageType).toBe('attachment');
    expect(payload.plaintext).toBe('foto.png');
    expect(payload.attachment.originalMimeType).toBe('image/png');
    expect(payload.attachment.contentEncoding).toBe('mock-e2ee-envelope-v1');
    expect(payload.attachment.envelopeKind).toBe('pulse_mock_media_envelope');
    expect(payload.attachment.expectedPayloadSha256).toBe('');
    expect(payload.attachment.url).toBe('');
    expect(payload.attachment.accessVerification).toEqual({
      strategyKey: '',
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
