import admin from 'firebase-admin';
import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';

export const parentRouter = Router();

const CHILD_USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const DEFAULT_FIREBASE_WEB_API_KEY = 'AIzaSyC91LqqIw8z8NH7e1ChCKD3zUo_VXQeyRY';

function normalizeChildUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeChildDisplayName(value) {
  return String(value || '').trim();
}

function buildChildEmail(username) {
  return `${username}@kind.pulse.local`;
}

function getFirebaseWebApiKey() {
  return process.env.FIREBASE_WEB_API_KEY
    || process.env.REACT_APP_FIREBASE_API_KEY
    || DEFAULT_FIREBASE_WEB_API_KEY;
}

async function createChildAuthUser({ displayName, email, password }) {
  try {
    const authUser = await admin.auth().createUser({
      displayName,
      email,
      password,
    });

    return {
      uid: authUser.uid,
      email: authUser.email || email,
      displayName: authUser.displayName || displayName,
    };
  } catch (error) {
    if (error?.code !== 'app/invalid-credential') {
      throw error;
    }
  }

  const apiKey = getFirebaseWebApiKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || 'auth_create_user_failed';
    const mappedError = new Error(message);
    mappedError.code = message === 'EMAIL_EXISTS'
      ? 'auth/email-already-exists'
      : message === 'WEAK_PASSWORD'
        ? 'auth/invalid-password'
        : 'auth/rest-create-user-failed';
    throw mappedError;
  }

  return {
    uid: data.localId,
    email: data.email || email,
    displayName,
  };
}

async function ensureParentAccess(parentUid, childUid, res) {
  const allowed = await parentPolicyService.isParentOfChild(parentUid, childUid);
  if (!allowed) {
    res.status(403).json({ error: 'not_allowed' });
    return false;
  }

  return true;
}

async function listChildrenForParent(parentUid) {
  const primary = await db.collection('users').where('parentUid', '==', parentUid).get();
  if (!primary.empty) return primary.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));

  const fallback = await db.collection('users').where('managedByParentId', '==', parentUid).get();
  return fallback.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
}

parentRouter.get('/children', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const children = await listChildrenForParent(parentUid);

  const withPolicies = await Promise.all(children.map(async (child) => {
    const policyDoc = await db.collection('child_policies').doc(child.uid).get();
    const policy = policyDoc.exists ? policyDoc.data() : null;

    return {
      uid: child.uid,
      displayName: child.displayName || child.username || child.uid,
      username: child.username || null,
      online: false,
      pausedFeatures: {
        chat: policy ? policy.featureRules?.chat === false : false,
        call: policy ? policy.featureRules?.call === false : false,
        video: policy ? policy.featureRules?.video === false : false,
      },
    };
  }));

  return res.json(withPolicies);
}));

parentRouter.post('/create-child', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const displayName = sanitizeChildDisplayName(req.body?.name);
  const username = normalizeChildUsername(req.body?.username);
  const password = String(req.body?.password || '');

  if (displayName.length < 2) {
    return res.status(400).json({ error: 'Naam moet minimaal 2 tekens hebben.' });
  }

  if (!CHILD_USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Gebruik 3–20 tekens met alleen letters, cijfers en _.' });
  }

  if (password.trim().length < 6) {
    return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn.' });
  }

  const existingUserSnap = await db.collection('users').where('username', '==', username).limit(1).get();
  if (!existingUserSnap.empty) {
    return res.status(409).json({ error: 'Deze gebruikersnaam is al in gebruik.' });
  }

  const email = buildChildEmail(username);

  let authUser = null;
  try {
    authUser = await createChildAuthUser({
      displayName,
      email,
      password: password.trim(),
    });
  } catch (error) {
    if (error?.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Deze gebruikersnaam is al in gebruik.' });
    }
    if (error?.code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn.' });
    }
    console.error('[Pulse parent] kindaccount aanmaken mislukt:', error);
    return res.status(500).json({ error: 'Kindaccount aanmaken mislukt.' });
  }

  const now = new Date().toISOString();

  try {
    await db.collection('users').doc(authUser.uid).set({
      uid: authUser.uid,
      displayName,
      username,
      email,
      role: 'child',
      parentUid,
      managedByParentId: parentUid,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    await db.collection('child_policies').doc(authUser.uid).set({
      childId: authUser.uid,
      managedByParentId: parentUid,
      contactRules: {
        requiresParentApproval: true,
        allowOnlyApprovedContacts: true,
      },
      featureRules: {
        chat: true,
        call: true,
        video: true,
      },
      visibilityRules: {
        showUsageStatsToParent: true,
        showContactListToParent: true,
        showMessageContentToParent: false,
      },
      scheduleRules: {
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: 'Europe/Amsterdam',
      },
      updatedAt: now,
    }, { merge: true });

    await logPolicyEvent({
      actorUid: parentUid,
      childUid: authUser.uid,
      action: 'create_child',
      allowed: true,
      metadata: {
        username,
      },
    });
  } catch (error) {
    console.error('[Pulse parent] kindprofiel opslaan mislukt:', error);
    await admin.auth().deleteUser(authUser.uid).catch(() => {});
    return res.status(500).json({ error: 'Kindaccount opslaan mislukt.' });
  }

  return res.status(201).json({
    ok: true,
    uid: authUser.uid,
    displayName,
    username,
    email,
  });
}));

parentRouter.get('/analytics/:childUid', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  const contactsSnap = await db.collection('approved_contacts').where('childId', '==', childUid).get();
  const messagesSentSnap = await db.collection('messages').where('senderUserId', '==', childUid).get();
  const blockedCount = contactsSnap.docs.filter((doc) => doc.data().blocked).length;

  return res.json({
    profile: {
      uid: childUid,
    },
    contacts: {
      total: contactsSnap.size,
      blocked: blockedCount,
    },
    friendRequests: {
      pending: 0,
    },
    sessions: {
      total: 0,
      activeDays: 0,
    },
    messaging: {
      sent: messagesSentSnap.size,
      received: 0,
    },
  });
}));

parentRouter.get('/child/:childUid/policy', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  const doc = await db.collection('child_policies').doc(childUid).get();
  return res.json(
    doc.exists
      ? doc.data()
      : {
          childId: childUid,
          managedByParentId: parentUid,
          contactRules: {
            requiresParentApproval: true,
            allowOnlyApprovedContacts: true,
          },
          featureRules: {
            chat: true,
            call: true,
            video: true,
          },
          visibilityRules: {
            showUsageStatsToParent: true,
            showContactListToParent: true,
            showMessageContentToParent: false,
          },
          scheduleRules: {
            quietHoursEnabled: false,
            quietHoursStart: null,
            quietHoursEnd: null,
            timezone: 'Europe/Amsterdam',
          },
      }
  );
}));

parentRouter.patch('/child/:childUid/policy/features', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const { chat, call, video } = req.body || {};

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  await db.collection('child_policies').doc(childUid).set(
    {
      childId: childUid,
      managedByParentId: parentUid,
      featureRules: {
        chat: chat !== false,
        call: call !== false,
        video: video !== false,
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    action: 'update_feature_policy',
    allowed: true,
    metadata: {
      chat: chat !== false,
      call: call !== false,
      video: video !== false,
    },
  });

  return res.json({ ok: true });
}));

parentRouter.patch('/child/:childUid/policy/schedule', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const {
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    timezone,
  } = req.body || {};

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  await db.collection('child_policies').doc(childUid).set(
    {
      childId: childUid,
      managedByParentId: parentUid,
      scheduleRules: {
        quietHoursEnabled: !!quietHoursEnabled,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
        timezone: timezone || 'Europe/Amsterdam',
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    action: 'update_schedule_policy',
    allowed: true,
    metadata: {
      quietHoursEnabled: !!quietHoursEnabled,
      quietHoursStart: quietHoursStart || null,
      quietHoursEnd: quietHoursEnd || null,
      timezone: timezone || 'Europe/Amsterdam',
    },
  });

  return res.json({ ok: true });
}));

parentRouter.get('/child/:childUid/approved-contacts', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  const snap = await db.collection('approved_contacts').where('childId', '==', childUid).get();
  return res.json(snap.docs.map((doc) => doc.data()));
}));

parentRouter.get('/child/:childUid/contacts', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  const snap = await db.collection('approved_contacts').where('childId', '==', childUid).get();
  return res.json(
    snap.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: data.targetUid,
        displayName: data.displayName || data.targetUid,
        isBlocked: !!data.blocked,
        isBlockedByParent: !!data.blocked,
        approved: !!data.approved,
        chat: data.chat !== false,
        call: data.call !== false,
        video: data.video !== false,
      };
    })
  );
}));

parentRouter.post('/child/:childUid/approved-contacts', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const { targetUid, chat, call, video } = req.body || {};

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  if (!targetUid) {
    return res.status(400).json({ error: 'missing_target_uid' });
  }

  await db.collection('approved_contacts').doc(`${childUid}_${targetUid}`).set(
    {
      childId: childUid,
      targetUid,
      approved: true,
      approvedByParentId: parentUid,
      chat: chat !== false,
      call: call !== false,
      video: video !== false,
      blocked: false,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    targetUid,
    action: 'approve_contact',
    allowed: true,
    metadata: {
      chat: chat !== false,
      call: call !== false,
      video: video !== false,
    },
  });

  return res.json({ ok: true });
}));

parentRouter.patch('/child/:childUid/approved-contacts/:targetUid', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid, targetUid } = req.params;
  const { chat, call, video, blocked } = req.body || {};

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  await db.collection('approved_contacts').doc(`${childUid}_${targetUid}`).set(
    {
      childId: childUid,
      targetUid,
      approved: true,
      approvedByParentId: parentUid,
      ...(chat !== undefined ? { chat: !!chat } : {}),
      ...(call !== undefined ? { call: !!call } : {}),
      ...(video !== undefined ? { video: !!video } : {}),
      ...(blocked !== undefined ? { blocked: !!blocked } : {}),
    },
    { merge: true }
  );

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    targetUid,
    action: 'update_contact_policy',
    allowed: true,
    metadata: {
      ...(chat !== undefined ? { chat: !!chat } : {}),
      ...(call !== undefined ? { call: !!call } : {}),
      ...(video !== undefined ? { video: !!video } : {}),
      ...(blocked !== undefined ? { blocked: !!blocked } : {}),
    },
  });

  return res.json({ ok: true });
}));

parentRouter.delete('/child/:childUid/approved-contacts/:targetUid', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid, targetUid } = req.params;

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  await db.collection('approved_contacts').doc(`${childUid}_${targetUid}`).delete();

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    targetUid,
    action: 'remove_contact',
    allowed: true,
  });

  return res.json({ ok: true });
}));

parentRouter.post('/child/:childUid/block-contact', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const { targetUid } = req.body || {};

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  if (!targetUid) {
    return res.status(400).json({ error: 'missing_target_uid' });
  }

  await db.collection('approved_contacts').doc(`${childUid}_${targetUid}`).set(
    {
      childId: childUid,
      targetUid,
      approved: true,
      approvedByParentId: parentUid,
      blocked: true,
    },
    { merge: true }
  );

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    targetUid,
    action: 'block_contact',
    allowed: true,
  });

  return res.json({ ok: true });
}));

parentRouter.post('/child/:childUid/unblock-contact', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const { targetUid } = req.body || {};

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  if (!targetUid) {
    return res.status(400).json({ error: 'missing_target_uid' });
  }

  await db.collection('approved_contacts').doc(`${childUid}_${targetUid}`).set(
    {
      childId: childUid,
      targetUid,
      approved: true,
      approvedByParentId: parentUid,
      blocked: false,
    },
    { merge: true }
  );

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    targetUid,
    action: 'unblock_contact',
    allowed: true,
  });

  return res.json({ ok: true });
}));

parentRouter.post('/child/:childUid/remove-contact', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const { targetUid } = req.body || {};

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  if (!targetUid) {
    return res.status(400).json({ error: 'missing_target_uid' });
  }

  await db.collection('approved_contacts').doc(`${childUid}_${targetUid}`).delete();

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    targetUid,
    action: 'remove_contact',
    allowed: true,
  });

  return res.json({ ok: true });
}));

parentRouter.get('/activities', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;

  const snap = await db
    .collection('policy_events')
    .where('actorUid', '==', parentUid)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  return res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
}));
