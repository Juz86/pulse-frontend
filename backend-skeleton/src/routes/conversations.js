import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';

function deriveConversationPreview(message, fallback = '') {
  if (!message) return fallback;
  if (message.text) return message.text;
  if (message.messageType === 'contact') return 'Contactpersoon gedeeld';
  if (message.messageType && message.messageType !== 'text') return 'Nieuw bericht';
  if (message.protocol === 'signal_v1' && message.ciphertext) {
    try {
      return Buffer.from(message.ciphertext, 'base64').toString('utf8') || fallback || 'Versleuteld bericht';
    } catch {
      return fallback || 'Versleuteld bericht';
    }
  }
  return fallback;
}

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

  const rows = await Promise.all(
    snap.docs.map(async (doc) => {
      const data = { id: doc.id, ...doc.data() };
      const latestMsgSnap = await db
        .collection('messages')
        .where('conversationId', '==', doc.id)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      const latestMessage = latestMsgSnap.empty ? null : latestMsgSnap.docs[0].data();
      return {
        ...data,
        lastMessage: deriveConversationPreview(latestMessage, data.lastMessage || ''),
      };
    })
  );
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
