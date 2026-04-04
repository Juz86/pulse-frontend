import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';

const MAX_REMINDERS = 3;

function toPendingRequestResponse(request) {
  const reminderCount = Number(request?.reminderCount || 0);
  return {
    requestId: request.id,
    toUid: request.toUid,
    reminderCount,
    remindersRemaining: Math.max(0, MAX_REMINDERS - reminderCount),
    canSendReminder: reminderCount < MAX_REMINDERS,
    canCancel: true,
  };
}

export function friendRequestsRouter({ io, emitToUser }) {
  const router = Router();

  router.get('/:uid', requireAuth, asyncRoute(async (req, res) => {
    const requesterUid = req.auth.uid;
    const { uid } = req.params;

    if (requesterUid !== uid) {
      return res.status(403).json({ error: 'not_allowed' });
    }

    const snap = await db
      .collection('friend_requests')
      .where('toUid', '==', uid)
      .where('status', '==', 'pending')
      .get();

    return res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }));

  router.get('/:uid/sent', requireAuth, asyncRoute(async (req, res) => {
    const requesterUid = req.auth.uid;
    const { uid } = req.params;

    if (requesterUid !== uid) {
      return res.status(403).json({ error: 'not_allowed' });
    }

    const snap = await db
      .collection('friend_requests')
      .where('fromUid', '==', uid)
      .where('status', '==', 'pending')
      .get();

    return res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }));

  router.post('/', requireAuth, asyncRoute(async (req, res) => {
    const requesterUid = req.auth.uid;
    const {
      fromUid,
      fromName,
      fromEmail,
      fromPhoto,
      toEmail,
      toIdentifier,
    } = req.body || {};

    if (!fromUid || requesterUid !== fromUid || !toEmail) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    const usersSnap = await db.collection('users').where('email', '==', toEmail).limit(1).get();
    if (usersSnap.empty) {
      return res.status(404).json({ error: 'Doelgebruiker niet gevonden.' });
    }

    const targetDoc = usersSnap.docs[0];
    const target = targetDoc.data();
    const toUid = target.uid || targetDoc.id;

    if (toUid === fromUid) {
      return res.status(400).json({ error: 'Je kunt jezelf niet toevoegen.' });
    }

    const senderContactRef = db.collection('users').doc(fromUid).collection('contacts').doc(toUid);
    const recipientContactRef = db.collection('users').doc(toUid).collection('contacts').doc(fromUid);
    const [senderContactDoc, recipientContactDoc] = await Promise.all([
      senderContactRef.get(),
      recipientContactRef.get(),
    ]);

    if (senderContactDoc.exists || recipientContactDoc.exists) {
      const restoredAt = new Date().toISOString();

      await Promise.all([
        senderContactRef.set({
          uid: toUid,
          displayName: target.displayName || target.username || target.email || toUid,
          email: target.email || toEmail || null,
          photoURL: target.photoURL || null,
          createdAt: senderContactDoc.data()?.createdAt || restoredAt,
          restoredAt,
        }, { merge: true }),
        recipientContactRef.set({
          uid: fromUid,
          displayName: fromName || fromEmail || fromUid,
          email: fromEmail || null,
          photoURL: fromPhoto || null,
          createdAt: recipientContactDoc.data()?.createdAt || restoredAt,
          restoredAt,
        }, { merge: true }),
      ]);

      return res.json({ ok: true, restored: true, repairedBothSides: true, toUid });
    }

    const existingPendingSnap = await db
      .collection('friend_requests')
      .where('fromUid', '==', fromUid)
      .where('toUid', '==', toUid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingPendingSnap.empty) {
      const existingPending = existingPendingSnap.docs[0].data();
      return res.status(409).json({
        error: 'Verzoek al verzonden',
        code: 'friend_request_already_pending',
        ...toPendingRequestResponse(existingPending),
      });
    }

    const requestRef = db.collection('friend_requests').doc();
    const requestData = {
      id: requestRef.id,
      fromUid,
      fromName: fromName || fromEmail || fromUid,
      fromEmail: fromEmail || null,
      fromPhoto: fromPhoto || null,
      toUid,
      toEmail,
      toIdentifier: toIdentifier || toEmail,
      status: 'pending',
      reminderCount: 0,
      lastReminderAt: null,
      createdAt: new Date().toISOString(),
    };

    await requestRef.set(requestData);
    emitToUser(io, toUid, 'friend:request', requestData);

    return res.json({
      ok: true,
      restored: false,
      requestId: requestRef.id,
      toUid,
    });
  }));

  router.post('/:requestId/remind', requireAuth, asyncRoute(async (req, res) => {
    const uid = req.auth.uid;
    const { requestId } = req.params;

    const requestDoc = await db.collection('friend_requests').doc(requestId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'request_not_found' });
    }

    const request = requestDoc.data();
    if (request.fromUid !== uid) {
      return res.status(403).json({ error: 'not_allowed' });
    }

    if (request.status !== 'pending') {
      return res.status(409).json({ error: 'request_not_pending' });
    }

    const reminderCount = Number(request.reminderCount || 0);
    if (reminderCount >= MAX_REMINDERS) {
      return res.status(409).json({
        error: 'Maximum aantal herinneringen bereikt',
        code: 'friend_request_reminder_limit_reached',
        ...toPendingRequestResponse(request),
      });
    }

    const nextReminderCount = reminderCount + 1;
    const remindedAt = new Date().toISOString();

    await requestDoc.ref.set({
      reminderCount: nextReminderCount,
      lastReminderAt: remindedAt,
      updatedAt: remindedAt,
    }, { merge: true });

    const updatedRequest = {
      ...request,
      reminderCount: nextReminderCount,
      lastReminderAt: remindedAt,
      updatedAt: remindedAt,
    };

    emitToUser(io, request.toUid, 'friend:request', {
      ...updatedRequest,
      isReminder: true,
    });

    return res.json({
      ok: true,
      reminded: true,
      remindedAt,
      ...toPendingRequestResponse(updatedRequest),
    });
  }));

  router.post('/:requestId/cancel', requireAuth, asyncRoute(async (req, res) => {
    const uid = req.auth.uid;
    const { requestId } = req.params;

    const requestDoc = await db.collection('friend_requests').doc(requestId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'request_not_found' });
    }

    const request = requestDoc.data();
    if (request.fromUid !== uid) {
      return res.status(403).json({ error: 'not_allowed' });
    }

    if (request.status !== 'pending') {
      return res.status(409).json({ error: 'request_not_pending' });
    }

    const canceledAt = new Date().toISOString();
    await requestDoc.ref.set({
      status: 'cancelled',
      canceledAt,
      updatedAt: canceledAt,
    }, { merge: true });

    emitToUser(io, request.toUid, 'friend:request:cancelled', {
      requestId,
      fromUid: request.fromUid,
      canceledAt,
    });

    return res.json({ ok: true, cancelled: true, requestId, canceledAt });
  }));

  router.post('/:requestId/accept', requireAuth, asyncRoute(async (req, res) => {
    const uid = req.auth.uid;
    const { requestId } = req.params;

    const requestDoc = await db.collection('friend_requests').doc(requestId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'request_not_found' });
    }

    const request = requestDoc.data();
    if (request.toUid !== uid) {
      return res.status(403).json({ error: 'not_allowed' });
    }

    const acceptedAt = new Date().toISOString();

    await requestDoc.ref.set({
      status: 'accepted',
      acceptedAt,
    }, { merge: true });

    await db.collection('users').doc(request.fromUid).collection('contacts').doc(uid).set({
      uid,
      displayName: request.toName || request.toEmail || uid,
      email: request.toEmail || null,
      photoURL: null,
      createdAt: acceptedAt,
    }, { merge: true });

    await db.collection('users').doc(uid).collection('contacts').doc(request.fromUid).set({
      uid: request.fromUid,
      displayName: request.fromName || request.fromEmail || request.fromUid,
      email: request.fromEmail || null,
      photoURL: request.fromPhoto || null,
      createdAt: acceptedAt,
    }, { merge: true });

    emitToUser(io, request.fromUid, 'friend:accepted', {
      requestId,
      byUid: uid,
      byName: request.toName || request.toEmail || uid,
      acceptedAt,
    });

    return res.json({ ok: true, accepted: true });
  }));

  router.post('/:requestId/decline', requireAuth, asyncRoute(async (req, res) => {
    const uid = req.auth.uid;
    const { requestId } = req.params;

    const requestDoc = await db.collection('friend_requests').doc(requestId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'request_not_found' });
    }

    const request = requestDoc.data();
    if (request.toUid !== uid) {
      return res.status(403).json({ error: 'not_allowed' });
    }

    await requestDoc.ref.set({
      status: 'declined',
      declinedAt: new Date().toISOString(),
    }, { merge: true });

    return res.json({ ok: true, declined: true });
  }));

  return router;
}
