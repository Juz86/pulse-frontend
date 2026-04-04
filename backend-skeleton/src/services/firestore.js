import admin from 'firebase-admin';
import {
  getFirebaseConfigDiagnostics,
  getFirebaseCredentialMode,
  hasExplicitFirebaseConfig,
  getServiceAccountFromEnv,
} from './firebaseConfig.js';

if (!admin.apps.length) {
  const serviceAccount = getServiceAccountFromEnv();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId || projectId,
    });
  } else {
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
}

export const db = admin.firestore();

export async function checkFirestoreReady(timeoutMs = 3000) {
  if (!hasExplicitFirebaseConfig()) {
    return {
      ok: false,
      error: 'firebase_not_configured',
      firebaseCredentialMode: getFirebaseCredentialMode(),
      firebase: getFirebaseConfigDiagnostics(),
    };
  }

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
