export function shouldHideConversationForUser(conversation = {}, uid) {
  if (!conversation) return true;
  if (!uid) return false;

  return Array.isArray(conversation.deletedForUserIds) && conversation.deletedForUserIds.includes(uid);
}

export function filterVisibleConversations(conversations = [], uid) {
  if (!Array.isArray(conversations)) return [];
  return conversations.filter((conversation) => !shouldHideConversationForUser(conversation, uid));
}
