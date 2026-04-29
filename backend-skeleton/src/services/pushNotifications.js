import admin from 'firebase-admin';
import crypto from 'crypto';
import { db } from './firestore.js';

function tokenFingerprint(token = '') {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 24);
}

export async function upsertPushToken({ uid, token, transport = 'fcm_web', platform = 'web' }) {
  if (!uid || !token) return { ok: false, reason: 'missing_uid_or_token' };

  const tokenHash = tokenFingerprint(token);
  const docId = `${uid}_${tokenHash}`;
  const now = new Date().toISOString();

  await db.collection('push_devices').doc(docId).set({
    id: docId,
    uid,
    token,
    tokenHash,
    transport,
    platform,
    isActive: true,
    updatedAt: now,
    createdAt: now,
  }, { merge: true });

  // Compatibiliteit: spiegel push metadata naar bestaande actieve E2EE device-records
  // zonder cryptografische velden of status aan te passen.
  const activeDevicesSnap = await db
    .collection('devices')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();

  await Promise.all(activeDevicesSnap.docs.map((deviceDoc) => (
    deviceDoc.ref.set({
      push: {
        token,
        tokenHash,
        transport,
        platform,
        updatedAt: now,
      },
      updatedAt: now,
    }, { merge: true })
  )));

  return { ok: true, id: docId };
}

export async function sendPushToUsers({ senderUid, recipientUids = [], payload = {} }) {
  const targetUids = Array.from(new Set((recipientUids || []).filter((uid) => uid && uid !== senderUid)));
  if (targetUids.length === 0) return { ok: true, attempted: 0, sent: 0 };

  const recipients = await Promise.all(targetUids.map(async (uid) => {
    const snap = await db.collection('push_devices').where('uid', '==', uid).where('isActive', '==', true).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }));

  const tokens = recipients.flat().map((device) => device.token).filter(Boolean);
  if (tokens.length === 0) return { ok: true, attempted: 0, sent: 0 };

  const message = {
    tokens,
    data: {
      type: 'new_message',
      convId: String(payload.convId || ''),
      senderUid: String(senderUid || ''),
      messageId: String(payload.messageId || ''),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'pulse_messages',
        notificationCount: Number(payload.badgeCount || 0),
      },
    },
    notification: {
      title: 'Pulse',
      body: payload.body || 'Nieuw bericht',
    },
  };

  try {
    const result = await admin.messaging().sendEachForMulticast(message);

    await Promise.all(result.responses.map(async (response, index) => {
      if (response.success) return;
      const failingToken = tokens[index];
      const code = response.error?.code || '';
      if (!code.includes('registration-token')) return;

      const snap = await db.collection('push_devices').where('token', '==', failingToken).get();
      await Promise.all(snap.docs.map((doc) => doc.ref.set({ isActive: false, updatedAt: new Date().toISOString() }, { merge: true })));
    }));

    return { ok: true, attempted: tokens.length, sent: result.successCount, failed: result.failureCount };
  } catch (error) {
    return { ok: false, attempted: tokens.length, sent: 0, failed: tokens.length, error: error?.message || 'push_send_failed' };
  }
}
