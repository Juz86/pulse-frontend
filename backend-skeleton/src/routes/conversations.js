import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';

function deriveConversationSummary(message, fallback = '') {
  if (!message) {
    return {
      lastMessage: fallback,
      lastMessageType: null,
      lastAttachmentTransfer: null,
      lastAttachmentEncoding: null,
      lastAttachmentOriginalMimeType: null,
      lastAttachmentExpectedPayloadSha256: null,
    };
  }

  if (message.text) {
    return {
      lastMessage: message.text,
      lastMessageType: message.messageType || 'text',
      lastAttachmentTransfer: message.messageType === 'attachment' ? (message.attachment?.transfer || null) : null,
      lastAttachmentEncoding: message.messageType === 'attachment' ? (message.attachment?.contentEncoding || null) : null,
      lastAttachmentOriginalMimeType: message.messageType === 'attachment' ? (message.attachment?.originalMimeType || message.attachment?.mimeType || null) : null,
      lastAttachmentExpectedPayloadSha256: message.messageType === 'attachment' ? (message.attachment?.expectedPayloadSha256 || message.attachment?.encryption?.sha256 || null) : null,
    };
  }

  if (message.messageType === 'contact') {
    return {
      lastMessage: 'Contactpersoon gedeeld',
      lastMessageType: 'contact',
      lastAttachmentTransfer: null,
      lastAttachmentEncoding: null,
      lastAttachmentOriginalMimeType: null,
      lastAttachmentExpectedPayloadSha256: null,
    };
  }

  if (message.messageType === 'attachment') {
    return {
      lastMessage: 'Bijlage gedeeld',
      lastMessageType: 'attachment',
      lastAttachmentTransfer: message.attachment?.transfer || null,
      lastAttachmentEncoding: message.attachment?.contentEncoding || null,
      lastAttachmentOriginalMimeType: message.attachment?.originalMimeType || message.attachment?.mimeType || null,
      lastAttachmentExpectedPayloadSha256: message.attachment?.expectedPayloadSha256 || message.attachment?.encryption?.sha256 || null,
    };
  }

  if (message.messageType && message.messageType !== 'text') {
    return {
      lastMessage: 'Nieuw bericht',
      lastMessageType: message.messageType,
      lastAttachmentTransfer: null,
      lastAttachmentEncoding: null,
      lastAttachmentOriginalMimeType: null,
      lastAttachmentExpectedPayloadSha256: null,
    };
  }

  if (message.protocol === 'signal_v1' && message.ciphertext) {
    try {
      return {
        lastMessage: Buffer.from(message.ciphertext, 'base64').toString('utf8') || fallback || 'Versleuteld bericht',
        lastMessageType: message.messageType || 'text',
        lastAttachmentTransfer: null,
        lastAttachmentEncoding: null,
        lastAttachmentOriginalMimeType: null,
        lastAttachmentExpectedPayloadSha256: null,
      };
    } catch {
      return {
        lastMessage: fallback || 'Versleuteld bericht',
        lastMessageType: message.messageType || 'text',
        lastAttachmentTransfer: null,
        lastAttachmentEncoding: null,
        lastAttachmentOriginalMimeType: null,
        lastAttachmentExpectedPayloadSha256: null,
      };
    }
  }

  return {
    lastMessage: fallback,
    lastMessageType: message.messageType || null,
    lastAttachmentTransfer: null,
    lastAttachmentEncoding: null,
    lastAttachmentOriginalMimeType: null,
    lastAttachmentExpectedPayloadSha256: null,
  };
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
      const summary = deriveConversationSummary(latestMessage, data.lastMessage || '');
      return {
        ...data,
        lastMessage: summary.lastMessage,
        lastMessageType: summary.lastMessageType,
        lastAttachmentTransfer: summary.lastAttachmentTransfer,
        lastAttachmentEncoding: summary.lastAttachmentEncoding,
        lastAttachmentOriginalMimeType: summary.lastAttachmentOriginalMimeType,
        lastAttachmentExpectedPayloadSha256: summary.lastAttachmentExpectedPayloadSha256,
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
