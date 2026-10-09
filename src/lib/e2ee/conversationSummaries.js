import { getAttachmentDisplayName, normalizeAttachmentPayload } from './attachmentPayload';
import {
  buildAttachmentSummaryPresentation,
} from './attachmentPresentation';
import {
  getDeletedMessageDisplayText,
  getEncryptedMessageDisplayText,
  getSharedContactDisplayText,
} from './messageCopy';

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

function buildEmptyConversationReactionSummaryFields() {
  return {
    lastReactionMessageId: null,
    lastReactionEmoji: null,
    lastReactionReactorId: null,
    lastReactionAt: null,
  };
}

function buildConversationAttachmentSummaryFields(attachmentLike) {
  const attachment = normalizeAttachmentPayload(attachmentLike);
  if (!attachment) {
    return buildEmptyConversationAttachmentSummaryFields();
  }

  return {
    lastAttachmentName: getAttachmentDisplayName(attachment),
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

function buildNormalizedConversationAttachmentSummaryFields(summaryLike = {}) {
  return hasConversationAttachmentSummaryFields(summaryLike)
    ? buildConversationAttachmentSummaryFields(
        buildConversationSummaryAttachmentSource(summaryLike)
      )
    : buildEmptyConversationAttachmentSummaryFields();
}

function deriveAttachmentNameFromPreview(lastMessage = '') {
  if (typeof lastMessage !== 'string') return '';
  if (lastMessage.startsWith('Bijlage: ')) {
    return lastMessage.slice('Bijlage: '.length).split(' · ')[0].trim();
  }
  return '';
}

function resolveConversationSummaryAttachmentName(summaryLike = {}) {
  return (
    summaryLike.lastAttachmentName
    || deriveAttachmentNameFromPreview(summaryLike.lastMessage)
    || getAttachmentDisplayName()
  );
}

function buildConversationSummaryAttachmentEncryptionSource(summaryLike = {}) {
  return {
    strategyKey: summaryLike.lastAttachmentStrategyKey || '',
    mediaKeyId: summaryLike.lastAttachmentMediaKeyId || '',
    keyWrapAlg: summaryLike.lastAttachmentKeyWrapAlg || '',
    wrappedMediaKeyDigest: summaryLike.lastAttachmentWrappedMediaKeyDigest || '',
    envelopeKind: summaryLike.lastAttachmentEnvelopeKind || '',
  };
}

function buildConversationSummaryAttachmentMetadataSource(summaryLike = {}) {
  return {
    transfer: summaryLike.lastAttachmentTransfer || '',
    strategyKey: summaryLike.lastAttachmentStrategyKey || '',
    mimeType: summaryLike.lastAttachmentOriginalMimeType || '',
    originalMimeType: summaryLike.lastAttachmentOriginalMimeType || '',
    contentEncoding: summaryLike.lastAttachmentEncoding || '',
    envelopeKind: summaryLike.lastAttachmentEnvelopeKind || '',
    expectedPayloadSha256: summaryLike.lastAttachmentExpectedPayloadSha256 || '',
  };
}

function buildConversationSummaryAttachmentSource(summaryLike = {}) {
  return {
    name: resolveConversationSummaryAttachmentName(summaryLike),
    ...buildConversationSummaryAttachmentMetadataSource(summaryLike),
    encryption: buildConversationSummaryAttachmentEncryptionSource(summaryLike),
  };
}

function resolveConversationSummaryAttachmentPayloadSource(message = {}) {
  if (message?.attachment) {
    return message.attachment;
  }

  if ((message?.type || message?.lastMessageType) !== 'attachment') {
    return null;
  }

  return buildConversationSummaryAttachmentSource(message);
}

function buildConversationSummaryAttachmentPayload(message = {}) {
  return normalizeAttachmentPayload(
    resolveConversationSummaryAttachmentPayloadSource(message)
  );
}

function buildConversationAttachmentSummaryState(attachment) {
  const attachmentSummaryPresentation = buildConversationAttachmentSummaryPresentation(attachment);

  return {
    attachment,
    presentation: attachmentSummaryPresentation.presentation,
    previewText: attachmentSummaryPresentation.previewText,
  };
}

function buildConversationAttachmentSummaryPreview(message = {}) {
  const attachment = buildConversationSummaryAttachmentPayload(message);
  if (!attachment) {
    return null;
  }

  return buildConversationAttachmentSummaryState(attachment);
}

function buildConversationAttachmentSummaryPresentation(
  attachment,
  { includeStorageSignal = true } = {}
) {
  return buildAttachmentSummaryPresentation(
    attachment,
    { includeStorageSignal }
  );
}

function buildConversationSummaryUpdate(message = {}) {
  const type = message?.type || message?.messageType || 'text';
  const attachment = normalizeAttachmentPayload(message?.attachment) || null;

  if (type === 'contact') {
    return buildConversationSummaryMessageState(message, 'contact');
  }

  if (type === 'attachment') {
    return {
      ...buildConversationSummaryMessageFields(message, 'attachment', attachment),
      ...buildConversationAttachmentSummaryFields(attachment),
    };
  }

  return buildConversationSummaryMessageState(message, type);
}

function normalizeConversationAttachmentSummary(conversation = {}) {
  return {
    ...conversation,
    lastMessageType: conversation?.lastMessageType || null,
    ...buildNormalizedConversationAttachmentSummaryFields(conversation),
    ...buildNormalizedConversationReactionSummaryFields(conversation),
  };
}

function buildNormalizedConversationReactionSummaryFields(summaryLike = {}) {
  return summaryLike?.lastReactionMessageId && summaryLike?.lastReactionEmoji && summaryLike?.lastReactionReactorId
    ? {
        lastReactionMessageId: summaryLike.lastReactionMessageId,
        lastReactionEmoji: summaryLike.lastReactionEmoji,
        lastReactionReactorId: summaryLike.lastReactionReactorId,
        lastReactionAt: summaryLike.lastReactionAt || summaryLike.updatedAt || null,
      }
    : buildEmptyConversationReactionSummaryFields();
}

function sortConversationSummaryList(conversations = []) {
  return [...conversations].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.lastMessageAt || a.createdAt || 0);
    const bTime = Date.parse(b.updatedAt || b.lastMessageAt || b.createdAt || 0);
    return bTime - aTime;
  });
}

function resolveConversationSummaryUpdatedAt(conversation = {}, message = {}, updatedAt = null) {
  return updatedAt || message?.createdAt || conversation.updatedAt;
}

function buildConversationMessageSummaryFields(lastMessage = '', lastMessageType = 'text') {
  return {
    lastMessage,
    lastMessageType,
  };
}

function buildConversationSummaryMessageFields(
  message = {},
  messageType = 'text',
  attachment = null
) {
  if (messageType === 'contact') {
    return buildConversationMessageSummaryFields(
      getSharedContactDisplayText(message?.sharedContact),
      'contact'
    );
  }

  if (messageType === 'attachment') {
    return buildConversationMessageSummaryFields(
      buildConversationAttachmentSummaryPresentation(attachment).previewText,
      'attachment'
    );
  }

  return buildConversationMessageSummaryFields(message?.text || '', messageType);
}

function buildConversationSummaryMessageState(
  message = {},
  messageType = 'text',
  attachment = null
) {
  return {
    ...buildConversationSummaryMessageFields(message, messageType, attachment),
    ...buildEmptyConversationAttachmentSummaryFields(),
  };
}

function buildConversationPreviewAttachmentFields(attachmentPresentation) {
  return {
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

function buildConversationAttachmentPreviewState(
  attachmentSummary,
  { includeStorageSignal = true } = {}
) {
  return {
    previewText: buildConversationAttachmentSummaryPresentation(
      attachmentSummary.attachment,
      { includeStorageSignal }
    ).previewText,
    attachmentFields: buildConversationPreviewAttachmentFields(
      attachmentSummary.presentation
    ),
  };
}

function buildEmptyConversationPreviewAttachmentFields() {
  const emptyAttachmentPresentation = buildAttachmentSummaryPresentation(null).presentation;

  return {
    isAttachmentSummary: false,
    showRemoteAttachmentBadge: false,
    storageShortLabel: emptyAttachmentPresentation.storageShortLabel,
    strategyHintLabel: emptyAttachmentPresentation.strategyHintLabel || '',
    availabilityHintLabel: emptyAttachmentPresentation.availabilityHintLabel || '',
    mimeLabel: emptyAttachmentPresentation.mimeLabel,
    storageDetail: emptyAttachmentPresentation.storageDetail,
    keyContractDetail: emptyAttachmentPresentation.keyContractDetail,
  };
}

function buildConversationBasePreview(
  previewText = '',
  attachmentSummary = null
) {
  return {
    previewText,
    attachmentSummary,
    ...buildEmptyConversationPreviewAttachmentFields(),
  };
}

function resolveConversationPreviewText(message = {}) {
  if (typeof message.lastMessage === 'string' && message.lastMessage) {
    return message.lastMessage;
  }
  if (message.text) {
    return message.text;
  }
  if (message.ciphertextAvailable) {
    return getEncryptedMessageDisplayText();
  }
  return '';
}

function resolveConversationPreviewSpecialCaseText(message = {}) {
  if (message.deleted) {
    return getDeletedMessageDisplayText();
  }
  if (message.type === 'contact') {
    return getSharedContactDisplayText(message.sharedContact);
  }
  return null;
}

function resolveConversationCallPresentation(message = {}, currentUid = null) {
  if (message?.lastMessageType !== 'call' || !message?.lastCallEvent) return null;

  const presentation = currentUid
    ? message.lastCallEvent.presentations?.[currentUid]
    : null;
  const kind = presentation?.kind || 'missed_incoming';
  const fallbackLabel = kind === 'outgoing_unanswered'
    ? 'Geen antwoord'
    : kind.endsWith('_declined')
      ? 'Oproep geweigerd'
      : 'Gemiste spraakoproep';

  return {
    kind,
    previewText: presentation?.label || fallbackLabel,
  };
}

export function normalizeConversationSummaryRecord(conversation = {}) {
  return normalizeConversationAttachmentSummary({
    ...conversation,
    updatedAt: conversation.updatedAt || conversation.lastMessageAt || conversation.createdAt || null,
  });
}

export function buildConversationPreviewPresentation(
  message = {},
  { includeStorageSignal = true, currentUid = null } = {}
) {
  if (!message) return buildConversationBasePreview();
  const callPresentation = resolveConversationCallPresentation(message, currentUid);
  if (callPresentation) {
    return {
      ...buildConversationBasePreview(callPresentation.previewText),
      isCallSummary: true,
      callKind: callPresentation.kind,
    };
  }
  const specialCasePreviewText = resolveConversationPreviewSpecialCaseText(message);
  if (specialCasePreviewText) {
    return buildConversationBasePreview(specialCasePreviewText);
  }

  const attachmentSummary = buildConversationAttachmentSummaryPreview(message);
  if (attachmentSummary) {
    const attachmentPreviewState = buildConversationAttachmentPreviewState(
      attachmentSummary,
      { includeStorageSignal }
    );
    return {
      ...buildConversationBasePreview(attachmentPreviewState.previewText, attachmentSummary),
      ...attachmentPreviewState.attachmentFields,
    };
  }

  return buildConversationBasePreview(resolveConversationPreviewText(message));
}

export function applyConversationSummaryToList(conversations = [], conversationId, message = {}, updatedAt = null) {
  const summary = normalizeConversationAttachmentSummary(buildConversationSummaryUpdate(message));

  return sortConversationSummaryList(conversations.map((conversation) => (
    conversation.id === conversationId
      ? {
          ...conversation,
          ...summary,
          updatedAt: resolveConversationSummaryUpdatedAt(conversation, message, updatedAt),
          ...buildEmptyConversationReactionSummaryFields(),
        }
      : conversation
  )));
}

export function applyConversationReactionSummaryToList(
  conversations = [],
  conversationId,
  {
    messageId,
    emoji,
    reactorId,
    reactions = {},
    updatedAt = null,
  } = {}
) {
  return sortConversationSummaryList(conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    const reactionStillPresent = Boolean(
      emoji
      && reactorId
      && Array.isArray(reactions?.[emoji])
      && reactions[emoji].includes(reactorId)
    );
    const isRemovingCurrentPreview =
      conversation.lastReactionMessageId === messageId
      && conversation.lastReactionEmoji === emoji
      && conversation.lastReactionReactorId === reactorId
      && !reactionStillPresent;

    if (!reactionStillPresent && !isRemovingCurrentPreview) return conversation;

    return {
      ...conversation,
      ...(reactionStillPresent
        ? {
            lastReactionMessageId: messageId,
            lastReactionEmoji: emoji,
            lastReactionReactorId: reactorId,
            lastReactionAt: updatedAt || new Date().toISOString(),
            updatedAt: updatedAt || new Date().toISOString(),
          }
        : buildEmptyConversationReactionSummaryFields()),
    };
  }));
}
