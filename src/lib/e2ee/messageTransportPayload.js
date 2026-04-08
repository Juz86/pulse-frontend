export const OUTGOING_ATTACHMENT_SCOPE_ERROR = 'Bijlagen versturen is niet beschikbaar in Pulse.';

export function getStructuredMessageType(message) {
  return message?.type || message?.messageType || 'text';
}

export function isSupportedOutgoingMessageType(messageType = 'text') {
  return messageType === 'text' || messageType === 'contact';
}

export function getOutgoingMessageScopeError(messageType = 'text') {
  return isSupportedOutgoingMessageType(messageType)
    ? ''
    : OUTGOING_ATTACHMENT_SCOPE_ERROR;
}

export function buildRetryServicePayload(message = {}) {
  const messageType = getStructuredMessageType(message);
  const scopeError = getOutgoingMessageScopeError(messageType);

  return {
    plaintext: message.text || '',
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
    plaintext: message.text || '',
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
  const resolvedMessageType = isSupportedOutgoingMessageType(messageType) ? messageType : 'text';

  return {
    convId: conversationId,
    senderId,
    senderName,
    text: plaintext,
    createdAt,
    protocol: 'signal_v1',
    senderDeviceId,
    type: resolvedMessageType,
    messageType: resolvedMessageType,
    ...(replyTo ? { replyTo } : {}),
    ...(mentions.length > 0 ? { mentions } : {}),
    ...(resolvedMessageType === 'contact' ? { sharedContact: sharedContact || null } : {}),
  };
}
