import { normalizeAttachmentPayload } from './attachmentPayload';

export function getStructuredMessageType(message) {
  return message?.type || message?.messageType || 'text';
}

export function buildRetryServicePayload(message = {}) {
  const messageType = getStructuredMessageType(message);

  return {
    plaintext: message.text || '',
    messageType,
    replyToMessageId: message.replyTo?.messageId || message.replyTo?.id || null,
    sharedContact: messageType === 'contact' ? (message.sharedContact || null) : null,
    attachment: messageType === 'attachment' ? normalizeAttachmentPayload(message.attachment) : null,
  };
}

export function buildForwardServicePayload(message = {}) {
  const messageType = getStructuredMessageType(message);

  if (messageType === 'text') {
    return {
      plaintext: `↪️ ${message.text || ''}`,
      messageType: 'text',
      sharedContact: null,
      attachment: null,
    };
  }

  return {
    plaintext: message.text || '',
    messageType,
    sharedContact: messageType === 'contact' ? (message.sharedContact || null) : null,
    attachment: messageType === 'attachment' ? normalizeAttachmentPayload(message.attachment) : null,
  };
}

