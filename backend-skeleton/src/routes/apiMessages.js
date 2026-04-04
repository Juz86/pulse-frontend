import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';

export const apiMessagesRouter = Router();

apiMessagesRouter.get('/:convId', requireAuth, asyncRoute(async (req, res) => {
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

  const snap = await db
    .collection('messages')
    .where('conversationId', '==', convId)
    .orderBy('createdAt', 'desc')
    .offset(offset)
    .limit(limit)
    .get();

  const items = snap.docs.map((doc) => doc.data()).reverse();
  return res.json(items);
}));

apiMessagesRouter.delete('/:convId/:msgId', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const { convId, msgId } = req.params;

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

  await msgDoc.ref.delete();

  const recipients = await db.collection('message_recipients').where('messageId', '==', msgId).get();
  await Promise.all(recipients.docs.map((doc) => doc.ref.delete()));

  return res.json({ ok: true, deleted: true });
}));
