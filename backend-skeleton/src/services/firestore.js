import admin from 'firebase-admin';
import {
  getFirebaseConfigDiagnostics,
  getFirebaseCredentialMode,
  getServiceAccountFromEnv,
} from './firebaseConfig.js';

if (!admin.apps.length) {
  const serviceAccount = getServiceAccountFromEnv();

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }
}

export const db = admin.firestore();

export async function checkFirestoreReady(timeoutMs = 3000) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('firestore_timeout')), timeoutMs);
  });

  const probe = (async () => {
    await db.listCollections();
    return true;
  })();

  try {
    await Promise.race([probe, timeout]);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error.message || 'firestore_unavailable',
    };
  }
}
