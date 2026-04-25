import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { applyConversationSummaryFields } from '../services/conversationSummaries.js';
import { purgeExpiredConversationHistory } from '../services/historyRetention.js';
import { shouldHideConversationForUser } from '../services/conversationVisibility.js';

function sortByUpdatedDesc(items) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.lastMessageAt || a.createdAt || 0);
    const bTime = Date.parse(b.updatedAt || b.lastMessageAt || b.createdAt || 0);
    return bTime - aTime;
  });
}

export const conversationsRouter = Router();

conversationsRouter.get('/:uid', requireAuth, asyncRoute(async (req, res) => {
  const requesterUid = req.auth.uid;
  const { uid } = req.params;

  if (requesterUid !== uid) {
    return res.status(403).json({ error: 'not_allowed' });
  }

  const snap = await db
    .collection('conversations')
    .where('members', 'array-contains', uid)
    .get();

  const rows = [];
  for (const doc of snap.docs) {
    const data = { id: doc.id, ...doc.data() };
    const purgeResult = await purgeExpiredConversationHistory({
      convId: doc.id,
      members: data.members || [],
      conversationData: data,
    });
    const nextData = purgeResult.deletedConversation ? null : (purgeResult.conversation || data);
    if (!nextData) {
      continue;
    }

    // Conversation docs already persist last-message summary fields during
    // send/update flows. Reusing them here avoids an extra per-conversation
    // messages query that can fail in production when the required Firestore
    // composite index is missing.
    if (shouldHideConversationForUser(nextData, uid)) {
      continue;
    }

    rows.push(applyConversationSummaryFields(nextData, {
      ...nextData,
      lastMessage: nextData.lastMessage || '',
      lastMessageType: nextData.lastMessageType || null,
    }));
  }
  return res.json(sortByUpdatedDesc(rows));
}));

conversationsRouter.delete('/:convId', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const { convId } = req.params;

  const convDoc = await db.collection('conversations').doc(convId).get();
  if (!convDoc.exists) {
    return res.status(404).json({ error: 'conversation_not_found' });
  }

  const conv = convDoc.data();
  if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
    return res.status(403).json({ error: 'not_allowed_in_conversation' });
  }

  const deletedForUserIds = Array.isArray(conv.deletedForUserIds) ? conv.deletedForUserIds : [];
  const nextDeletedForUserIds = deletedForUserIds.includes(uid)
    ? deletedForUserIds
    : [...deletedForUserIds, uid];

  await convDoc.ref.set({
    deletedForUserIds: nextDeletedForUserIds,
  }, { merge: true });

  return res.json({ ok: true, deleted: true, scope: 'self' });
}));
