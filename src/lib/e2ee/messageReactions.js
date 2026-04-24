export function normalizeSingleUserReaction(reactions = {}, currentUid = null) {
  const nextReactions = {};
  let selectedEmoji = null;

  for (const [emoji, users] of Object.entries(reactions || {})) {
    const userIds = Array.isArray(users) ? Array.from(new Set(users)) : [];
    const hasCurrentUser = currentUid && userIds.includes(currentUid);
    const filteredUserIds = hasCurrentUser
      ? userIds.filter((userId) => userId !== currentUid)
      : userIds;

    if (hasCurrentUser) selectedEmoji = emoji;
    if (filteredUserIds.length > 0) {
      nextReactions[emoji] = filteredUserIds;
    }
  }

  if (currentUid && selectedEmoji) {
    nextReactions[selectedEmoji] = [...(nextReactions[selectedEmoji] || []), currentUid];
  }

  return nextReactions;
}

export function toggleSingleUserReaction(reactions = {}, emoji, currentUid) {
  if (!emoji || !currentUid) return normalizeSingleUserReaction(reactions, currentUid);

  const hadSelectedEmoji = Object.entries(reactions || {}).some(([
    reactionEmoji,
    users,
  ]) => reactionEmoji === emoji && Array.isArray(users) && users.includes(currentUid));
  const nextReactions = normalizeSingleUserReaction(reactions, currentUid);

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
