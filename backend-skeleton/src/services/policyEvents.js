import { db } from './firestore.js';

export async function logPolicyEvent({
  actorUid,
  childUid = null,
  targetUid = null,
  action,
  allowed = true,
  reason = null,
  conversationId = null,
  metadata = null,
}) {
  await db.collection('policy_events').add({
    actorUid,
    childUid,
    targetUid,
    action,
    allowed,
    reason,
    conversationId,
    metadata,
    createdAt: new Date().toISOString(),
  });
}
