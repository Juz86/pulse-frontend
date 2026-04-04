export function normalizePrivateKey(value) {
  return value ? value.replace(/\\n/g, '\n') : undefined;
}

function has(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getServiceAccountFromEnv(env = process.env) {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
    };
  }

  return null;
}

export function getFirebaseCredentialMode(env = process.env) {
  if (has(env.FIRESTORE_EMULATOR_HOST) && has(env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT)) {
    return 'firestore_emulator';
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) return 'service_account_json';
  if (
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY
  ) {
    return 'service_account_env_fields';
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return 'google_application_credentials';
  }
  return 'application_default';
}

export function hasExplicitFirebaseConfig(env = process.env) {
  return !!(
    (
      has(env.FIRESTORE_EMULATOR_HOST) &&
      has(env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT)
    ) ||
    env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    env.GOOGLE_APPLICATION_CREDENTIALS ||
    (
      env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY
    )
  );
}

export function getFirebaseConfigDiagnostics(env = process.env) {
  const hasServiceAccountJson = !!env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasProjectId = !!env.FIREBASE_PROJECT_ID;
  const hasGcloudProject = !!env.GCLOUD_PROJECT;
  const hasClientEmail = !!env.FIREBASE_CLIENT_EMAIL;
  const hasPrivateKey = !!env.FIREBASE_PRIVATE_KEY;
  const hasGoogleApplicationCredentials = !!env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasFirestoreEmulatorHost = !!env.FIRESTORE_EMULATOR_HOST;

  let jsonParseOk = null;
  if (hasServiceAccountJson) {
    try {
      JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      jsonParseOk = true;
    } catch {
      jsonParseOk = false;
    }
  }

  return {
    credentialMode: getFirebaseCredentialMode(env),
    hasServiceAccountJson,
    serviceAccountJsonParseOk: jsonParseOk,
    hasProjectId,
    hasGcloudProject,
    hasClientEmail,
    hasPrivateKey,
    hasGoogleApplicationCredentials,
    hasFirestoreEmulatorHost,
  };
}
