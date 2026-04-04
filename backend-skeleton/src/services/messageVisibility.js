export function shouldHideMessageForUser(message = {}, uid) {
  if (!message) return true;
  if (message.deleted === true) return true;
  if (!uid) return false;

  return Array.isArray(message.deletedForUserIds) && message.deletedForUserIds.includes(uid);
}

export function filterVisibleMessages(messages = [], uid) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((message) => !shouldHideMessageForUser(message, uid));
}

export function toConversationPreview(message = {}) {
  if (!message || message.deleted === true) return '';
  if ((message.protocol || 'signal_v1') === 'signal_v1') return 'Versleuteld bericht';
  return message.text || '';
}
