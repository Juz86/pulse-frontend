import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { applyConversationSummaryFields, deriveConversationSummary } from '../services/conversationSummaries.js';
import { filterVisibleMessages } from '../services/messageVisibility.js';

export function apiMessagesRouter({ io, emitToUser }) {
const router = Router();

function isMissingFirestoreIndexError(error) {
  const message = String(error?.message || '');
  return error?.code === 9 || message.includes('FAILED_PRECONDITION') || message.includes('requires an index');
}

function sortMessagesByCreatedAtDesc(items = []) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a?.createdAt || 0);
    const bTime = Date.parse(b?.createdAt || 0);
    return bTime - aTime;
  });
}

router.get('/:convId', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const { convId } = req.params;
  const limit = Number(req.query.limit || 30);
  const offset = Number(req.query.offset || 0);

  const convDoc = await db.collection('conversations').doc(convId).get();
  if (!convDoc.exists) {
    return res.status(404).json({ error: 'conversation_not_found' });
  }

  const conv = convDoc.data();
  if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
    return res.status(403).json({ error: 'not_allowed_in_conversation' });
  }

  let messageRows = [];

  try {
    const snap = await db
      .collection('messages')
      .where('conversationId', '==', convId)
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    messageRows = snap.docs.map((doc) => doc.data()).reverse();
  } catch (error) {
    if (!isMissingFirestoreIndexError(error)) {
      throw error;
    }

    const fallbackSnap = await db
      .collection('messages')
      .where('conversationId', '==', convId)
      .get();

    const sorted = sortMessagesByCreatedAtDesc(
      fallbackSnap.docs.map((doc) => doc.data())
    );
    messageRows = sorted.slice(offset, offset + limit).reverse();
  }

  const items = filterVisibleMessages(messageRows, uid);
  return res.json(items);
}));

router.delete('/:convId/:msgId', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const { convId, msgId } = req.params;
  const scope = req.query.scope === 'all' ? 'all' : 'self';

  const convDoc = await db.collection('conversations').doc(convId).get();
  if (!convDoc.exists) {
    return res.status(404).json({ error: 'conversation_not_found' });
  }

  const conv = convDoc.data();
  if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
    return res.status(403).json({ error: 'not_allowed_in_conversation' });
  }

  const msgDoc = await db.collection('messages').doc(msgId).get();
  if (!msgDoc.exists) {
    return res.status(404).json({ error: 'message_not_found' });
  }

  const msg = msgDoc.data();
  if (msg.conversationId !== convId) {
    return res.status(400).json({ error: 'message_conversation_mismatch' });
  }

  if (scope === 'self') {
    const deletedForUserIds = Array.isArray(msg.deletedForUserIds) ? msg.deletedForUserIds : [];
    const nextDeletedForUserIds = deletedForUserIds.includes(uid)
      ? deletedForUserIds
      : [...deletedForUserIds, uid];

    await msgDoc.ref.set(
      {
        deletedForUserIds: nextDeletedForUserIds,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    emitToUser(io, uid, 'message:deleted', { msgId, convId, scope: 'self' });
    return res.json({ ok: true, deleted: true, scope: 'self' });
  }

  if (msg.senderUserId !== uid) {
    return res.status(403).json({ error: 'not_allowed_to_delete_for_all' });
  }

  await msgDoc.ref.delete();

  const recipients = await db.collection('message_recipients').where('messageId', '==', msgId).get();
  await Promise.all(recipients.docs.map((doc) => doc.ref.delete()));

  let latestVisibleRows = [];

  try {
    const latestVisibleSnap = await db
      .collection('messages')
      .where('conversationId', '==', convId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    latestVisibleRows = latestVisibleSnap.docs.map((doc) => doc.data());
  } catch (error) {
    if (!isMissingFirestoreIndexError(error)) {
      throw error;
    }

    const fallbackSnap = await db
      .collection('messages')
      .where('conversationId', '==', convId)
      .get();

    latestVisibleRows = sortMessagesByCreatedAtDesc(
      fallbackSnap.docs.map((doc) => doc.data())
    ).slice(0, 20);
  }

  const latestVisible = filterVisibleMessages(latestVisibleRows, null)[0] || null;

  await db.collection('conversations').doc(convId).set(
    applyConversationSummaryFields(
      { updatedAt: new Date().toISOString() },
      deriveConversationSummary(latestVisible, '')
    ),
    { merge: true }
  );

  for (const memberUid of conv.members) {
    emitToUser(io, memberUid, 'message:deleted', { msgId, convId, scope: 'all' });
  }

  return res.json({ ok: true, deleted: true, scope: 'all' });
}));

return router;
}
