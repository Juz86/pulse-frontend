// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// STAP 1: Ga naar https://console.firebase.google.com
// STAP 2: Maak een nieuw project aan (bijv. "pulse-messenger")
// STAP 3: Klik op het web-icoon (</>)  →  Registreer je app
// STAP 4: Kopieer de firebaseConfig hieronder en plak jouw waarden
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { browserSessionPersistence, getAuth, setPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { APP_URL, MARKETING_URL } from './config/appConfig';

const firebaseConfig = {
  apiKey:         "AIzaSyC91LqqIw8z8NH7e1ChCKD3zUo_VXQeyRY",
  authDomain:     "pulse-messenger-3cb9d.firebaseapp.com",
  projectId:         "pulse-messenger-3cb9d",
  storageBucket:     "pulse-messenger-3cb9d.firebasestorage.app",
  messagingSenderId: "764605255111",
  appId:             "1:764605255111:web:7cecff60d89c64f08e5de2",
};

if (typeof window !== 'undefined') {
  const runtimeOrigin = window.location.origin;
  const allowedOrigins = [APP_URL, MARKETING_URL].filter(Boolean);
  if (!allowedOrigins.includes(runtimeOrigin)) {
    console.warn(`[Pulse] Firebase runtime gestart op niet-standaard origin: ${runtimeOrigin}`);
  }
}

const app      = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const authPersistenceReady = setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.warn('[Pulse] Kon auth-sessie niet naar browser session persistence zetten:', error.message);
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
