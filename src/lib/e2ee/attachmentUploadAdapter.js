import { BACKEND_URL } from '../../services/socket';
import { E2EE_ATTACHMENT_TRANSPORT } from './config';
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

export function buildMockRemoteAttachmentPayload(attachment, { conversationId, userId } = {}) {
  const normalized = normalizeAttachmentPayload(attachment);
  if (!normalized) return null;

  const safeConversationId = sanitizePathSegment(conversationId, 'conversation');
  const safeUserId = sanitizePathSegment(userId, 'user');
  const safeName = sanitizePathSegment(normalized.name, 'bestand');
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    ...normalized,
    transfer: 'remote',
    downloadUrl: normalized.downloadUrl || normalized.url,
    thumbnailUrl: normalized.thumbnailUrl || (isImageAttachment(normalized) ? normalized.url : ''),
    storageKey: normalized.storageKey || `mock-e2ee/${safeConversationId}/${safeUserId}/${uniqueSuffix}-${safeName}`,
    encryption: normalized.encryption || {
      alg: 'mock-e2ee-envelope',
      keyId: `mock-key-${safeUserId}`,
      iv: `mock-iv-${uniqueSuffix}`,
      sha256: `mock-sha256-${normalized.size || 0}`,
    },
  };
}

export async function prepareAttachmentForSend({
  attachment,
  conversationId,
  user,
  userId,
  transportMode = E2EE_ATTACHMENT_TRANSPORT,
  uploadAttachment = null,
} = {}) {
  const normalized = normalizeAttachmentPayload(attachment);
  const validationError = validateAttachmentPayload(normalized);

  if (validationError) {
    throw new Error(validationError);
  }

  if (transportMode === 'remote_mock') {
    const uploadPayload = buildMockRemoteAttachmentPayload(normalized, { conversationId, userId });

    if (typeof uploadAttachment === 'function') {
      const uploadedAttachment = await uploadAttachment(uploadPayload);
      return normalizeAttachmentPayload(uploadedAttachment);
    }

    if (!user) {
      throw new Error('Geen gebruiker beschikbaar voor attachment upload.');
    }

    const token = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/attachments/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId,
        attachment: uploadPayload,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.attachment) {
      throw new Error(data?.error || 'Bijlage uploaden mislukt');
    }

    return normalizeAttachmentPayload(data.attachment);
  }

  return normalized;
}
