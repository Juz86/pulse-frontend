import { normalizeAttachmentPayload } from './attachmentPayload';
import {
  buildAttachmentSummaryPresentation,
} from './attachmentPresentation';
import {
  getEncryptedMessageDisplayText,
  getSharedContactDisplayText,
} from './messageModel';

function buildEmptyConversationAttachmentSummaryFields() {
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

function buildConversationAttachmentSummaryFields(attachmentLike) {
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

function hasConversationAttachmentSummaryFields(summaryLike = {}) {
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

function buildConversationSummaryAttachmentSource(summaryLike = {}) {
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

function buildConversationSummaryAttachmentPayload(message = {}) {
  if (message?.attachment) {
    return normalizeAttachmentPayload(message.attachment);
  }

  if ((message?.type || message?.lastMessageType) !== 'attachment') {
    return null;
  }

  return normalizeAttachmentPayload(buildConversationSummaryAttachmentSource(message));
}

function buildConversationAttachmentSummaryPreview(message = {}) {
  const attachment = buildConversationSummaryAttachmentPayload(message);
  if (!attachment) {
    return null;
  }

  const {
    presentation,
    previewText,
  } = buildAttachmentSummaryPresentation(attachment, { includeStorageSignal: true });

  return {
    attachment,
    presentation,
    previewText,
  };
}

function buildConversationSummaryUpdate(message = {}) {
  const type = message?.type || message?.messageType || 'text';
  const attachment = normalizeAttachmentPayload(message?.attachment) || null;

  if (type === 'contact') {
    return {
      lastMessage: getSharedContactDisplayText(message?.sharedContact),
      lastMessageType: 'contact',
      ...buildEmptyConversationAttachmentSummaryFields(),
    };
  }

  if (type === 'attachment') {
    const { previewText } = buildAttachmentSummaryPresentation(attachment, { includeStorageSignal: true });

    return {
      lastMessage: previewText,
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

function normalizeConversationAttachmentSummary(conversation = {}) {
  return {
    ...conversation,
    lastMessageType: conversation?.lastMessageType || null,
    ...(hasConversationAttachmentSummaryFields(conversation)
      ? buildConversationAttachmentSummaryFields(buildConversationSummaryAttachmentSource(conversation))
      : buildEmptyConversationAttachmentSummaryFields()),
  };
}

export function buildConversationPreviewPresentation(
  message = {},
  { includeStorageSignal = true } = {}
) {
  const emptyAttachmentPresentation = buildAttachmentSummaryPresentation(null).presentation;
  const buildBasePreview = (previewText = '', attachmentSummary = null) => ({
    previewText,
    attachmentSummary,
    isAttachmentSummary: false,
    showRemoteAttachmentBadge: false,
    storageShortLabel: emptyAttachmentPresentation.storageShortLabel,
    strategyHintLabel: emptyAttachmentPresentation.strategyHintLabel || '',
    availabilityHintLabel: emptyAttachmentPresentation.availabilityHintLabel || '',
    mimeLabel: emptyAttachmentPresentation.mimeLabel,
    storageDetail: emptyAttachmentPresentation.storageDetail,
    keyContractDetail: emptyAttachmentPresentation.keyContractDetail,
  });

  if (!message) return buildBasePreview();
  if (message.deleted) return buildBasePreview('Bericht verwijderd');
  if (message.type === 'contact') {
    return buildBasePreview(getSharedContactDisplayText(message.sharedContact));
  }

  const attachmentSummary = buildConversationAttachmentSummaryPreview(message);
  if (attachmentSummary) {
    const attachmentPresentation = attachmentSummary.presentation;
    const previewText = includeStorageSignal
      ? attachmentSummary.previewText
      : buildAttachmentSummaryPresentation(
          attachmentSummary.attachment,
          { includeStorageSignal: false }
        ).previewText;
    return {
      ...buildBasePreview(previewText, attachmentSummary),
      isAttachmentSummary: true,
      showRemoteAttachmentBadge: attachmentPresentation.isRemote,
      storageShortLabel: attachmentPresentation.storageShortLabel,
      strategyHintLabel: attachmentPresentation.strategyHintLabel || '',
      availabilityHintLabel: attachmentPresentation.availabilityHintLabel || '',
      mimeLabel: attachmentPresentation.mimeLabel,
      storageDetail: attachmentPresentation.storageDetail,
      keyContractDetail: attachmentPresentation.keyContractDetail,
    };
  }

  if (typeof message.lastMessage === 'string' && message.lastMessage) {
    return buildBasePreview(message.lastMessage);
  }
  if (message.text) return buildBasePreview(message.text);
  if (message.ciphertextAvailable) {
    return buildBasePreview(getEncryptedMessageDisplayText());
  }
  return buildBasePreview();
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
