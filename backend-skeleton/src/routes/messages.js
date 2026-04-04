import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { canTargetRecipientDevice, canUseSenderDevice } from '../services/deviceValidation.js';
import { computeDeliveryState, toSocketStatus } from '../services/messageReceipts.js';
import { filterVisibleMessages } from '../services/messageVisibility.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';

function deriveMockPreview({ ciphertext, protocol, messageType }) {
  if (messageType === 'contact') return 'Contactpersoon gedeeld';
  if (messageType && messageType !== 'text') return 'Nieuw bericht';
  if (protocol !== 'signal_v1' || !ciphertext) return '';

  try {
    return Buffer.from(ciphertext, 'base64').toString('utf8') || 'Versleuteld bericht';
  } catch {
    return 'Versleuteld bericht';
  }
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

    await messageRef.set({
      id: messageRef.id,
      conversationId,
      senderUserId: uid,
      senderDeviceId,
      ciphertext,
      messageType: messageType || 'text',
      sharedContact: req.body?.sharedContact || null,
      protocol: protocol || 'signal_v1',
      protocolVersion: protocolVersion || 1,
      replyToMessageId: replyToMessageId || null,
      createdAt,
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

      emitToUser(io, payload.recipientUserId, 'message:new', {
        id: messageRef.id,
        conversationId,
        senderUserId: uid,
        senderDeviceId,
        ciphertext,
        encryptedMessageKey: payload.encryptedMessageKey,
        createdAt,
        protocol: protocol || 'signal_v1',
        protocolVersion: protocolVersion || 1,
        messageType: messageType || 'text',
        sharedContact: req.body?.sharedContact || null,
        replyToMessageId: replyToMessageId || null,
      });
    }

    const conversationPreview = deriveMockPreview({
      ciphertext,
      protocol: protocol || 'signal_v1',
      messageType: messageType || 'text',
    });

    await db.collection('conversations').doc(conversationId).set(
      {
        updatedAt: createdAt,
        lastMessage: conversationPreview || ((protocol || 'signal_v1') === 'signal_v1' ? 'Versleuteld bericht' : ''),
      },
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
      return res.status(404).json({ error: 'receipt_target_not_found' });
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

      const deliveryState = computeDeliveryState(allReceiptsSnap.docs.map((item) => item.data()));
      const socketStatus = toSocketStatus(deliveryState);

      await messageDoc.ref.set(
        {
          deliveryState,
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
        });
      }
    }

    return res.json({ ok: true });
  }));

  router.get('/feed/:convId', requireAuth, asyncRoute(async (req, res) => {
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

    const items = filterVisibleMessages(
      snap.docs.map((doc) => doc.data()).reverse(),
      uid
    );
    return res.json(items);
  }));

  return router;
}
