import { normalizeAttachmentPayload } from './attachmentPayload';
import {
  getAttachmentContractPresentation,
  getAttachmentPreviewText,
} from './attachmentPresentation';

export function buildEmptyConversationAttachmentSummaryFields() {
  return {
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
  };
}

export function buildConversationAttachmentSummaryFields(attachmentLike) {
  const attachment = normalizeAttachmentPayload(attachmentLike);
  if (!attachment) {
    return buildEmptyConversationAttachmentSummaryFields();
  }

  return {
    lastAttachmentName: attachment.name || 'Bestand',
    lastAttachmentTransfer: attachment.transfer || null,
    lastAttachmentStrategyKey: attachment.strategyKey || attachment.encryption?.strategyKey || null,
    lastAttachmentEncoding: attachment.contentEncoding || null,
    lastAttachmentEnvelopeKind: attachment.envelopeKind || attachment.encryption?.envelopeKind || null,
    lastAttachmentOriginalMimeType: attachment.originalMimeType || attachment.mimeType || null,
    lastAttachmentExpectedPayloadSha256: attachment.expectedPayloadSha256 || attachment.encryption?.sha256 || null,
    lastAttachmentMediaKeyId: attachment.encryption?.mediaKeyId || null,
    lastAttachmentKeyWrapAlg: attachment.encryption?.keyWrapAlg || null,
    lastAttachmentWrappedMediaKeyDigest: attachment.encryption?.wrappedMediaKeyDigest || null,
  };
}

export function hasConversationAttachmentSummaryFields(summaryLike = {}) {
  return Boolean(
    summaryLike?.lastAttachmentTransfer
    || summaryLike?.lastAttachmentName
    || summaryLike?.lastAttachmentStrategyKey
    || summaryLike?.lastAttachmentEncoding
    || summaryLike?.lastAttachmentEnvelopeKind
    || summaryLike?.lastAttachmentOriginalMimeType
    || summaryLike?.lastAttachmentExpectedPayloadSha256
    || summaryLike?.lastAttachmentMediaKeyId
    || summaryLike?.lastAttachmentKeyWrapAlg
    || summaryLike?.lastAttachmentWrappedMediaKeyDigest
  );
}

function deriveAttachmentNameFromPreview(lastMessage = '') {
  if (typeof lastMessage !== 'string') return '';
  if (lastMessage.startsWith('Bijlage: ')) {
    return lastMessage.slice('Bijlage: '.length).split(' · ')[0].trim();
  }
  return '';
}

export function buildConversationSummaryAttachmentSource(summaryLike = {}) {
  return {
    name: summaryLike.lastAttachmentName || deriveAttachmentNameFromPreview(summaryLike.lastMessage) || 'Bestand',
    transfer: summaryLike.lastAttachmentTransfer || '',
    strategyKey: summaryLike.lastAttachmentStrategyKey || '',
    mimeType: summaryLike.lastAttachmentOriginalMimeType || '',
    originalMimeType: summaryLike.lastAttachmentOriginalMimeType || '',
    contentEncoding: summaryLike.lastAttachmentEncoding || '',
    envelopeKind: summaryLike.lastAttachmentEnvelopeKind || '',
    expectedPayloadSha256: summaryLike.lastAttachmentExpectedPayloadSha256 || '',
    encryption: {
      strategyKey: summaryLike.lastAttachmentStrategyKey || '',
      mediaKeyId: summaryLike.lastAttachmentMediaKeyId || '',
      keyWrapAlg: summaryLike.lastAttachmentKeyWrapAlg || '',
      wrappedMediaKeyDigest: summaryLike.lastAttachmentWrappedMediaKeyDigest || '',
      envelopeKind: summaryLike.lastAttachmentEnvelopeKind || '',
    },
  };
}

export function buildConversationSummaryAttachmentPayload(message = {}) {
  if (message?.attachment) {
    return normalizeAttachmentPayload(message.attachment);
  }

  if ((message?.type || message?.lastMessageType) !== 'attachment') {
    return null;
  }

  return normalizeAttachmentPayload(buildConversationSummaryAttachmentSource(message));
}

export function buildConversationAttachmentSummaryPreview(message = {}) {
  const attachment = buildConversationSummaryAttachmentPayload(message);
  if (!attachment) {
    return null;
  }

  const presentation = getAttachmentContractPresentation(attachment);

  return {
    attachment,
    presentation,
    previewText: getAttachmentPreviewText(attachment, { includeStorageSignal: true }),
  };
}

export function buildConversationSummaryUpdate(message = {}) {
  const type = message?.type || message?.messageType || 'text';
  const attachment = normalizeAttachmentPayload(message?.attachment) || null;

  if (type === 'contact') {
    return {
      lastMessage: `Contactpersoon: ${message?.sharedContact?.name || 'Contactpersoon'}`,
      lastMessageType: 'contact',
      ...buildEmptyConversationAttachmentSummaryFields(),
    };
  }

  if (type === 'attachment') {
    return {
      lastMessage: getAttachmentPreviewText(attachment, { includeStorageSignal: true }),
      lastMessageType: 'attachment',
      ...buildConversationAttachmentSummaryFields(attachment),
    };
  }

  return {
    lastMessage: message?.text || '',
    lastMessageType: type,
    ...buildEmptyConversationAttachmentSummaryFields(),
  };
}

export function normalizeConversationAttachmentSummary(conversation = {}) {
  return {
    ...conversation,
    lastMessageType: conversation?.lastMessageType || null,
    ...(hasConversationAttachmentSummaryFields(conversation)
      ? buildConversationAttachmentSummaryFields(buildConversationSummaryAttachmentSource(conversation))
      : buildEmptyConversationAttachmentSummaryFields()),
  };
}

export function getConversationPreview(message = {}) {
  if (!message) return '';
  if (message.deleted) return 'Bericht verwijderd';
  if (message.type === 'contact') return `Contactpersoon: ${message.sharedContact?.name || 'Contactpersoon'}`;

  const attachmentSummary = buildConversationAttachmentSummaryPreview(message);
  if (attachmentSummary) {
    return attachmentSummary.previewText;
  }

  if (typeof message.lastMessage === 'string' && message.lastMessage) return message.lastMessage;
  if (message.text) return message.text;
  if (message.ciphertextAvailable) return 'Versleuteld bericht';
  return '';
}

export function getConversationAttachmentSummaryPresentation(conversation = {}) {
  const normalizedConversation = normalizeConversationAttachmentSummary(conversation);
  const attachmentSummary = buildConversationAttachmentSummaryPreview(normalizedConversation);
  const attachmentPresentation = attachmentSummary?.presentation || getAttachmentContractPresentation(null);

  return {
    isAttachmentSummary: normalizedConversation.lastMessageType === 'attachment',
    showRemoteAttachmentBadge: normalizedConversation.lastMessageType === 'attachment' && attachmentPresentation.isRemote,
    previewText: attachmentSummary?.previewText || '',
    storageShortLabel: attachmentPresentation.storageShortLabel,
    mimeLabel: attachmentPresentation.mimeLabel,
    storageDetail: attachmentPresentation.storageDetail,
    keyContractDetail: attachmentPresentation.keyContractDetail,
  };
}

export function applyConversationSummaryToList(conversations = [], conversationId, message = {}, updatedAt = null) {
  const summary = normalizeConversationAttachmentSummary(buildConversationSummaryUpdate(message));

  return [...conversations.map((conversation) => (
    conversation.id === conversationId
      ? {
          ...conversation,
          ...summary,
          updatedAt: updatedAt || message?.createdAt || conversation.updatedAt,
          lastCallDirection: null,
          lastCallSenderId: null,
          lastCallIsVideo: null,
        }
      : conversation
  ))].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
    const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
    return bTime - aTime;
  });
}
