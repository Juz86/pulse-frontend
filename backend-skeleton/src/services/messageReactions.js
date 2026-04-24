export function toggleSingleUserReaction(reactions = {}, emoji, uid) {
  const nextReactions = {};
  let hadSelectedEmoji = false;

  for (const [reactionEmoji, users] of Object.entries(reactions || {})) {
    const userIds = Array.isArray(users) ? users.filter((userId) => userId !== uid) : [];
    if (reactionEmoji === emoji && Array.isArray(users) && users.includes(uid)) {
      hadSelectedEmoji = true;
    }
    if (userIds.length > 0) {
      nextReactions[reactionEmoji] = userIds;
    }
  }

  if (!hadSelectedEmoji) {
    nextReactions[emoji] = [...(nextReactions[emoji] || []), uid];
  }

  return nextReactions;
}
