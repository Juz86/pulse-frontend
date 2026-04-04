import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';
import { consumeOneTimePreKey } from '../services/deviceKeys.js';

export const keysRouter = Router();

keysRouter.get('/:userId/key-bundle', requireAuth, asyncRoute(async (req, res) => {
  const requesterId = req.auth.uid;
  const targetUserId = req.params.userId;

  const decision = await parentPolicyService.mayFetchKeyBundle(requesterId, targetUserId);
  if (!decision.allowed) {
    await logPolicyEvent({
      actorUid: requesterId,
      targetUid: targetUserId,
      action: 'fetch_key_bundle',
      allowed: false,
      reason: decision.reason || 'not_allowed',
    });
    return res.status(403).json({ error: decision.reason || 'not_allowed' });
  }

  const snap = await db
    .collection('devices')
    .where('userId', '==', targetUserId)
    .where('status', '==', 'active')
    .get();

  const devices = [];

  for (const doc of snap.docs) {
    const bundle = await db.runTransaction(async (tx) => {
      const freshDoc = await tx.get(doc.ref);
      if (!freshDoc.exists) return null;

      const data = freshDoc.data();
      const {
        issuedPreKey,
        remainingPreKeys,
        remainingCount,
      } = consumeOneTimePreKey(data.oneTimePreKeys || []);

      if (!issuedPreKey) return null;

      tx.update(doc.ref, {
        oneTimePreKeys: remainingPreKeys,
        oneTimePreKeyCount: remainingCount,
        lastPreKeyIssuedAt: new Date().toISOString(),
      });

      return {
        deviceId: data.id,
        identityPublicKey: data.identityPublicKey,
        signedPreKey: data.signedPreKey,
        oneTimePreKey: issuedPreKey,
      };
    });

    if (bundle) {
      devices.push(bundle);
    }
  }

  return res.json({
    userId: targetUserId,
    devices,
    protocolVersion: 1,
  });
}));
