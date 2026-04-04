export function canEditMessage(message = {}, actorUid) {
  if (!message || !actorUid) {
    return { allowed: false, reason: 'message_not_found' };
  }

  if (message.senderUserId !== actorUid && message.senderId !== actorUid) {
    return { allowed: false, reason: 'not_allowed_to_edit' };
  }

  if ((message.protocol || 'signal_v1') === 'signal_v1') {
    return { allowed: false, reason: 'encrypted_messages_cannot_be_edited' };
  }

  if (message.deleted === true) {
    return { allowed: false, reason: 'message_deleted' };
  }

  return { allowed: true };
}

export function normalizeEditedText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
