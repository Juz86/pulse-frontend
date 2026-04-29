// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// STAP 1: Ga naar https://console.firebase.google.com
// STAP 2: Maak een nieuw project aan (bijv. "pulse-messenger")
// STAP 3: Klik op het web-icoon (</>)  →  Registreer je app
// STAP 4: Kopieer de firebaseConfig hieronder en plak jouw waarden
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { FIREBASE_CONFIG, MARKETING_URL, WEB_APP_URL } from './config/runtimeConfig';

if (typeof window !== 'undefined') {
  const runtimeOrigin = window.location.origin;
  const allowedOrigins = [WEB_APP_URL, MARKETING_URL].filter(Boolean);
  if (!allowedOrigins.includes(runtimeOrigin)) {
    console.warn(`[Pulse] Firebase runtime gestart op niet-standaard origin: ${runtimeOrigin}`);
  }
}

const app      = initializeApp(FIREBASE_CONFIG);
export const auth      = getAuth(app);
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[Pulse] Kon auth-sessie niet naar browser local persistence zetten:', error.message);
});
export const db        = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage   = getStorage(app);
export const messaging = (() => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  try {
    return getMessaging(app);
  } catch (error) {
    console.warn('[Pulse] Messaging niet beschikbaar:', error.message);
    return null;
  }
})();
export { getToken, onMessage };
export default app;
