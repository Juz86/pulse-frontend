import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';

export const devicesRouter = Router();

devicesRouter.post('/register', requireAuth, async (req, res) => {
  const uid = req.auth.uid;
  const {
    deviceLabel,
    identityPublicKey,
    signedPreKey,
    oneTimePreKeys,
    platform,
    protocol,
    protocolVersion,
  } = req.body || {};

  if (!identityPublicKey || !signedPreKey || !Array.isArray(oneTimePreKeys)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const ref = db.collection('devices').doc();
  await ref.set({
    id: ref.id,
    userId: uid,
    deviceLabel: deviceLabel || 'Onbekend apparaat',
    identityPublicKey,
    signedPreKey,
    oneTimePreKeys,
    platform: platform || 'unknown',
    protocol: protocol || 'signal_v1',
    protocolVersion: protocolVersion || 1,
    status: 'active',
    createdAt: new Date().toISOString(),
    revokedAt: null,
  });

  return res.json({
    deviceId: ref.id,
    status: 'registered',
  });
});
