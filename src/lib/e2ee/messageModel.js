import { normalizeAttachmentPayload } from './attachmentPayload';
import { buildConversationPreviewPresentation } from './conversationSummaries';
import { normalizeSingleUserReaction } from './messageReactions';
import {
  ENCRYPTED_MESSAGE_PROTOCOL,
  PLAINTEXT_MESSAGE_PROTOCOL,
} from './messageProtocolConstants';
import {
  getEncryptedMessageDisplayText,
  getSharedContactDisplayText,
} from './messageCopy';
import { resolveKnownPulseMessageType } from './messageTypeConstants';
import { resolveSupportedOutgoingMessageType } from './messageTransportPayload';

export function normalizeIncomingMessage(raw, currentUserId) {
  const senderId = raw.senderId || raw.senderUserId;
  const type = resolveKnownPulseMessageType(raw.type || raw.messageType || 'text');
  const normalizedSharedContact = type === 'contact' ? (raw.sharedContact || null) : null;
  const normalizedAttachment = type === 'attachment'
    ? (normalizeAttachmentPayload(raw.attachment) || null)
    : null;
  const normalizedCallPresentation = type === 'call'
    ? (raw.presentations?.[currentUserId] || raw.callEvent?.presentations?.[currentUserId] || null)
    : null;
  const normalizedCallKind = normalizedCallPresentation?.kind || null;
  const normalizedCallDirection = type === 'call'
    ? (raw.direction || (
        normalizedCallKind === 'missed_incoming' || normalizedCallKind?.startsWith('incoming_')
          ? 'incoming'
          : 'outgoing'
      ))
    : null;
  const normalizedCallDuration = type === 'call' ? (Number(raw.duration) || 0) : 0;
  const normalizedCallIsVideo = type === 'call' ? (!!raw.isVideo || raw.mediaType === 'video') : false;
  const reactions = raw.reactions && typeof raw.reactions === 'object' && !Array.isArray(raw.reactions)
    ? normalizeSingleUserReaction(raw.reactions, currentUserId)
    : {};

  return {
    id: raw.id,
    localId: raw.localId || null,
    conversationId: raw.conversationId || raw.convId || null,
    text: normalizedCallPresentation?.label || raw.text || '',
    senderId,
    createdAt: raw.createdAt || new Date().toISOString(),

    replyTo: raw.replyTo || (raw.replyToMessageId ? { messageId: raw.replyToMessageId } : null),
    mentions: Array.isArray(raw.mentions) ? raw.mentions : [],
    reactions,
    deleted: !!raw.deleted,

    protocol: raw.protocol || PLAINTEXT_MESSAGE_PROTOCOL,
    deliveryState: raw.deliveryState || 'sent',
    receiptSummary: raw.receiptSummary || null,
    decryptedLocally: raw.decryptedLocally ?? true,
    ciphertextAvailable: !!raw.ciphertext,
    isLocalOnly: !!raw.isLocalOnly,
    transient: !!raw.transient,
    isOwn: senderId === currentUserId,

    type,
    messageType: type,
    sharedContact: normalizedSharedContact,
    attachment: normalizedAttachment,
    direction: normalizedCallDirection,
    duration: normalizedCallDuration,
    isVideo: normalizedCallIsVideo,
    callKind: normalizedCallKind,
    sessionId: type === 'call' ? (raw.sessionId || null) : null,
    terminalReason: type === 'call' ? (raw.terminalReason || null) : null,

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
  protocol = ENCRYPTED_MESSAGE_PROTOCOL,
  sharedContact = null,
  mentions = [],
}) {
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const normalizedType = resolveSupportedOutgoingMessageType(type);
  const normalizedSharedContact = normalizedType === 'contact' ? sharedContact : null;

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

    protocol,
    deliveryState: 'sending',
    receiptSummary: null,
    decryptedLocally: true,
    ciphertextAvailable: false,
    isLocalOnly: true,
    isOwn: true,

    type: normalizedType,
    messageType: normalizedType,
    sharedContact: normalizedSharedContact,
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

export function getMessageDisplayText(msg) {
  if (!msg) return '';
  if (msg.type === 'contact') {
    return getSharedContactDisplayText(msg.sharedContact);
  }
  if (msg.type === 'attachment') {
    return buildConversationPreviewPresentation(
      { type: 'attachment', attachment: msg.attachment },
      { includeStorageSignal: false }
    ).previewText;
  }
  if (msg.text) return msg.text;
  if (msg.ciphertextAvailable && msg.decryptedLocally === false) return getEncryptedMessageDisplayText();
  return '';
}
