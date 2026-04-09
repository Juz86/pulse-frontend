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
  return `${username}@pulse.internal`;
}

async function setUserContact(userId, targetUid, data) {
  await db.collection('users').doc(userId).collection('contacts').doc(targetUid).set(
    {
      uid: targetUid,
      ...data,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function ensureParentChildContactLinks({ parentUid, childUid, parentData, childData }) {
  await setUserContact(parentUid, childUid, {
    displayName: childData.displayName || childData.username || childUid,
    email: childData.email || null,
    photoURL: childData.photoURL || null,
    username: childData.username || null,
    relation: 'child',
  });

  await setUserContact(childUid, parentUid, {
    displayName: parentData.displayName || parentData.username || parentUid,
    email: parentData.email || null,
    photoURL: parentData.photoURL || null,
    username: parentData.username || null,
    relation: 'parent',
  });

  await db.collection('approved_contacts').doc(`${childUid}_${parentUid}`).set(
    {
      childId: childUid,
      targetUid: parentUid,
      displayName: parentData.displayName || parentData.username || parentUid,
      approved: true,
      approvedByParentId: parentUid,
      chat: true,
      call: true,
      video: true,
      blocked: false,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

function toPausedFeatures(policy = null) {
  return {
    chat: policy ? policy.featureRules?.chat === false : false,
    call: policy ? policy.featureRules?.call === false : false,
    video: policy ? policy.featureRules?.video === false : false,
  };
}

function resolveFeaturePatch(feature, paused) {
  if (!['chat', 'call', 'video', 'all'].includes(feature)) {
    return null;
  }

  if (feature === 'all') {
    return {
      chat: !paused,
      call: !paused,
      video: !paused,
    };
  }

  return {
    [feature]: !paused,
  };
}

function getFirebaseWebApiKey() {
  return process.env.FIREBASE_WEB_API_KEY
    || process.env.REACT_APP_FIREBASE_API_KEY
    || DEFAULT_FIREBASE_WEB_API_KEY;
}

async function postFirebaseAuthJson(endpoint, body) {
  const apiKey = getFirebaseWebApiKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || 'firebase_auth_request_failed';
    const error = new Error(message);
    error.code = message;
    throw error;
  }

  return data;
}

async function exchangeRefreshTokenForIdToken(refreshToken) {
  const apiKey = getFirebaseWebApiKey();
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || 'secure_token_exchange_failed';
    const error = new Error(message);
    error.code = message;
    throw error;
  }

  return data;
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
        returnSecureToken: true,
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
    refreshToken: data.refreshToken || null,
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
      pausedFeatures: toPausedFeatures(policy),
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
  const parentDoc = await db.collection('users').doc(parentUid).get();
  const parentData = parentDoc.exists ? parentDoc.data() : {
    uid: parentUid,
    displayName: parentUid,
    email: null,
    photoURL: null,
    username: null,
  };

  try {
    const childRecord = {
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
      ...(authUser.refreshToken
        ? {
            devAuthRefreshToken: authUser.refreshToken,
            devAuthProvider: 'identitytoolkit',
          }
        : {}),
    };

    await db.collection('users').doc(authUser.uid).set(childRecord, { merge: true });

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

    await ensureParentChildContactLinks({
      parentUid,
      childUid: authUser.uid,
      parentData,
      childData: childRecord,
    });

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

parentRouter.post('/pause/:childUid', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const feature = String(req.body?.feature || '').trim().toLowerCase();
  const patch = resolveFeaturePatch(feature, true);

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  if (!patch) {
    return res.status(400).json({ error: 'invalid_feature' });
  }

  await db.collection('child_policies').doc(childUid).set(
    {
      childId: childUid,
      managedByParentId: parentUid,
      featureRules: patch,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const doc = await db.collection('child_policies').doc(childUid).get();
  const policy = doc.exists ? doc.data() : null;

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    action: 'pause_feature',
    allowed: true,
    metadata: { feature },
  });

  return res.json({ ok: true, pausedFeatures: toPausedFeatures(policy) });
}));

parentRouter.post('/resume/:childUid', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const feature = String(req.body?.feature || '').trim().toLowerCase();
  const patch = resolveFeaturePatch(feature, false);

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  if (!patch) {
    return res.status(400).json({ error: 'invalid_feature' });
  }

  await db.collection('child_policies').doc(childUid).set(
    {
      childId: childUid,
      managedByParentId: parentUid,
      featureRules: patch,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const doc = await db.collection('child_policies').doc(childUid).get();
  const policy = doc.exists ? doc.data() : null;

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    action: 'resume_feature',
    allowed: true,
    metadata: { feature },
  });

  return res.json({ ok: true, pausedFeatures: toPausedFeatures(policy) });
}));

parentRouter.post('/change-child-password/:childUid', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const password = String(req.body?.password || '');

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  if (password.trim().length < 6) {
    return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn.' });
  }

  try {
    await admin.auth().updateUser(childUid, { password: password.trim() });
  } catch (error) {
    if (error?.code === 'app/invalid-credential') {
      const childDoc = await db.collection('users').doc(childUid).get();
      const childData = childDoc.exists ? childDoc.data() : null;
      const refreshToken = childData?.devAuthRefreshToken || null;

      if (!refreshToken) {
        return res.status(503).json({ error: 'Wachtwoord wijzigen vereist Firebase Admin-auth of een lokaal aangemaakt kindaccount.' });
      }

      try {
        const tokenData = await exchangeRefreshTokenForIdToken(refreshToken);
        const updateData = await postFirebaseAuthJson('accounts:update', {
          idToken: tokenData.id_token,
          password: password.trim(),
          returnSecureToken: true,
        });

        await childDoc.ref.set({
          devAuthRefreshToken: updateData.refreshToken || refreshToken,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (restError) {
        console.error('[Pulse parent] kindwachtwoord wijzigen via REST mislukt:', restError);
        return res.status(503).json({ error: 'Wachtwoord wijzigen lukt lokaal nog niet voor dit account.' });
      }
    } else {
      console.error('[Pulse parent] kindwachtwoord wijzigen mislukt:', error);
      return res.status(500).json({ error: 'Wachtwoord wijzigen mislukt.' });
    }
  }

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    action: 'change_child_password',
    allowed: true,
  });

  return res.json({ ok: true });
}));

parentRouter.post('/change-child-username/:childUid', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const username = normalizeChildUsername(req.body?.username);

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  if (!CHILD_USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Gebruik 3–20 tekens met alleen letters, cijfers en _.' });
  }

  const childDoc = await db.collection('users').doc(childUid).get();
  if (!childDoc.exists) {
    return res.status(404).json({ error: 'kind_niet_gevonden' });
  }

  const existingUserSnap = await db.collection('users').where('username', '==', username).limit(1).get();
  if (!existingUserSnap.empty && existingUserSnap.docs[0].id !== childUid) {
    return res.status(409).json({ error: 'Deze gebruikersnaam is al in gebruik.' });
  }

  await childDoc.ref.set({
    username,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    action: 'change_child_username',
    allowed: true,
    metadata: { username },
  });

  const nextData = (await childDoc.ref.get()).data() || {};
  return res.json({
    ok: true,
    uid: childUid,
    username: nextData.username || username,
    email: nextData.email || null,
  });
}));

parentRouter.delete('/delete-child/:childUid', requireAuth, asyncRoute(async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;

  if (!(await ensureParentAccess(parentUid, childUid, res))) {
    return;
  }

  const childDoc = await db.collection('users').doc(childUid).get();
  if (!childDoc.exists) {
    return res.status(404).json({ error: 'kind_niet_gevonden' });
  }

  const childData = childDoc.data() || {};

  await db.collection('child_policies').doc(childUid).delete().catch(() => {});

  const approvedAsChild = await db.collection('approved_contacts').where('childId', '==', childUid).get();
  await Promise.all(approvedAsChild.docs.map((doc) => doc.ref.delete()));

  const approvedAsTarget = await db.collection('approved_contacts').where('targetUid', '==', childUid).get();
  await Promise.all(approvedAsTarget.docs.map((doc) => doc.ref.delete()));

  const devicesSnap = await db.collection('devices').where('userId', '==', childUid).get();
  await Promise.all(devicesSnap.docs.map((doc) => doc.ref.delete()));

  const convSnap = await db.collection('conversations').where('members', 'array-contains', childUid).get();
  await Promise.all(convSnap.docs.map((doc) => doc.ref.delete()));

  const sentMessagesSnap = await db.collection('messages').where('senderUserId', '==', childUid).get();
  await Promise.all(sentMessagesSnap.docs.map((doc) => doc.ref.delete()));

  await childDoc.ref.delete();

  let authDeleted = true;
  try {
    await admin.auth().deleteUser(childUid);
  } catch (error) {
    if (error?.code === 'app/invalid-credential') {
      const refreshToken = childData.devAuthRefreshToken || null;
      if (!refreshToken) {
        authDeleted = false;
      } else {
        try {
          const tokenData = await exchangeRefreshTokenForIdToken(refreshToken);
          await postFirebaseAuthJson('accounts:delete', {
            idToken: tokenData.id_token,
          });
          authDeleted = true;
        } catch (restError) {
          console.error('[Pulse parent] kindauth verwijderen via REST mislukt:', restError);
          authDeleted = false;
        }
      }
    } else {
      console.error('[Pulse parent] kindauth verwijderen mislukt:', error);
      authDeleted = false;
    }
  }

  await logPolicyEvent({
    actorUid: parentUid,
    childUid,
    action: 'delete_child',
    allowed: true,
    metadata: {
      username: childData.username || null,
      authDeleted,
    },
  });

  return res.json({ ok: true, authDeleted });
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

  const parentEventsSnap = await db
    .collection('policy_events')
    .where('actorUid', '==', parentUid)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const childrenSnap = await db
    .collection('users')
    .where('parentUid', '==', parentUid)
    .get();

  const managedChildren = childrenSnap.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  }));
  const managedChildIds = new Set(managedChildren.map((child) => child.uid));
  const childNameByUid = new Map(managedChildren.map((child) => [
    child.uid,
    child.displayName || child.username || child.email || child.uid,
  ]));

  const childEventGroups = await Promise.all(
    managedChildren.map(async (child) => {
      const [actorEventsSnap, scopedChildEventsSnap] = await Promise.all([
        db.collection('policy_events')
          .where('actorUid', '==', child.uid)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
        db.collection('policy_events')
          .where('childUid', '==', child.uid)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
      ]);

      return [...actorEventsSnap.docs, ...scopedChildEventsSnap.docs];
    })
  );

  const deduped = new Map();
  [...parentEventsSnap.docs, ...childEventGroups.flat()].forEach((doc) => {
    if (!deduped.has(doc.id)) {
      deduped.set(doc.id, { id: doc.id, ...doc.data() });
    }
  });

  function resolveActivityChildUid(event) {
    if (event.childUid) return event.childUid;
    if (managedChildIds.has(event.actorUid)) return event.actorUid;
    return null;
  }

  function buildActivityDescription(event, childUid) {
    const childName = childNameByUid.get(childUid) || 'dit kind';
    const targetName = event.metadata?.targetName || event.metadata?.displayName || event.targetUid || 'een contact';

    switch (event.action) {
      case 'create_child':
        return `Account voor ${childName} aangemaakt.`;
      case 'delete_child':
        return `Account van ${childName} verwijderd.`;
      case 'change_child_password':
        return `Wachtwoord van ${childName} gewijzigd.`;
      case 'change_child_username':
        return `Gebruikersnaam van ${childName} gewijzigd.`;
      case 'pause_feature':
        return `${childName}: ${event.metadata?.feature || 'functie'} gepauzeerd.`;
      case 'resume_feature':
        return `${childName}: ${event.metadata?.feature || 'functie'} hervat.`;
      case 'update_feature_policy':
        return `Functieregels van ${childName} bijgewerkt.`;
      case 'update_schedule_policy':
        return `Roosterregels van ${childName} bijgewerkt.`;
      case 'send_message':
        return event.allowed
          ? `${childName} stuurde een bericht.`
          : `${childName} kon geen bericht sturen${event.reason ? ` (${event.reason})` : ''}.`;
      case 'start_audio_call':
        return event.allowed
          ? `${childName} startte een spraakoproep.`
          : `${childName} kon geen spraakoproep starten${event.reason ? ` (${event.reason})` : ''}.`;
      case 'start_video_call':
        return event.allowed
          ? `${childName} startte een video-oproep.`
          : `${childName} kon geen video-oproep starten${event.reason ? ` (${event.reason})` : ''}.`;
      case 'approve_contact':
        return `${targetName} goedgekeurd voor ${childName}.`;
      case 'block_contact':
        return `${targetName} geblokkeerd voor ${childName}.`;
      case 'unblock_contact':
        return `${targetName} gedeblokkeerd voor ${childName}.`;
      case 'remove_contact':
        return `${targetName} verwijderd uit contacten van ${childName}.`;
      default:
        return event.allowed === false
          ? `${childName}: actie ${event.action || 'onbekend'} geblokkeerd${event.reason ? ` (${event.reason})` : ''}.`
          : `${childName}: ${event.action || 'activiteit'}.`;
    }
  }

  const activities = Array.from(deduped.values())
    .map((event) => {
      const childUid = resolveActivityChildUid(event);
      return {
        ...event,
        childUid,
        type: event.action || 'activity',
        description: buildActivityDescription(event, childUid),
      };
    })
    .filter((event) => event.childUid || event.actorUid === parentUid)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 100);

  return res.json(activities);
}));
