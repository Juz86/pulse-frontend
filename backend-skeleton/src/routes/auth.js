import crypto from 'crypto';
import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { db } from '../services/firestore.js';
import { getFirebaseCredentialMode } from '../services/firebaseConfig.js';

const CODE_TTL_MS = 15 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function shouldExposeDebugCode() {
  return process.env.ALLOW_DEV_AUTH_BYPASS === 'true' || getFirebaseCredentialMode() === 'firestore_emulator';
}

export const authRouter = Router();

authRouter.post('/send-code', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  }

  const code = String(crypto.randomInt(100000, 999999));
  const now = Date.now();
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();

  await db.collection('email_verification_codes').doc(email).set({
    email,
    code,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    updatedAt: new Date(now).toISOString(),
  }, { merge: true });

  if (shouldExposeDebugCode()) {
    console.log(`[Pulse auth] Dev verificatiecode voor ${email}: ${code}`);
  }

  return res.json({
    ok: true,
    sent: true,
    ...(shouldExposeDebugCode() ? { debugCode: code } : {}),
  });
}));

authRouter.post('/verify-code', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();

  if (!email || !code) {
    return res.status(400).json({ error: 'missing_email_or_code' });
  }

  const doc = await db.collection('email_verification_codes').doc(email).get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'Geen verificatiecode gevonden. Vraag een nieuwe code aan.' });
  }

  const data = doc.data();
  const expiresAt = Date.parse(data?.expiresAt || '');

  if (!data?.code || Number.isNaN(expiresAt) || Date.now() > expiresAt) {
    await doc.ref.delete().catch(() => {});
    return res.status(410).json({ error: 'Deze verificatiecode is verlopen. Vraag een nieuwe code aan.' });
  }

  if (data.code !== code) {
    return res.status(400).json({ error: 'Onjuiste verificatiecode.' });
  }

  await doc.ref.set({
    verifiedAt: new Date().toISOString(),
  }, { merge: true });

  return res.json({ ok: true, verified: true });
}));
