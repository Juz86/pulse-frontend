import fs from 'fs';

function has(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getFirebaseMode() {
  if (has(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) return 'service_account_json';
  if (
    has(process.env.FIREBASE_PROJECT_ID) &&
    has(process.env.FIREBASE_CLIENT_EMAIL) &&
    has(process.env.FIREBASE_PRIVATE_KEY)
  ) {
    return 'service_account_env_fields';
  }
  if (has(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return 'google_application_credentials';
  }
  return 'application_default';
}

function checkServiceAccountJson() {
  if (!has(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) {
    return { ok: true, skipped: true };
  }

  try {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const ok = has(parsed.projectId) && has(parsed.clientEmail) && has(parsed.privateKey);
    return {
      ok,
      skipped: false,
      message: ok
        ? 'FIREBASE_SERVICE_ACCOUNT_JSON parseert en bevat kernvelden.'
        : 'FIREBASE_SERVICE_ACCOUNT_JSON mist projectId/clientEmail/privateKey.',
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      message: `FIREBASE_SERVICE_ACCOUNT_JSON is geen geldige JSON: ${error.message}`,
    };
  }
}

function checkGoogleApplicationCredentialsPath() {
  if (!has(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return { ok: true, skipped: true };
  }

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const exists = fs.existsSync(path);

  return {
    ok: exists,
    skipped: false,
    message: exists
      ? `GOOGLE_APPLICATION_CREDENTIALS bestaat: ${path}`
      : `GOOGLE_APPLICATION_CREDENTIALS bestaat niet: ${path}`,
  };
}

function logLine(label, value) {
  console.log(`${label}: ${value}`);
}

function main() {
  const port = process.env.PORT || '3001';
  const firebaseMode = getFirebaseMode();
  const jsonCheck = checkServiceAccountJson();
  const pathCheck = checkGoogleApplicationCredentialsPath();

  console.log('Pulse backend skeleton preflight');
  console.log('--------------------------------');
  logLine('PORT', port);
  logLine('Firebase mode', firebaseMode);
  logLine('GOOGLE_APPLICATION_CREDENTIALS aanwezig', has(process.env.GOOGLE_APPLICATION_CREDENTIALS));
  logLine('FIREBASE_PROJECT_ID aanwezig', has(process.env.FIREBASE_PROJECT_ID));
  logLine('FIREBASE_CLIENT_EMAIL aanwezig', has(process.env.FIREBASE_CLIENT_EMAIL));
  logLine('FIREBASE_PRIVATE_KEY aanwezig', has(process.env.FIREBASE_PRIVATE_KEY));
  logLine('FIREBASE_SERVICE_ACCOUNT_JSON aanwezig', has(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));

  if (!jsonCheck.skipped) {
    logLine('FIREBASE_SERVICE_ACCOUNT_JSON check', jsonCheck.message);
  }
  if (!pathCheck.skipped) {
    logLine('GOOGLE_APPLICATION_CREDENTIALS check', pathCheck.message);
  }

  const hasAnyFirebaseConfig =
    firebaseMode !== 'application_default' || has(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  console.log('\nBeoordeling');
  console.log('-----------');

  if (!hasAnyFirebaseConfig) {
    console.log(
      'Waarschuwing: er is geen expliciete Firebase Admin-config gevonden. /readyz zal waarschijnlijk rood blijven buiten een omgeving met werkende application default credentials.'
    );
    process.exitCode = 1;
    return;
  }

  if (!jsonCheck.ok) {
    console.log('Waarschuwing: de FIREBASE_SERVICE_ACCOUNT_JSON configuratie lijkt ongeldig.');
    process.exitCode = 1;
    return;
  }

  if (!pathCheck.ok) {
    console.log('Waarschuwing: het GOOGLE_APPLICATION_CREDENTIALS pad lijkt ongeldig.');
    process.exitCode = 1;
    return;
  }

  console.log('Preflight ziet een plausibele configuratie. Firestore-bereikbaarheid moet nog steeds apart via /readyz worden bevestigd.');
}

main();
