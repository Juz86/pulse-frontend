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

function buildEmptyConversationSummary(fallback = '') {
  return {
    lastMessage: fallback,
    lastMessageType: null,
    ...buildEmptyConversationAttachmentSummaryFields(),
  };
}

export function buildConversationAttachmentSummaryFields(attachment = null) {
  if (!attachment || typeof attachment !== 'object') {
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

export function buildConversationSummaryAttachmentPayload(summaryLike = {}) {
  if (!hasConversationAttachmentSummaryFields(summaryLike)) {
    return null;
  }

  return buildConversationSummaryAttachmentSource(summaryLike);
}

export function buildConversationSummaryAttachmentSource(summaryLike = {}) {
  return {
    name: summaryLike.lastAttachmentName || 'Bestand',
    transfer: summaryLike.lastAttachmentTransfer || '',
    strategyKey: summaryLike.lastAttachmentStrategyKey || '',
    contentEncoding: summaryLike.lastAttachmentEncoding || '',
    envelopeKind: summaryLike.lastAttachmentEnvelopeKind || '',
    originalMimeType: summaryLike.lastAttachmentOriginalMimeType || '',
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

export function buildConversationSummaryAttachmentPreview(summaryLike = {}) {
  const attachment = buildConversationSummaryAttachmentPayload(summaryLike);
  if (!attachment) {
    return null;
  }

  return {
    attachment,
    previewText: `Bijlage: ${attachment.name || 'Bestand'}`,
  };
}

export function applyConversationSummaryFields(target = {}, summary = {}) {
  return {
    ...target,
    lastMessage: summary.lastMessage ?? '',
    lastMessageType: summary.lastMessageType ?? null,
    ...buildConversationAttachmentSummaryFields(buildConversationSummaryAttachmentSource(summary)),
  };
}

export function deriveConversationSummary(message, fallback = '') {
  if (!message) {
    return buildEmptyConversationSummary(fallback);
  }

  if (message.text) {
    return {
      lastMessage: message.text,
      lastMessageType: message.messageType || 'text',
      ...buildConversationAttachmentSummaryFields(
        message.messageType === 'attachment' ? message.attachment : null
      ),
    };
  }

  if (message.messageType === 'contact') {
    return {
      lastMessage: 'Contactpersoon gedeeld',
      lastMessageType: 'contact',
      ...buildEmptyConversationAttachmentSummaryFields(),
    };
  }

  if (message.messageType === 'attachment') {
    const attachmentPreview = buildConversationSummaryAttachmentPreview(
      buildConversationAttachmentSummaryFields(message.attachment)
    );
    return {
      lastMessage: attachmentPreview?.previewText || 'Bijlage: Bestand',
      lastMessageType: 'attachment',
      ...buildConversationAttachmentSummaryFields(message.attachment),
    };
  }

  if (message.messageType && message.messageType !== 'text') {
    return {
      lastMessage: 'Nieuw bericht',
      lastMessageType: message.messageType,
      ...buildEmptyConversationAttachmentSummaryFields(),
    };
  }

  if (message.protocol === 'signal_v1' && message.ciphertext) {
    try {
      return {
        lastMessage: Buffer.from(message.ciphertext, 'base64').toString('utf8') || fallback || 'Versleuteld bericht',
        lastMessageType: message.messageType || 'text',
        ...buildEmptyConversationAttachmentSummaryFields(),
      };
    } catch {
      return {
        lastMessage: fallback || 'Versleuteld bericht',
        lastMessageType: message.messageType || 'text',
        ...buildEmptyConversationAttachmentSummaryFields(),
      };
    }
  }

  return buildEmptyConversationSummary(fallback);
}
