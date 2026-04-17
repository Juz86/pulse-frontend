import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { canTargetRecipientDevice, canUseSenderDevice } from '../services/deviceValidation.js';
import { computeHistoryExpiresAt, purgeExpiredConversationHistory, resolveConversationRetentionDays } from '../services/historyRetention.js';
import { computeDeliveryState, computeReceiptSummary, toSocketStatus } from '../services/messageReceipts.js';
import { filterVisibleMessages } from '../services/messageVisibility.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';
import { applyConversationSummaryFields, deriveConversationSummary } from '../services/conversationSummaries.js';

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

async function attachRecipientKeysForUser(messages = [], uid, preferredDeviceId = null) {
  const encryptedMessages = messages.filter((message) => message?.id && message?.protocol);
  if (encryptedMessages.length === 0) return messages;

  const keysByMessageId = new Map();

  await Promise.all(encryptedMessages.map(async (message) => {
    const snap = await db
      .collection('message_recipients')
      .where('messageId', '==', message.id)
      .where('recipientUserId', '==', uid)
      .get();

    if (snap.empty) return;
    const records = snap.docs.map((doc) => doc.data());
    const preferred = preferredDeviceId
      ? records.find((record) => record.recipientDeviceId === preferredDeviceId)
      : null;
    const selected = preferred || records[0];
    if (selected?.encryptedMessageKey) {
      keysByMessageId.set(message.id, selected.encryptedMessageKey);
    }
  }));

  return messages.map((message) => (
    keysByMessageId.has(message.id)
      ? { ...message, encryptedMessageKey: keysByMessageId.get(message.id) }
      : message
  ));
}

export function messagesRouter({ io, emitToUser }) {
  const router = Router();

  router.post('/send', requireAuth, asyncRoute(async (req, res) => {
    const uid = req.auth.uid;
    const {
      conversationId,
      senderDeviceId,
      ciphertext,
      messageType,
      mentions,
      protocol,
      protocolVersion,
      replyToMessageId,
      recipientPayloads,
    } = req.body || {};

    if (!conversationId || !senderDeviceId || !ciphertext || !Array.isArray(recipientPayloads)) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    const convDoc = await db.collection('conversations').doc(conversationId).get();
    if (!convDoc.exists) {
      return res.status(404).json({ error: 'conversation_not_found' });
    }

    const conv = convDoc.data();
    if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
      return res.status(403).json({ error: 'not_allowed_in_conversation' });
    }

    const senderDeviceDoc = await db.collection('devices').doc(senderDeviceId).get();
    if (!senderDeviceDoc.exists) {
      return res.status(404).json({ error: 'sender_device_not_found' });
    }

    if (!canUseSenderDevice(senderDeviceDoc.data(), uid)) {
      return res.status(403).json({ error: 'invalid_sender_device' });
    }

    const uniqueRecipientUserIds = Array.from(new Set(
      recipientPayloads.map((payload) => payload.recipientUserId).filter(Boolean)
    ));

    for (const payload of recipientPayloads) {
      const recipientDeviceDoc = await db.collection('devices').doc(payload.recipientDeviceId).get();
      if (!recipientDeviceDoc.exists) {
        return res.status(404).json({ error: 'recipient_device_not_found' });
      }

      if (!canTargetRecipientDevice(recipientDeviceDoc.data(), payload.recipientUserId)) {
        return res.status(403).json({ error: 'invalid_recipient_device' });
      }

      const decision = await parentPolicyService.maySendMessage(
        uid,
        conversationId,
        payload.recipientUserId
      );

      if (!decision.allowed) {
        await logPolicyEvent({
          actorUid: uid,
          targetUid: payload.recipientUserId,
          action: 'send_message',
          allowed: false,
          reason: decision.reason || 'send_not_allowed',
          conversationId,
        });
        return res.status(403).json({ error: decision.reason || 'send_not_allowed' });
      }
    }

    const messageRef = db.collection('messages').doc();
    const createdAt = new Date().toISOString();
    const retentionDays = await resolveConversationRetentionDays(conv.members || []);
    const expiresAt = computeHistoryExpiresAt(createdAt, retentionDays);

    await messageRef.set({
      id: messageRef.id,
      conversationId,
      senderUserId: uid,
      senderDeviceId,
      ciphertext,
      messageType: messageType || 'text',
      sharedContact: req.body?.sharedContact || null,
      attachment: req.body?.attachment || null,
      mentions: Array.isArray(mentions) ? mentions : [],
      protocol: protocol || 'signal_v1',
      protocolVersion: protocolVersion || 1,
      replyToMessageId: replyToMessageId || null,
      createdAt,
      expiresAt,
      deliveryState: 'sent',
    });

    for (const payload of recipientPayloads) {
      await db.collection('message_recipients').add({
        messageId: messageRef.id,
        recipientUserId: payload.recipientUserId,
        recipientDeviceId: payload.recipientDeviceId,
        encryptedMessageKey: payload.encryptedMessageKey,
        deliveredAt: null,
        readAt: null,
      });
    }

    for (const recipientUserId of uniqueRecipientUserIds) {
      const firstPayload = recipientPayloads.find((payload) => payload.recipientUserId === recipientUserId);

      emitToUser(io, recipientUserId, 'message:new', {
        id: messageRef.id,
        conversationId,
        senderUserId: uid,
        senderDeviceId,
        ciphertext,
        encryptedMessageKey: firstPayload?.encryptedMessageKey || null,
        createdAt,
        protocol: protocol || 'signal_v1',
        protocolVersion: protocolVersion || 1,
        messageType: messageType || 'text',
        sharedContact: req.body?.sharedContact || null,
        attachment: req.body?.attachment || null,
        mentions: Array.isArray(mentions) ? mentions : [],
        replyToMessageId: replyToMessageId || null,
      });
    }

    if (Array.isArray(conv.members) && conv.isGroup && Array.isArray(mentions) && mentions.length > 0) {
      const uniqueMentions = Array.from(new Set(
        mentions.filter((mentionedUid) => mentionedUid && mentionedUid !== uid && conv.members.includes(mentionedUid))
      ));

      for (const mentionedUid of uniqueMentions) {
        emitToUser(io, mentionedUid, 'mention:notify', {
          convId: conversationId,
          senderUid: uid,
          senderName: conv.memberNames?.[uid] || uid,
          groupName: conv.groupName || 'Groep',
          messageId: messageRef.id,
        });
      }
    }

    const summary = deriveConversationSummary({
      ciphertext,
      sharedContact: req.body?.sharedContact || null,
      attachment: req.body?.attachment || null,
      protocol: protocol || 'signal_v1',
      messageType: messageType || 'text',
    });

    await db.collection('conversations').doc(conversationId).set(
      applyConversationSummaryFields({ updatedAt: createdAt }, summary),
      { merge: true }
    );

    return res.json({
      messageId: messageRef.id,
      accepted: true,
    });
  }));

  router.post('/receipt', requireAuth, asyncRoute(async (req, res) => {
    const uid = req.auth.uid;
    const { messageId, recipientDeviceId, type } = req.body || {};

    if (!messageId || !recipientDeviceId || !['delivered', 'read'].includes(type)) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    const snap = await db
      .collection('message_recipients')
      .where('messageId', '==', messageId)
      .where('recipientUserId', '==', uid)
      .where('recipientDeviceId', '==', recipientDeviceId)
      .get();

    if (snap.empty) {
      return res.json({
        ok: true,
        skipped: true,
        reason: 'receipt_target_not_found',
      });
    }

    const recipientDeviceDoc = await db.collection('devices').doc(recipientDeviceId).get();
    if (!recipientDeviceDoc.exists) {
      return res.status(404).json({ error: 'recipient_device_not_found' });
    }

    if (!canUseSenderDevice(recipientDeviceDoc.data(), uid)) {
      return res.status(403).json({ error: 'invalid_recipient_device' });
    }

    const doc = snap.docs[0];
    const data = doc.data();
    const now = new Date().toISOString();

    await doc.ref.update({
      deliveredAt: type === 'delivered' ? now : data.deliveredAt || null,
      readAt: type === 'read' ? now : data.readAt || null,
    });

    const messageDoc = await db.collection('messages').doc(messageId).get();
    if (messageDoc.exists) {
      const message = messageDoc.data();
      const allReceiptsSnap = await db
        .collection('message_recipients')
        .where('messageId', '==', messageId)
        .get();

      const receiptRecords = allReceiptsSnap.docs.map((item) => item.data());
      const deliveryState = computeDeliveryState(receiptRecords);
      const receiptSummary = computeReceiptSummary(receiptRecords);
      const socketStatus = toSocketStatus(deliveryState);

      await messageDoc.ref.set(
        {
          deliveryState,
          receiptSummary,
          updatedAt: now,
        },
        { merge: true }
      );

      if (socketStatus && message?.senderUserId) {
        emitToUser(io, message.senderUserId, 'message:status', {
          convId: message.conversationId,
          msgId: messageId,
          status: socketStatus,
          deliveryState,
          receiptSummary,
        });
      }
    }

    return res.json({ ok: true });
  }));

  router.post('/react', requireAuth, asyncRoute(async (req, res) => {
    const uid = req.auth.uid;
    const { conversationId, msgId, emoji } = req.body || {};

    if (!conversationId || !msgId || !emoji) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    const convDoc = await db.collection('conversations').doc(conversationId).get();
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

    const message = msgDoc.data();
    if (message.conversationId !== conversationId) {
      return res.status(400).json({ error: 'message_conversation_mismatch' });
    }

    const reactions = { ...(message.reactions || {}) };
    const existingUsers = new Set(Array.isArray(reactions[emoji]) ? reactions[emoji] : []);

    if (existingUsers.has(uid)) existingUsers.delete(uid);
    else existingUsers.add(uid);

    reactions[emoji] = Array.from(existingUsers);
    if (reactions[emoji].length === 0) delete reactions[emoji];

    await msgDoc.ref.set({ reactions }, { merge: true });

    for (const memberUid of conv.members) {
      emitToUser(io, memberUid, 'message:reaction', { convId: conversationId, msgId, reactions });
    }

    return res.json({ ok: true, reactions });
  }));

  router.get('/feed/:convId', requireAuth, asyncRoute(async (req, res) => {
    const uid = req.auth.uid;
    const { convId } = req.params;
    const limit = Number(req.query.limit || 30);
    const offset = Number(req.query.offset || 0);
    const preferredDeviceId = req.query.deviceId || null;

    const convDoc = await db.collection('conversations').doc(convId).get();
    if (!convDoc.exists) {
      return res.status(404).json({ error: 'conversation_not_found' });
    }

    const conv = convDoc.data();
    if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
      return res.status(403).json({ error: 'not_allowed_in_conversation' });
    }

    await purgeExpiredConversationHistory({
      convId,
      members: conv.members || [],
      conversationData: { id: convId, ...conv },
    });

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

    const items = await attachRecipientKeysForUser(filterVisibleMessages(messageRows, uid), uid, preferredDeviceId);
    return res.json(items);
  }));

  return router;
}
