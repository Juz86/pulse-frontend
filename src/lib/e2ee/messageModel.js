import { normalizeAttachmentPayload } from './attachmentPayload';
import { getAttachmentPreviewText } from './attachmentPresentation';

function deriveAttachmentNameFromPreview(lastMessage = '') {
  if (typeof lastMessage !== 'string') return '';
  if (lastMessage.startsWith('Bijlage: ')) {
    return lastMessage.slice('Bijlage: '.length).split(' · ')[0].trim();
  }
  return '';
}

function deriveAttachmentSummaryAttachment(message = {}) {
  if (message?.attachment) {
    return message.attachment;
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
    expectedPayloadSha256: message.lastAttachmentExpectedPayloadSha256 || '',
  });
}

export function normalizeIncomingMessage(raw, currentUserId) {
  const senderId = raw.senderId || raw.senderUserId;
  const type = raw.type || raw.messageType || 'text';
  const reactions = raw.reactions && typeof raw.reactions === 'object' && !Array.isArray(raw.reactions)
    ? raw.reactions
    : {};

  return {
    id: raw.id,
    localId: raw.localId || null,
    conversationId: raw.conversationId || raw.convId || null,
    text: raw.text || '',
    senderId,
    createdAt: raw.createdAt || new Date().toISOString(),

    replyTo: raw.replyTo || (raw.replyToMessageId ? { messageId: raw.replyToMessageId } : null),
    mentions: Array.isArray(raw.mentions) ? raw.mentions : [],
    reactions,
    deleted: !!raw.deleted,

    protocol: raw.protocol || 'legacy_plaintext',
    deliveryState: raw.deliveryState || 'sent',
    receiptSummary: raw.receiptSummary || null,
    decryptedLocally: raw.decryptedLocally ?? true,
    ciphertextAvailable: !!raw.ciphertext,
    isLocalOnly: !!raw.isLocalOnly,
    isOwn: senderId === currentUserId,

    type,
    messageType: raw.messageType || type,
    sharedContact: raw.sharedContact || null,
    attachment: normalizeAttachmentPayload(raw.attachment) || null,

    pending: !!raw.pending,
    failed: !!raw.failed,
  };
}

export function buildPendingMessage({
  text,
  conversationId,
  userId,
  replyTo = null,
  type = 'text',
  sharedContact = null,
  attachment = null,
  mentions = [],
}) {
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: localId,
    localId,
    conversationId,
    text,
    senderId: userId,
    createdAt: new Date().toISOString(),

    replyTo,
    mentions,
    reactions: {},
    deleted: false,

    protocol: 'signal_v1',
    deliveryState: 'sending',
    receiptSummary: null,
    decryptedLocally: true,
    ciphertextAvailable: false,
    isLocalOnly: true,
    isOwn: true,

    type,
    messageType: type,
    sharedContact,
    attachment: normalizeAttachmentPayload(attachment) || null,

    pending: true,
    failed: false,
  };
}

export function patchPendingMessageAsSent(msg, messageId) {
  return {
    ...msg,
    id: messageId,
    deliveryState: 'sent',
    receiptSummary: msg.receiptSummary || null,
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
    receiptSummary: msg.receiptSummary || null,
    pending: false,
    failed: true,
  };
}

export function getConversationPreview(msg) {
  if (!msg) return '';
  if (msg.deleted) return 'Bericht verwijderd';
  if (msg.type === 'contact') return `Contactpersoon: ${msg.sharedContact?.name || 'Contactpersoon'}`;
  const attachmentSummary = deriveAttachmentSummaryAttachment(msg);
  if (attachmentSummary) return getAttachmentPreviewText(attachmentSummary, { includeStorageSignal: true });
  if (typeof msg.lastMessage === 'string' && msg.lastMessage) return msg.lastMessage;
  if (msg.text) return msg.text;
  if (msg.ciphertextAvailable) return 'Versleuteld bericht';
  return '';
}

export function getMessageDisplayText(msg) {
  if (!msg) return '';
  if (msg.type === 'attachment') return getAttachmentPreviewText(msg.attachment, { includeStorageSignal: false });
  if (msg.text) return msg.text;
  if (msg.ciphertextAvailable && msg.decryptedLocally === false) return 'Versleuteld bericht';
  return '';
}
