import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { applyConversationSummaryFields } from '../services/conversationSummaries.js';
import { purgeExpiredConversationHistory } from '../services/historyRetention.js';

function sortByUpdatedDesc(items) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
    const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
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
    const nextData = purgeResult.conversation || data;

    // Conversation docs already persist last-message summary fields during
    // send/update flows. Reusing them here avoids an extra per-conversation
    // messages query that can fail in production when the required Firestore
    // composite index is missing.
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

  await convDoc.ref.delete();

  const msgSnap = await db.collection('messages').where('conversationId', '==', convId).get();
  await Promise.all(msgSnap.docs.map((doc) => doc.ref.delete()));

  const receiptSnap = await db.collection('message_recipients').where('conversationId', '==', convId).get().catch(() => ({ docs: [] }));
  await Promise.all((receiptSnap.docs || []).map((doc) => doc.ref.delete()));

  return res.json({ ok: true, deleted: true });
}));
