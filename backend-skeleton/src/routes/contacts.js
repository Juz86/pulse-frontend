import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';

export const contactsRouter = Router();

contactsRouter.delete('/:uid/:targetUid', requireAuth, asyncRoute(async (req, res) => {
  const requesterUid = req.auth.uid;
  const { uid, targetUid } = req.params;

  if (requesterUid !== uid) {
    return res.status(403).json({ error: 'not_allowed' });
  }

  await db.collection('users').doc(uid).collection('contacts').doc(targetUid).delete();
  return res.json({ ok: true, deleted: true });
}));
