function setDefaultEnv(name, value) {
  if (!process.env[name]) {
    process.env[name] = value;
  }
}

export function applyLocalFirestoreEmulatorEnv() {
  setDefaultEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
  setDefaultEnv('FIREBASE_PROJECT_ID', 'pulse-messenger-3cb9d');
  setDefaultEnv('ALLOW_DEV_AUTH_BYPASS', 'true');
}
