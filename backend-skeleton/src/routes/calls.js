import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';

export const callsRouter = Router();

callsRouter.post('/start', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const { targetUid, isVideo = false } = req.body || {};

  if (!targetUid) {
    return res.status(400).json({ error: 'missing_target_uid' });
  }

  const decision = await parentPolicyService.mayStartCall(uid, targetUid, !!isVideo);
  if (!decision.allowed) {
    await logPolicyEvent({
      actorUid: uid,
      targetUid,
      action: isVideo ? 'start_video_call' : 'start_audio_call',
      allowed: false,
      reason: decision.reason || 'call_not_allowed',
    });
    return res.status(403).json({ error: decision.reason || 'call_not_allowed' });
  }

  return res.json({
    ok: true,
    allowed: true,
  });
}));
