import { normalizeAttachmentPayload } from './attachmentPayload';
import {
  getAttachmentContractPresentation,
  getAttachmentPreviewText,
} from './attachmentPresentation';

function deriveAttachmentNameFromPreview(lastMessage = '') {
  if (typeof lastMessage !== 'string') return '';
  if (lastMessage.startsWith('Bijlage: ')) {
    return lastMessage.slice('Bijlage: '.length).split(' · ')[0].trim();
  }
  return '';
}

function deriveAttachmentSummaryAttachment(message = {}) {
  if (message?.attachment) {
    return normalizeAttachmentPayload(message.attachment);
  }

  if ((message?.type || message?.lastMessageType) !== 'attachment') {
    return null;
  }

  return normalizeAttachmentPayload({
    name: deriveAttachmentNameFromPreview(message.lastMessage) || 'Bestand',
    transfer: message.lastAttachmentTransfer || '',
    mimeType: message.lastAttachmentOriginalMimeType || '',
    originalMimeType: message.lastAttachmentOriginalMimeType || '',
    contentEncoding: message.lastAttachmentEncoding || '',
    envelopeKind: message.lastAttachmentEnvelopeKind || '',
    expectedPayloadSha256: message.lastAttachmentExpectedPayloadSha256 || '',
    encryption: {
      mediaKeyId: message.lastAttachmentMediaKeyId || '',
      keyWrapAlg: message.lastAttachmentKeyWrapAlg || '',
      wrappedMediaKeyDigest: message.lastAttachmentWrappedMediaKeyDigest || '',
      envelopeKind: message.lastAttachmentEnvelopeKind || '',
    },
  });
}

export function buildConversationSummaryUpdate(message = {}) {
  const type = message?.type || message?.messageType || 'text';
  const attachment = normalizeAttachmentPayload(message?.attachment) || null;

  if (type === 'contact') {
    return {
      lastMessage: `Contactpersoon: ${message?.sharedContact?.name || 'Contactpersoon'}`,
      lastMessageType: 'contact',
      lastAttachmentTransfer: null,
      lastAttachmentEncoding: null,
      lastAttachmentEnvelopeKind: null,
      lastAttachmentOriginalMimeType: null,
      lastAttachmentExpectedPayloadSha256: null,
      lastAttachmentMediaKeyId: null,
      lastAttachmentKeyWrapAlg: null,
      lastAttachmentWrappedMediaKeyDigest: null,
    };
  }

  if (type === 'attachment') {
    return {
      lastMessage: getAttachmentPreviewText(attachment, { includeStorageSignal: true }),
      lastMessageType: 'attachment',
      lastAttachmentTransfer: attachment?.transfer || null,
      lastAttachmentEncoding: attachment?.contentEncoding || null,
      lastAttachmentEnvelopeKind: attachment?.envelopeKind || attachment?.encryption?.envelopeKind || null,
      lastAttachmentOriginalMimeType: attachment?.originalMimeType || attachment?.mimeType || null,
      lastAttachmentExpectedPayloadSha256: attachment?.expectedPayloadSha256 || attachment?.encryption?.sha256 || null,
      lastAttachmentMediaKeyId: attachment?.encryption?.mediaKeyId || null,
      lastAttachmentKeyWrapAlg: attachment?.encryption?.keyWrapAlg || null,
      lastAttachmentWrappedMediaKeyDigest: attachment?.encryption?.wrappedMediaKeyDigest || null,
    };
  }

  return {
    lastMessage: message?.text || '',
    lastMessageType: type,
    lastAttachmentTransfer: null,
    lastAttachmentEncoding: null,
    lastAttachmentEnvelopeKind: null,
    lastAttachmentOriginalMimeType: null,
    lastAttachmentExpectedPayloadSha256: null,
    lastAttachmentMediaKeyId: null,
    lastAttachmentKeyWrapAlg: null,
    lastAttachmentWrappedMediaKeyDigest: null,
  };
}

export function normalizeConversationAttachmentSummary(conversation = {}) {
  return {
    ...conversation,
    lastMessageType: conversation?.lastMessageType || null,
    lastAttachmentTransfer: conversation?.lastAttachmentTransfer || null,
    lastAttachmentEncoding: conversation?.lastAttachmentEncoding || null,
    lastAttachmentEnvelopeKind: conversation?.lastAttachmentEnvelopeKind || null,
    lastAttachmentOriginalMimeType: conversation?.lastAttachmentOriginalMimeType || null,
    lastAttachmentExpectedPayloadSha256: conversation?.lastAttachmentExpectedPayloadSha256 || null,
    lastAttachmentMediaKeyId: conversation?.lastAttachmentMediaKeyId || null,
    lastAttachmentKeyWrapAlg: conversation?.lastAttachmentKeyWrapAlg || null,
    lastAttachmentWrappedMediaKeyDigest: conversation?.lastAttachmentWrappedMediaKeyDigest || null,
  };
}

export function getConversationPreview(message = {}) {
  if (!message) return '';
  if (message.deleted) return 'Bericht verwijderd';
  if (message.type === 'contact') return `Contactpersoon: ${message.sharedContact?.name || 'Contactpersoon'}`;

  const attachmentSummary = deriveAttachmentSummaryAttachment(message);
  if (attachmentSummary) {
    return getAttachmentPreviewText(attachmentSummary, { includeStorageSignal: true });
  }

  if (typeof message.lastMessage === 'string' && message.lastMessage) return message.lastMessage;
  if (message.text) return message.text;
  if (message.ciphertextAvailable) return 'Versleuteld bericht';
  return '';
}

export function getConversationAttachmentSummaryPresentation(conversation = {}) {
  const normalizedConversation = normalizeConversationAttachmentSummary(conversation);
  const previewName = typeof conversation?.lastMessage === 'string' && conversation.lastMessage.startsWith('Bijlage: ')
    ? conversation.lastMessage.slice('Bijlage: '.length).split(' · ')[0].trim()
    : '';
  const attachment = {
    name: previewName || 'Bestand',
    transfer: normalizedConversation.lastAttachmentTransfer || '',
    mimeType: normalizedConversation.lastAttachmentOriginalMimeType || '',
    originalMimeType: normalizedConversation.lastAttachmentOriginalMimeType || '',
    contentEncoding: normalizedConversation.lastAttachmentEncoding || '',
    envelopeKind: normalizedConversation.lastAttachmentEnvelopeKind || '',
    expectedPayloadSha256: normalizedConversation.lastAttachmentExpectedPayloadSha256 || '',
    encryption: {
      mediaKeyId: normalizedConversation.lastAttachmentMediaKeyId || '',
      keyWrapAlg: normalizedConversation.lastAttachmentKeyWrapAlg || '',
      wrappedMediaKeyDigest: normalizedConversation.lastAttachmentWrappedMediaKeyDigest || '',
      envelopeKind: normalizedConversation.lastAttachmentEnvelopeKind || '',
    },
  };
  const attachmentPresentation = getAttachmentContractPresentation(attachment);

  return {
    isAttachmentSummary: normalizedConversation.lastMessageType === 'attachment',
    showRemoteAttachmentBadge: normalizedConversation.lastMessageType === 'attachment' && attachmentPresentation.isRemote,
    previewText: getAttachmentPreviewText(attachment, { includeStorageSignal: true }),
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
