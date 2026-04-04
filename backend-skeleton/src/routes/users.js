import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { resolveUserRole } from '../services/userRoles.js';

export const usersRouter = Router();

async function syncSelfHandler(req, res) {
  const uid = req.auth.uid;
  const {
    displayName = null,
    email = null,
    photoURL = null,
    username = null,
    role = 'user',
  } = req.body || {};

  const now = new Date().toISOString();
  const userRef = db.collection('users').doc(uid);
  const existingDoc = await userRef.get();
  const existingUser = existingDoc.exists ? existingDoc.data() : null;

  await userRef.set({
    uid,
    displayName: displayName || existingUser?.displayName || email || uid,
    email: email || existingUser?.email || null,
    photoURL: photoURL || existingUser?.photoURL || null,
    username: username || existingUser?.username || null,
    role: resolveUserRole(existingUser?.role, role),
    status: existingUser?.status || 'active',
    createdAt: existingUser?.createdAt || now,
    updatedAt: now,
  }, { merge: true });

  return res.json({ ok: true, uid });
}

usersRouter.post('/', requireAuth, asyncRoute(syncSelfHandler));
usersRouter.post('/sync-self', requireAuth, asyncRoute(syncSelfHandler));

usersRouter.get('/lookup-username', asyncRoute(async (req, res) => {
  const username = String(req.query.username || '').trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ error: 'missing_username' });
  }

  const snap = await db.collection('users').where('username', '==', username).limit(1).get();
  if (snap.empty) {
    return res.status(404).json({ error: 'Gebruikersnaam niet gevonden.' });
  }

  const data = snap.docs[0].data();
  return res.json({
    uid: data.uid || snap.docs[0].id,
    username: data.username || username,
    email: data.email || null,
    displayName: data.displayName || data.username || username,
  });
}));

usersRouter.get('/search', requireAuth, asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const email = String(req.query.email || '').trim().toLowerCase();

  if (!q && !email) {
    return res.status(400).json({ error: 'missing_query' });
  }

  let snap = null;
  if (email) {
    snap = await db.collection('users').where('email', '==', email).limit(1).get();
  } else {
    snap = await db.collection('users').where('username', '==', q).limit(1).get();
  }

  if (snap.empty) {
    return res.status(404).json({ error: 'Niet gevonden' });
  }

  const data = snap.docs[0].data();
  return res.json({
    uid: data.uid || snap.docs[0].id,
    displayName: data.displayName || data.username || data.email,
    email: data.email || null,
    photoURL: data.photoURL || null,
    username: data.username || null,
  });
}));

usersRouter.get('/:uid/blocked', requireAuth, asyncRoute(async (req, res) => {
  const requesterUid = req.auth.uid;
  const { uid } = req.params;

  if (requesterUid !== uid) {
    return res.status(403).json({ error: 'not_allowed' });
  }

  const snap = await db
    .collection('approved_contacts')
    .where('childId', '==', uid)
    .where('blocked', '==', true)
    .get();

  const contacts = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: data.targetUid,
      displayName: data.displayName || data.targetUid,
      isBlocked: true,
      isBlockedByParent: true,
    };
  });

  return res.json({
    contacts,
    parentBlockedUids: contacts.map((contact) => contact.uid),
  });
}));

usersRouter.post('/:uid/block', requireAuth, asyncRoute(async (req, res) => {
  const requesterUid = req.auth.uid;
  const { uid } = req.params;
  const { targetUid } = req.body || {};

  if (requesterUid !== uid) {
    return res.status(403).json({ error: 'not_allowed' });
  }

  if (!targetUid) {
    return res.status(400).json({ error: 'missing_target_uid' });
  }

  const targetDoc = await db.collection('users').doc(targetUid).get();
  const target = targetDoc.exists ? targetDoc.data() : {};

  await db.collection('approved_contacts').doc(`${uid}_${targetUid}`).set({
    childId: uid,
    targetUid,
    displayName: target.displayName || target.username || targetUid,
    approved: true,
    blocked: true,
  }, { merge: true });

  return res.json({ ok: true, blocked: true });
}));

usersRouter.post('/:uid/unblock', requireAuth, asyncRoute(async (req, res) => {
  const requesterUid = req.auth.uid;
  const { uid } = req.params;
  const { targetUid } = req.body || {};

  if (requesterUid !== uid) {
    return res.status(403).json({ error: 'not_allowed' });
  }

  if (!targetUid) {
    return res.status(400).json({ error: 'missing_target_uid' });
  }

  await db.collection('approved_contacts').doc(`${uid}_${targetUid}`).set({
    childId: uid,
    targetUid,
    blocked: false,
  }, { merge: true });

  return res.json({ ok: true, blocked: false });
}));
