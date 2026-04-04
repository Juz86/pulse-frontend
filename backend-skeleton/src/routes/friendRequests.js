import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';

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

    const existingContact = await db.collection('users').doc(fromUid).collection('contacts').doc(toUid).get();
    if (existingContact.exists) {
      return res.json({ ok: true, restored: true, toUid });
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
