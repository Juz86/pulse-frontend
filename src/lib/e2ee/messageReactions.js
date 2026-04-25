export function normalizeSingleUserReaction(reactions = {}, currentUid = null) {
  void currentUid;
  const latestEmojiByUserId = new Map();

  for (const [emoji, users] of Object.entries(reactions || {})) {
    const userIds = Array.isArray(users) ? Array.from(new Set(users)) : [];
    for (const userId of userIds) {
      if (!userId) continue;
      latestEmojiByUserId.set(userId, emoji);
    }
  }

  const nextReactions = {};
  for (const [emoji, users] of Object.entries(reactions || {})) {
    const userIds = Array.isArray(users) ? Array.from(new Set(users)) : [];
    for (const userId of userIds) {
      if (latestEmojiByUserId.get(userId) !== emoji) continue;
      nextReactions[emoji] = [...(nextReactions[emoji] || []), userId];
    }
  }

  return nextReactions;
}

export function toggleSingleUserReaction(reactions = {}, emoji, currentUid) {
  if (!emoji || !currentUid) return normalizeSingleUserReaction(reactions, currentUid);

  const normalizedReactions = normalizeSingleUserReaction(reactions, currentUid);
  const hadSelectedEmoji = Object.entries(normalizedReactions).some(([
    reactionEmoji,
    users,
  ]) => reactionEmoji === emoji && Array.isArray(users) && users.includes(currentUid));
  const nextReactions = { ...normalizedReactions };

  for (const [reactionEmoji, users] of Object.entries(nextReactions)) {
    if (!Array.isArray(users)) continue;
    const filteredUserIds = users.filter((userId) => userId !== currentUid);
    if (filteredUserIds.length > 0) nextReactions[reactionEmoji] = filteredUserIds;
    else delete nextReactions[reactionEmoji];
  }

  if (!hadSelectedEmoji) {
    nextReactions[emoji] = [...(nextReactions[emoji] || []), currentUid];
  }

  return nextReactions;
}
