function buildEmptyConversationSummary(fallback = '') {
  return {
    lastMessage: fallback,
    lastMessageType: null,
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

export function applyConversationSummaryFields(target = {}, summary = {}) {
  return {
    ...target,
    lastMessage: summary.lastMessage ?? '',
    lastMessageType: summary.lastMessageType ?? null,
    lastAttachmentTransfer: summary.lastAttachmentTransfer ?? null,
    lastAttachmentEncoding: summary.lastAttachmentEncoding ?? null,
    lastAttachmentEnvelopeKind: summary.lastAttachmentEnvelopeKind ?? null,
    lastAttachmentOriginalMimeType: summary.lastAttachmentOriginalMimeType ?? null,
    lastAttachmentExpectedPayloadSha256: summary.lastAttachmentExpectedPayloadSha256 ?? null,
    lastAttachmentMediaKeyId: summary.lastAttachmentMediaKeyId ?? null,
    lastAttachmentKeyWrapAlg: summary.lastAttachmentKeyWrapAlg ?? null,
    lastAttachmentWrappedMediaKeyDigest: summary.lastAttachmentWrappedMediaKeyDigest ?? null,
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
      lastAttachmentTransfer: message.messageType === 'attachment' ? (message.attachment?.transfer || null) : null,
      lastAttachmentEncoding: message.messageType === 'attachment' ? (message.attachment?.contentEncoding || null) : null,
      lastAttachmentEnvelopeKind: message.messageType === 'attachment'
        ? (message.attachment?.envelopeKind || message.attachment?.encryption?.envelopeKind || null)
        : null,
      lastAttachmentOriginalMimeType: message.messageType === 'attachment'
        ? (message.attachment?.originalMimeType || message.attachment?.mimeType || null)
        : null,
      lastAttachmentExpectedPayloadSha256: message.messageType === 'attachment'
        ? (message.attachment?.expectedPayloadSha256 || message.attachment?.encryption?.sha256 || null)
        : null,
      lastAttachmentMediaKeyId: message.messageType === 'attachment'
        ? (message.attachment?.encryption?.mediaKeyId || null)
        : null,
      lastAttachmentKeyWrapAlg: message.messageType === 'attachment'
        ? (message.attachment?.encryption?.keyWrapAlg || null)
        : null,
      lastAttachmentWrappedMediaKeyDigest: message.messageType === 'attachment'
        ? (message.attachment?.encryption?.wrappedMediaKeyDigest || null)
        : null,
    };
  }

  if (message.messageType === 'contact') {
    return {
      lastMessage: 'Contactpersoon gedeeld',
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

  if (message.messageType === 'attachment') {
    const attachmentName = message.attachment?.name || 'Bestand';
    return {
      lastMessage: `Bijlage: ${attachmentName}`,
      lastMessageType: 'attachment',
      lastAttachmentTransfer: message.attachment?.transfer || null,
      lastAttachmentEncoding: message.attachment?.contentEncoding || null,
      lastAttachmentEnvelopeKind: message.attachment?.envelopeKind || message.attachment?.encryption?.envelopeKind || null,
      lastAttachmentOriginalMimeType: message.attachment?.originalMimeType || message.attachment?.mimeType || null,
      lastAttachmentExpectedPayloadSha256: message.attachment?.expectedPayloadSha256 || message.attachment?.encryption?.sha256 || null,
      lastAttachmentMediaKeyId: message.attachment?.encryption?.mediaKeyId || null,
      lastAttachmentKeyWrapAlg: message.attachment?.encryption?.keyWrapAlg || null,
      lastAttachmentWrappedMediaKeyDigest: message.attachment?.encryption?.wrappedMediaKeyDigest || null,
    };
  }

  if (message.messageType && message.messageType !== 'text') {
    return {
      lastMessage: 'Nieuw bericht',
      lastMessageType: message.messageType,
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

  if (message.protocol === 'signal_v1' && message.ciphertext) {
    try {
      return {
        lastMessage: Buffer.from(message.ciphertext, 'base64').toString('utf8') || fallback || 'Versleuteld bericht',
        lastMessageType: message.messageType || 'text',
        lastAttachmentTransfer: null,
        lastAttachmentEncoding: null,
        lastAttachmentEnvelopeKind: null,
        lastAttachmentOriginalMimeType: null,
        lastAttachmentExpectedPayloadSha256: null,
        lastAttachmentMediaKeyId: null,
        lastAttachmentKeyWrapAlg: null,
        lastAttachmentWrappedMediaKeyDigest: null,
      };
    } catch {
      return {
        lastMessage: fallback || 'Versleuteld bericht',
        lastMessageType: message.messageType || 'text',
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
  }

  return buildEmptyConversationSummary(fallback);
}
