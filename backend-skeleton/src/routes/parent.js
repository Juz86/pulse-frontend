import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { parentPolicyService } from '../services/parentPolicyService.js';

export const parentRouter = Router();

parentRouter.get('/child/:childUid/policy', requireAuth, async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;

  const allowed = await parentPolicyService.isParentOfChild(parentUid, childUid);
  if (!allowed) {
    return res.status(403).json({ error: 'not_allowed' });
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
});

parentRouter.patch('/child/:childUid/policy/features', requireAuth, async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const { chat, call, video } = req.body || {};

  const allowed = await parentPolicyService.isParentOfChild(parentUid, childUid);
  if (!allowed) {
    return res.status(403).json({ error: 'not_allowed' });
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

  return res.json({ ok: true });
});

parentRouter.patch('/child/:childUid/policy/schedule', requireAuth, async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const {
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    timezone,
  } = req.body || {};

  const allowed = await parentPolicyService.isParentOfChild(parentUid, childUid);
  if (!allowed) {
    return res.status(403).json({ error: 'not_allowed' });
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

  return res.json({ ok: true });
});

parentRouter.get('/child/:childUid/approved-contacts', requireAuth, async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;

  const allowed = await parentPolicyService.isParentOfChild(parentUid, childUid);
  if (!allowed) {
    return res.status(403).json({ error: 'not_allowed' });
  }

  const snap = await db.collection('approved_contacts').where('childId', '==', childUid).get();
  return res.json(snap.docs.map((doc) => doc.data()));
});

parentRouter.post('/child/:childUid/approved-contacts', requireAuth, async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid } = req.params;
  const { targetUid, chat, call, video } = req.body || {};

  const allowed = await parentPolicyService.isParentOfChild(parentUid, childUid);
  if (!allowed) {
    return res.status(403).json({ error: 'not_allowed' });
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

  return res.json({ ok: true });
});

parentRouter.patch('/child/:childUid/approved-contacts/:targetUid', requireAuth, async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid, targetUid } = req.params;
  const { chat, call, video, blocked } = req.body || {};

  const allowed = await parentPolicyService.isParentOfChild(parentUid, childUid);
  if (!allowed) {
    return res.status(403).json({ error: 'not_allowed' });
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

  return res.json({ ok: true });
});

parentRouter.delete('/child/:childUid/approved-contacts/:targetUid', requireAuth, async (req, res) => {
  const parentUid = req.auth.uid;
  const { childUid, targetUid } = req.params;

  const allowed = await parentPolicyService.isParentOfChild(parentUid, childUid);
  if (!allowed) {
    return res.status(403).json({ error: 'not_allowed' });
  }

  await db.collection('approved_contacts').doc(`${childUid}_${targetUid}`).delete();
  return res.json({ ok: true });
});
