import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFirebaseConfigDiagnostics,
  getFirebaseCredentialMode,
  hasExplicitFirebaseConfig,
  getServiceAccountFromEnv,
  normalizePrivateKey,
} from './firebaseConfig.js';

test('normalizePrivateKey converts escaped newlines', () => {
  assert.equal(
    normalizePrivateKey('line1\\nline2'),
    'line1\nline2'
  );
});

test('getFirebaseCredentialMode detects service account json', () => {
  const env = {
    FIREBASE_SERVICE_ACCOUNT_JSON: '{"projectId":"demo","clientEmail":"x","privateKey":"y"}',
  };

  assert.equal(getFirebaseCredentialMode(env), 'service_account_json');
});

test('getFirebaseCredentialMode detects firestore emulator mode', () => {
  const env = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_PROJECT_ID: 'demo-pulse',
  };

  assert.equal(getFirebaseCredentialMode(env), 'firestore_emulator');
});

test('getFirebaseCredentialMode detects env field credentials', () => {
  const env = {
    FIREBASE_PROJECT_ID: 'demo',
    FIREBASE_CLIENT_EMAIL: 'demo@example.com',
    FIREBASE_PRIVATE_KEY: 'key',
  };

  assert.equal(getFirebaseCredentialMode(env), 'service_account_env_fields');
});

test('getServiceAccountFromEnv parses JSON secret', () => {
  const env = {
    FIREBASE_SERVICE_ACCOUNT_JSON: '{"projectId":"demo","clientEmail":"demo@example.com","privateKey":"secret"}',
  };

  assert.deepEqual(getServiceAccountFromEnv(env), {
    projectId: 'demo',
    clientEmail: 'demo@example.com',
    privateKey: 'secret',
  });
});

test('getServiceAccountFromEnv builds object from env fields', () => {
  const env = {
    FIREBASE_PROJECT_ID: 'demo',
    FIREBASE_CLIENT_EMAIL: 'demo@example.com',
    FIREBASE_PRIVATE_KEY: 'line1\\nline2',
  };

  assert.deepEqual(getServiceAccountFromEnv(env), {
    projectId: 'demo',
    clientEmail: 'demo@example.com',
    privateKey: 'line1\nline2',
  });
});

test('getFirebaseConfigDiagnostics reports invalid JSON safely', () => {
  const env = {
    FIREBASE_SERVICE_ACCOUNT_JSON: '{"projectId":',
  };

  assert.deepEqual(getFirebaseConfigDiagnostics(env), {
    credentialMode: 'service_account_json',
    hasServiceAccountJson: true,
    serviceAccountJsonParseOk: false,
    hasProjectId: false,
    hasGcloudProject: false,
    hasClientEmail: false,
    hasPrivateKey: false,
    hasGoogleApplicationCredentials: false,
    hasFirestoreEmulatorHost: false,
  });
});

test('hasExplicitFirebaseConfig accepts firestore emulator configuration', () => {
  const env = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_PROJECT_ID: 'demo-pulse',
  };

  assert.equal(hasExplicitFirebaseConfig(env), true);
});

test('getFirebaseConfigDiagnostics reports emulator fields', () => {
  const env = {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GCLOUD_PROJECT: 'demo-pulse',
  };

  assert.deepEqual(getFirebaseConfigDiagnostics(env), {
    credentialMode: 'firestore_emulator',
    hasServiceAccountJson: false,
    serviceAccountJsonParseOk: null,
    hasProjectId: false,
    hasGcloudProject: true,
    hasClientEmail: false,
    hasPrivateKey: false,
    hasGoogleApplicationCredentials: false,
    hasFirestoreEmulatorHost: true,
  });
});
