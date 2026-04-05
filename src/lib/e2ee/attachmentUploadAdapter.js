import { BACKEND_URL } from '../../services/socket';
import { E2EE_ATTACHMENT_STRATEGY, E2EE_ATTACHMENT_TRANSPORT } from './config';
import {
  buildAttachmentEncryptionMetadata,
  createMockEncryptedAttachmentEnvelope,
  resolveAttachmentEncryptionStrategy,
} from './attachmentCrypto';
import {
  ATTACHMENT_FUTURE_MEDIA_STRATEGY,
} from './attachmentStrategyConstants';
import {
  ATTACHMENT_STORAGE_PROVIDER_INLINE,
  buildAttachmentStorageProviderDescriptor,
  getAttachmentStorageProviderKind,
} from './attachmentProviderKinds';
import {
  createAttachmentStorageProviderRegistry,
  resolveAttachmentStorageProvider,
} from './attachmentProviders';
import {
  isImageAttachment,
  normalizeAttachmentPayload,
  validateAttachmentPayload,
} from './attachmentPayload';

function sanitizePathSegment(value, fallback) {
  const safe = String(value || fallback || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return safe || fallback;
}

export function createInlineAttachmentStorageProvider() {
  const descriptor = buildAttachmentStorageProviderDescriptor(ATTACHMENT_STORAGE_PROVIDER_INLINE);

  return {
    ...descriptor,
    async prepareAttachment(normalizedAttachment) {
      return normalizedAttachment;
    },
    async uploadPreparedAttachment(preparedAttachment) {
      return normalizeAttachmentPayload(preparedAttachment);
    },
  };
}

export function createRemoteMockAttachmentStorageProvider({
  strategyKey = E2EE_ATTACHMENT_STRATEGY,
  uploadAttachment = null,
  user = null,
  fetchImpl = fetch,
} = {}) {
  const descriptor = buildAttachmentStorageProviderDescriptor(
    getAttachmentStorageProviderKind(strategyKey),
    strategyKey
  );

  return {
    ...descriptor,
    async prepareAttachment(attachment, { conversationId, userId } = {}) {
      return buildRemoteAttachmentUploadPayload(attachment, {
        conversationId,
        userId,
        strategyKey,
      });
    },
    async uploadPreparedAttachment(preparedAttachment, { conversationId } = {}) {
      if (typeof uploadAttachment === 'function') {
        const uploadedAttachment = await uploadAttachment(preparedAttachment);
        return normalizeAttachmentPayload(uploadedAttachment);
      }

      if (!user) {
        throw new Error('Geen gebruiker beschikbaar voor attachment upload.');
      }

      const token = await user.getIdToken();
      const response = await fetchImpl(`${BACKEND_URL}/api/attachments/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          attachment: preparedAttachment,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.attachment) {
        throw new Error(data?.error || 'Bijlage uploaden mislukt');
      }

      return normalizeAttachmentPayload(data.attachment);
    },
  };
}

export function createFutureDraftAttachmentStorageProvider({
  uploadAttachment = null,
  user = null,
  fetchImpl = fetch,
} = {}) {
  return createRemoteMockAttachmentStorageProvider({
    strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
    uploadAttachment,
    user,
    fetchImpl,
  });
}

export function createAttachmentStorageProvider({
  transportMode = E2EE_ATTACHMENT_TRANSPORT,
  attachmentStrategy = E2EE_ATTACHMENT_STRATEGY,
  uploadAttachment = null,
  user = null,
  fetchImpl = fetch,
} = {}) {
  const registry = createAttachmentStorageProviderRegistry({
    createInlineProvider: createInlineAttachmentStorageProvider,
    createRemoteMockProvider: createRemoteMockAttachmentStorageProvider,
    createFutureDraftProvider: createFutureDraftAttachmentStorageProvider,
  });

  return resolveAttachmentStorageProvider(registry, {
    transportMode,
    strategyKey: attachmentStrategy,
    uploadAttachment,
    user,
    fetchImpl,
  });
}

export async function buildMockRemoteAttachmentPayload(attachment, { conversationId, userId } = {}) {
  const normalized = normalizeAttachmentPayload(attachment);
  if (!normalized) return null;
  const strategy = resolveAttachmentEncryptionStrategy(normalized.encryption || {});
  const encryptedEnvelope = await createMockEncryptedAttachmentEnvelope(normalized);

  const safeConversationId = sanitizePathSegment(conversationId, 'conversation');
  const safeUserId = sanitizePathSegment(userId, 'user');
  const safeName = sanitizePathSegment(normalized.name, 'bestand');
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    ...normalized,
    transfer: 'remote',
    url: encryptedEnvelope.dataUrl,
    downloadUrl: encryptedEnvelope.dataUrl,
    thumbnailUrl: normalized.thumbnailUrl || (isImageAttachment(normalized) ? normalized.url : ''),
    storageKey: normalized.storageKey || `mock-e2ee/${safeConversationId}/${safeUserId}/${uniqueSuffix}-${safeName}`,
    encryption: strategy.hasEncryption
      ? normalized.encryption
      : await buildAttachmentEncryptionMetadata(normalized, encryptedEnvelope.envelope),
  };
}

export async function buildRemoteAttachmentUploadPayload(
  attachment,
  {
    conversationId,
    userId,
    strategyKey = E2EE_ATTACHMENT_STRATEGY,
  } = {}
) {
  if (strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY) {
    const normalized = normalizeAttachmentPayload(attachment);
    if (!normalized) return null;
    const encryptedEnvelope = await createMockEncryptedAttachmentEnvelope(normalized);
    const safeConversationId = sanitizePathSegment(conversationId, 'conversation');
    const safeUserId = sanitizePathSegment(userId, 'user');
    const safeName = sanitizePathSegment(normalized.name, 'bestand');
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const encryption = await buildAttachmentEncryptionMetadata({
      ...normalized,
      encryption: {
        ...(normalized.encryption || {}),
        strategyKey: ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      },
    }, encryptedEnvelope.envelope);

    return {
      ...normalized,
      transfer: 'remote',
      url: encryptedEnvelope.dataUrl,
      downloadUrl: encryptedEnvelope.dataUrl,
      thumbnailUrl: normalized.thumbnailUrl || (isImageAttachment(normalized) ? normalized.url : ''),
      storageKey: normalized.storageKey || `future-e2ee/${safeConversationId}/${safeUserId}/${uniqueSuffix}-${safeName}`,
      strategyKey: encryption?.strategyKey || ATTACHMENT_FUTURE_MEDIA_STRATEGY,
      contentEncoding: encryption?.alg || normalized.contentEncoding,
      envelopeKind: encryption?.envelopeKind || normalized.envelopeKind,
      expectedPayloadSha256: encryption?.sha256 || normalized.expectedPayloadSha256,
      encryption,
    };
  }

  return buildMockRemoteAttachmentPayload(attachment, { conversationId, userId });
}

export async function buildFutureRemoteAttachmentDraftPayload(attachment, { conversationId, userId } = {}) {
  const normalized = normalizeAttachmentPayload(attachment);
  if (!normalized) return null;

  const safeConversationId = sanitizePathSegment(conversationId, 'conversation');
  const safeUserId = sanitizePathSegment(userId, 'user');
  const safeName = sanitizePathSegment(normalized.name, 'bestand');
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const encryptedEnvelope = await createMockEncryptedAttachmentEnvelope(normalized);
  const encryption = await buildAttachmentEncryptionMetadata({
    ...normalized,
    encryption: {
      ...(normalized.encryption || {}),
      strategyKey: 'pulse_media_v1',
    },
  }, encryptedEnvelope.envelope);

  return {
    ...normalized,
    url: '',
    downloadUrl: '',
    thumbnailUrl: normalized.thumbnailUrl || (isImageAttachment(normalized) ? normalized.url : ''),
    transfer: 'remote',
    storageKey: normalized.storageKey || `future-e2ee/${safeConversationId}/${safeUserId}/${uniqueSuffix}-${safeName}`,
    strategyKey: encryption?.strategyKey || 'pulse_media_v1',
    contentEncoding: encryption?.alg === 'pulse-media-envelope-v1' ? 'pulse-media-envelope-v1' : normalized.contentEncoding,
    envelopeKind: encryption?.envelopeKind || normalized.envelopeKind,
    expectedPayloadSha256: encryption?.sha256 || normalized.expectedPayloadSha256,
    encryption,
  };
}

export async function prepareAttachmentForSend({
  attachment,
  conversationId,
  user,
  userId,
  transportMode = E2EE_ATTACHMENT_TRANSPORT,
  attachmentStrategy = E2EE_ATTACHMENT_STRATEGY,
  uploadAttachment = null,
} = {}) {
  const normalized = normalizeAttachmentPayload(attachment);
  const validationError = validateAttachmentPayload(normalized);

  if (validationError) {
    throw new Error(validationError);
  }
  const storageProvider = createAttachmentStorageProvider({
    transportMode,
    attachmentStrategy,
    uploadAttachment,
    user,
  });
  const preparedAttachment = await storageProvider.prepareAttachment(normalized, {
    conversationId,
    userId,
  });

  return storageProvider.uploadPreparedAttachment(preparedAttachment, {
    conversationId,
    userId,
  });
}
