function parseClearCutoffMs(uid, options = {}) {
  if (!uid || !options) return null;
  const rawCutoff = options.clearedAt
    ?? options?.clearedAtByUid?.[uid]
    ?? options?.conversation?.clearedForUserAt?.[uid]
    ?? null;
  if (!rawCutoff) return null;
  const parsed = Date.parse(String(rawCutoff));
  return Number.isFinite(parsed) ? parsed : null;
}

export function shouldHideMessageForUser(message = {}, uid, options = {}) {
  if (!message) return true;
  if (message.deleted === true) return true;
  if (!uid) return false;

  const deletedForUser = Array.isArray(message.deletedForUserIds) && message.deletedForUserIds.includes(uid);
  if (deletedForUser) return true;

  const clearCutoffMs = parseClearCutoffMs(uid, options);
  if (!Number.isFinite(clearCutoffMs)) return false;
  const messageCreatedAtMs = Date.parse(String(message?.createdAt || ''));
  if (!Number.isFinite(messageCreatedAtMs)) return false;

  return messageCreatedAtMs <= clearCutoffMs;
}

export function filterVisibleMessages(messages = [], uid, options = {}) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((message) => !shouldHideMessageForUser(message, uid, options));
}
