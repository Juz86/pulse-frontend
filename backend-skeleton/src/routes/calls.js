import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';
import { getPendingCallInvite } from '../services/pendingCalls.js';

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

callsRouter.get('/pending/:sessionId', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const sessionId = String(req.params.sessionId || '').trim();
  const fromUid = String(req.query?.fromUid || '').trim() || null;

  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'missing_session_id' });
  }

  const invite = getPendingCallInvite({ uid, sessionId, fromUid });
  if (!invite) {
    return res.status(404).json({ ok: false, error: 'pending_call_not_found' });
  }

  return res.json({
    ok: true,
    call: {
      fromUid: invite.fromUid,
      offer: invite.offer,
      isVideo: !!invite.isVideo,
      callerName: invite.callerName || 'Iemand',
      sessionId: invite.sessionId,
    },
  });
}));
