// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// STAP 1: Ga naar https://console.firebase.google.com
// STAP 2: Maak een nieuw project aan (bijv. "pulse-messenger")
// STAP 3: Klik op het web-icoon (</>)  →  Registreer je app
// STAP 4: Kopieer de firebaseConfig hieronder en plak jouw waarden
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:         "AIzaSyC91LqqIw8z8NH7e1ChCKD3zUo_VXQeyRY",
  authDomain:        "pulse-messenger-3cb9d.firebaseapp.com",
  projectId:         "pulse-messenger-3cb9d",
  storageBucket:     "pulse-messenger-3cb9d.firebasestorage.app",
  messagingSenderId: "764605255111",
  appId:             "1:764605255111:web:7cecff60d89c64f08e5de2",
};

const app      = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage   = getStorage(app);
export const messaging = getMessaging(app);
export { getToken, onMessage };
export default app;
