import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';

export const keysRouter = Router();

keysRouter.get('/:userId/key-bundle', requireAuth, async (req, res) => {
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

  const devices = snap.docs
    .map((doc) => {
      const data = doc.data();
      const preKeys = data.oneTimePreKeys || [];
      const oneTimePreKey = preKeys[0] || null;

      if (!oneTimePreKey) return null;

      return {
        deviceId: data.id,
        identityPublicKey: data.identityPublicKey,
        signedPreKey: data.signedPreKey,
        oneTimePreKey,
      };
    })
    .filter(Boolean);

  return res.json({
    userId: targetUserId,
    devices,
    protocolVersion: 1,
  });
});
