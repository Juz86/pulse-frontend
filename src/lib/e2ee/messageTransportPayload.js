import { normalizeAttachmentPayload } from './attachmentPayload';

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

export function buildTransportAttachmentPayload(attachment) {
  const normalized = normalizeAttachmentPayload(attachment);
  if (!normalized) return null;

  if (normalized.transfer === 'remote') {
    return {
      ...normalized,
      // Never forward transient local object URLs back into the service transport.
      url: '',
    };
  }

  return normalized;
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
    attachment: scopeError ? null : (messageType === 'attachment' ? buildTransportAttachmentPayload(message.attachment) : null),
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
      attachment: null,
    };
  }

  return {
    plaintext: message.text || '',
    messageType,
    scopeError,
    sharedContact: messageType === 'contact' ? (message.sharedContact || null) : null,
    attachment: scopeError ? null : (messageType === 'attachment' ? buildTransportAttachmentPayload(message.attachment) : null),
  };
}
