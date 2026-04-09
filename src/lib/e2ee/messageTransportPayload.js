import { getSharedContactDisplayText } from './messageCopy';
import { ACTIVE_OUTGOING_MESSAGE_TYPES } from './messageTypeConstants';

export const OUTGOING_ATTACHMENT_SCOPE_ERROR = 'Bijlagen versturen is niet beschikbaar in Pulse.';
export const SOCKET_FALLBACK_PROTOCOL = 'legacy_plaintext';

export function getStructuredMessageType(message) {
  return message?.type || message?.messageType || 'text';
}

export function isSupportedOutgoingMessageType(messageType = 'text') {
  return ACTIVE_OUTGOING_MESSAGE_TYPES.includes(messageType);
}

export function resolveSupportedOutgoingMessageType(messageType = 'text') {
  return isSupportedOutgoingMessageType(messageType) ? messageType : 'text';
}

export function getOutgoingMessageScopeError(messageType = 'text') {
  return isSupportedOutgoingMessageType(messageType)
    ? ''
    : OUTGOING_ATTACHMENT_SCOPE_ERROR;
}

export function resolveOutgoingMessageDisplayText({
  plaintext = '',
  messageType = 'text',
  sharedContact = null,
} = {}) {
  return resolveSupportedOutgoingMessageType(messageType) === 'contact'
    ? getSharedContactDisplayText(sharedContact)
    : plaintext;
}

export function buildRetryServicePayload(message = {}) {
  const messageType = getStructuredMessageType(message);
  const scopeError = getOutgoingMessageScopeError(messageType);

  return {
    plaintext: resolveOutgoingMessageDisplayText({
      plaintext: message.text || '',
      messageType,
      sharedContact: message.sharedContact || null,
    }),
    messageType,
    scopeError,
    replyToMessageId: message.replyTo?.messageId || message.replyTo?.id || null,
    sharedContact: messageType === 'contact' ? (message.sharedContact || null) : null,
  };
}

export function buildForwardServicePayload(message = {}) {
  const messageType = getStructuredMessageType(message);
  const scopeError = getOutgoingMessageScopeError(messageType);

  if (messageType === 'text') {
    return {
      plaintext: `↪️ ${message.text || ''}`,
      messageType: 'text',
      scopeError: '',
      sharedContact: null,
    };
  }

  return {
    plaintext: resolveOutgoingMessageDisplayText({
      plaintext: message.text || '',
      messageType,
      sharedContact: message.sharedContact || null,
    }),
    messageType,
    scopeError,
    sharedContact: messageType === 'contact' ? (message.sharedContact || null) : null,
  };
}

export function buildSocketMessagePayload({
  conversationId,
  senderId,
  senderName,
  senderDeviceId = null,
  plaintext = '',
  messageType = 'text',
  sharedContact = null,
  createdAt = new Date().toISOString(),
  replyTo = null,
  mentions = [],
} = {}) {
  const resolvedMessageType = resolveSupportedOutgoingMessageType(messageType);

  return {
    convId: conversationId,
    senderId,
    senderName,
    text: resolveOutgoingMessageDisplayText({ plaintext, messageType, sharedContact }),
    createdAt,
    // Socket fallback carries plaintext UI content, so recipients should not treat it
    // as an undecryptable Signal envelope.
    protocol: SOCKET_FALLBACK_PROTOCOL,
    senderDeviceId,
    type: resolvedMessageType,
    messageType: resolvedMessageType,
    ...(replyTo ? { replyTo } : {}),
    ...(mentions.length > 0 ? { mentions } : {}),
    ...(resolvedMessageType === 'contact' ? { sharedContact: sharedContact || null } : {}),
  };
}

export function buildServiceMessageResult({
  messageId,
  conversationId,
  senderId,
  senderDeviceId = null,
  plaintext = '',
  messageType = 'text',
  sharedContact = null,
  replyToMessageId = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const resolvedMessageType = resolveSupportedOutgoingMessageType(messageType);

  return {
    id: messageId,
    conversationId,
    senderId,
    senderUserId: senderId,
    senderDeviceId,
    text: resolveOutgoingMessageDisplayText({ plaintext, messageType, sharedContact }),
    createdAt,
    protocol: 'signal_v1',
    deliveryState: 'sent',
    replyToMessageId,
    type: resolvedMessageType,
    messageType: resolvedMessageType,
    ...(resolvedMessageType === 'contact' ? { sharedContact: sharedContact || null } : {}),
  };
}
