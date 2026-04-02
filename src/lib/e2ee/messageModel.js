export function normalizeIncomingMessage(raw, currentUserId) {
  const senderId = raw.senderId || raw.senderUserId;

  return {
    id: raw.id,
    localId: raw.localId || null,
    conversationId: raw.conversationId || raw.convId || null,
    text: raw.text || '',
    senderId,
    createdAt: raw.createdAt || new Date().toISOString(),

    replyTo: raw.replyTo || (raw.replyToMessageId ? { messageId: raw.replyToMessageId } : null),
    reactions: Array.isArray(raw.reactions) ? raw.reactions : [],
    deleted: !!raw.deleted,

    protocol: raw.protocol || 'legacy_plaintext',
    deliveryState: raw.deliveryState || 'sent',
    decryptedLocally: raw.decryptedLocally ?? true,
    ciphertextAvailable: !!raw.ciphertext,
    isLocalOnly: !!raw.isLocalOnly,
    isOwn: senderId === currentUserId,

    messageType: raw.messageType || 'text',
    attachment: raw.attachment || null,

    pending: !!raw.pending,
    failed: !!raw.failed,
  };
}

export function buildPendingMessage({ text, conversationId, userId, replyTo = null }) {
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: localId,
    localId,
    conversationId,
    text,
    senderId: userId,
    createdAt: new Date().toISOString(),

    replyTo,
    reactions: [],
    deleted: false,

    protocol: 'signal_v1',
    deliveryState: 'sending',
    decryptedLocally: true,
    ciphertextAvailable: false,
    isLocalOnly: true,
    isOwn: true,

    messageType: 'text',
    attachment: null,

    pending: true,
    failed: false,
  };
}

export function patchPendingMessageAsSent(msg, messageId) {
  return {
    ...msg,
    id: messageId,
    deliveryState: 'sent',
    ciphertextAvailable: true,
    isLocalOnly: false,
    pending: false,
    failed: false,
  };
}

export function patchPendingMessageAsFailed(msg) {
  return {
    ...msg,
    deliveryState: 'failed',
    pending: false,
    failed: true,
  };
}

export function getConversationPreview(msg) {
  if (!msg) return '';
  if (msg.deleted) return 'Bericht verwijderd';
  if (msg.text) return msg.text;
  if (msg.ciphertextAvailable) return 'Versleuteld bericht';
  return '';
}
