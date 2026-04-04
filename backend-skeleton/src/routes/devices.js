import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../services/firestore.js';
import { appendUniqueOneTimePreKeys, normalizeOneTimePreKeys } from '../services/deviceKeys.js';
import { isOwnedActiveDevice, toDeviceSummary } from '../services/deviceRecords.js';

export const devicesRouter = Router();

devicesRouter.get('/', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;

  const snap = await db
    .collection('devices')
    .where('userId', '==', uid)
    .get();

  const devices = snap.docs
    .map((doc) => toDeviceSummary(doc.data()))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });

  return res.json({ devices });
}));

devicesRouter.post('/register', requireAuth, asyncRoute(async (req, res) => {
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

  const normalizedPreKeys = normalizeOneTimePreKeys(oneTimePreKeys);
  const ref = db.collection('devices').doc();
  const createdAt = new Date().toISOString();
  await ref.set({
    id: ref.id,
    userId: uid,
    deviceLabel: deviceLabel || 'Onbekend apparaat',
    identityPublicKey,
    signedPreKey,
    oneTimePreKeys: normalizedPreKeys,
    oneTimePreKeyCount: normalizedPreKeys.length,
    platform: platform || 'unknown',
    protocol: protocol || 'signal_v1',
    protocolVersion: protocolVersion || 1,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    revokedAt: null,
  });

  return res.json({
    deviceId: ref.id,
    status: 'registered',
  });
}));

devicesRouter.post('/:deviceId/prekeys', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const { deviceId } = req.params;
  const { oneTimePreKeys } = req.body || {};

  if (!Array.isArray(oneTimePreKeys) || oneTimePreKeys.length === 0) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const deviceRef = db.collection('devices').doc(deviceId);
  const deviceDoc = await deviceRef.get();

  if (!deviceDoc.exists) {
    return res.status(404).json({ error: 'device_not_found' });
  }

  const device = deviceDoc.data();
  if (!isOwnedActiveDevice(device, uid)) {
    return res.status(403).json({ error: 'not_allowed_for_device' });
  }

  const mergedPreKeys = appendUniqueOneTimePreKeys(device.oneTimePreKeys || [], oneTimePreKeys);
  const updatedAt = new Date().toISOString();

  await deviceRef.update({
    oneTimePreKeys: mergedPreKeys,
    oneTimePreKeyCount: mergedPreKeys.length,
    updatedAt,
  });

  return res.json({
    ok: true,
    deviceId,
    oneTimePreKeyCount: mergedPreKeys.length,
    updatedAt,
  });
}));

devicesRouter.post('/:deviceId/signed-prekey', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const { deviceId } = req.params;
  const { signedPreKey } = req.body || {};

  if (
    !signedPreKey ||
    typeof signedPreKey !== 'object' ||
    signedPreKey.keyId === undefined ||
    signedPreKey.keyId === null ||
    !signedPreKey.publicKey ||
    !signedPreKey.signature
  ) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const deviceRef = db.collection('devices').doc(deviceId);
  const deviceDoc = await deviceRef.get();

  if (!deviceDoc.exists) {
    return res.status(404).json({ error: 'device_not_found' });
  }

  const device = deviceDoc.data();
  if (!isOwnedActiveDevice(device, uid)) {
    return res.status(403).json({ error: 'not_allowed_for_device' });
  }

  const updatedAt = new Date().toISOString();

  await deviceRef.update({
    signedPreKey,
    signedPreKeyRotatedAt: updatedAt,
    updatedAt,
  });

  return res.json({
    ok: true,
    deviceId,
    signedPreKeyKeyId: signedPreKey.keyId,
    updatedAt,
  });
}));

devicesRouter.post('/:deviceId/revoke', requireAuth, asyncRoute(async (req, res) => {
  const uid = req.auth.uid;
  const { deviceId } = req.params;

  const deviceRef = db.collection('devices').doc(deviceId);
  const deviceDoc = await deviceRef.get();

  if (!deviceDoc.exists) {
    return res.status(404).json({ error: 'device_not_found' });
  }

  const device = deviceDoc.data();
  if (device.userId !== uid) {
    return res.status(403).json({ error: 'not_allowed_for_device' });
  }

  if (device.status === 'revoked') {
    return res.json({
      ok: true,
      deviceId,
      status: 'revoked',
      revokedAt: device.revokedAt || null,
    });
  }

  const revokedAt = new Date().toISOString();

  await deviceRef.update({
    status: 'revoked',
    revokedAt,
    updatedAt: revokedAt,
    oneTimePreKeys: [],
    oneTimePreKeyCount: 0,
  });

  return res.json({
    ok: true,
    deviceId,
    status: 'revoked',
    revokedAt,
  });
}));
