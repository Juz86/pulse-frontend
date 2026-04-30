const pendingCallsByRecipient = new Map();
const CALL_INVITE_TTL_MS = 35_000;

function getRecipientStore(uid, create = false) {
  if (!uid) return null;
  if (!pendingCallsByRecipient.has(uid) && create) {
    pendingCallsByRecipient.set(uid, new Map());
  }
  return pendingCallsByRecipient.get(uid) || null;
}

export function savePendingCallInvite({ toUid, fromUid, sessionId, offer, isVideo = false, callerName = 'Iemand' }) {
  if (!toUid || !fromUid || !sessionId || !offer) return false;
  const store = getRecipientStore(toUid, true);
  const now = Date.now();
  store.set(sessionId, {
    sessionId,
    toUid,
    fromUid,
    offer,
    isVideo: !!isVideo,
    callerName: callerName || 'Iemand',
    createdAtMs: now,
    expiresAtMs: now + CALL_INVITE_TTL_MS,
  });
  return true;
}

export function getPendingCallInvite({ uid, sessionId, fromUid = null }) {
  const store = getRecipientStore(uid, false);
  if (!store || !sessionId) return null;
  const invite = store.get(sessionId);
  if (!invite) return null;
  if (invite.expiresAtMs <= Date.now()) {
    store.delete(sessionId);
    if (store.size === 0) pendingCallsByRecipient.delete(uid);
    return null;
  }
  if (fromUid && invite.fromUid !== fromUid) return null;
  return invite;
}

export function clearPendingCallInvite({ uid, sessionId }) {
  const store = getRecipientStore(uid, false);
  if (!store || !sessionId) return false;
  const deleted = store.delete(sessionId);
  if (store.size === 0) pendingCallsByRecipient.delete(uid);
  return deleted;
}

export function clearExpiredPendingCallInvites() {
  const now = Date.now();
  let removed = 0;
  for (const [uid, store] of pendingCallsByRecipient.entries()) {
    for (const [sessionId, invite] of store.entries()) {
      if (invite.expiresAtMs <= now) {
        store.delete(sessionId);
        removed += 1;
      }
    }
    if (store.size === 0) {
      pendingCallsByRecipient.delete(uid);
    }
  }
  return removed;
}

export function listPendingCallInvitesForUser(uid) {
  const store = getRecipientStore(uid, false);
  if (!store) return [];
  const now = Date.now();
  const result = [];
  for (const [sessionId, invite] of store.entries()) {
    if (invite.expiresAtMs <= now) {
      store.delete(sessionId);
      continue;
    }
    result.push(invite);
  }
  if (store.size === 0) {
    pendingCallsByRecipient.delete(uid);
  }
  return result;
}
