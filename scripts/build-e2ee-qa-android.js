const {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const backendUrl = String(process.env.PULSE_E2EE_QA_BACKEND_URL || '').replace(/\/+$/, '');
const qaInstance = String(process.env.PULSE_E2EE_QA_INSTANCE || 'a').toLowerCase();
const groupsEnabled = String(process.env.PULSE_E2EE_QA_GROUPS || '').toLowerCase() === 'true';
const callsEnabled = String(process.env.PULSE_E2EE_QA_CALLS || '').toLowerCase() === 'true';
const googleServicesPath = String(process.env.PULSE_E2EE_QA_GOOGLE_SERVICES_PATH || '').trim();
const QA_FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyD832WLALBNkGglRGtA_NpmqEofsuyeoJo',
  authDomain: 'pulse-messenger-e2ee-qa.firebaseapp.com',
  projectId: 'pulse-messenger-e2ee-qa',
  storageBucket: 'pulse-messenger-e2ee-qa.firebasestorage.app',
  messagingSenderId: '620203343589',
  appId: '1:620203343589:web:956ee757c2589528b69e0c',
});

function requireIsolatedBackend(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Stel PULSE_E2EE_QA_BACKEND_URL in op de aparte QA-backend.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname === 'api.pulse-messenger.com') {
    throw new Error('De E2EE QA-build mag nooit de productiebackend gebruiken.');
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    const error = new Error(`${command} is mislukt met exitcode ${result.status || 1}.`);
    error.exitCode = result.status || 1;
    throw error;
  }
}

function validateGoogleServicesConfig(filePath, expectedPackageName) {
  if (!filePath || !existsSync(filePath)) {
    throw new Error(
      'Stel PULSE_E2EE_QA_GOOGLE_SERVICES_PATH in op de officiele QA google-services.json.',
    );
  }
  const config = JSON.parse(readFileSync(filePath, 'utf8'));
  if (config?.project_info?.project_id !== QA_FIREBASE_CONFIG.projectId) {
    throw new Error('De Android Firebase-config hoort niet bij het aparte E2EE QA-project.');
  }
  const packages = (config?.client || [])
    .map((client) => client?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
  if (!packages.includes(expectedPackageName)) {
    throw new Error(`De Android Firebase-config bevat ${expectedPackageName} niet.`);
  }
}

requireIsolatedBackend(backendUrl);
if (!/^[a-z0-9]+$/.test(qaInstance)) {
  throw new Error('PULSE_E2EE_QA_INSTANCE mag alleen kleine letters en cijfers bevatten.');
}
const qaPackageSuffix = qaInstance === 'a' ? '' : qaInstance;
const qaPackageName = `com.pulsemessenger.chat.e2eeqa${qaPackageSuffix}`;
validateGoogleServicesConfig(googleServicesPath, qaPackageName);

const qaEnvironment = {
  ...process.env,
  REACT_APP_SITE_TARGET: 'webapp',
  REACT_APP_E2EE_MODE: 'signal',
  REACT_APP_E2EE_TRANSPORT: 'v2',
  REACT_APP_E2EE_V2_QA_ENABLED: 'true',
  REACT_APP_E2EE_V2_GROUPS_ENABLED: groupsEnabled ? 'true' : 'false',
  REACT_APP_E2EE_V2_QA_BACKEND_URL: backendUrl,
  REACT_APP_API_URL: backendUrl,
  REACT_APP_BACKEND_URL: backendUrl,
  REACT_APP_NATIVE_API_URL: backendUrl,
  REACT_APP_WS_URL: backendUrl,
  REACT_APP_FIREBASE_API_KEY: QA_FIREBASE_CONFIG.apiKey,
  REACT_APP_FIREBASE_AUTH_DOMAIN: QA_FIREBASE_CONFIG.authDomain,
  REACT_APP_FIREBASE_PROJECT_ID: QA_FIREBASE_CONFIG.projectId,
  REACT_APP_FIREBASE_STORAGE_BUCKET: QA_FIREBASE_CONFIG.storageBucket,
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: QA_FIREBASE_CONFIG.messagingSenderId,
  REACT_APP_FIREBASE_APP_ID: QA_FIREBASE_CONFIG.appId,
};

run('npm', ['run', 'build:webapp'], { env: qaEnvironment });
run(path.join(projectRoot, 'node_modules', '.bin', 'cap'), ['copy', 'android'], {
  env: qaEnvironment,
});
const googleServicesDestination = path.join(projectRoot, 'android/app/google-services.json');
const originalGoogleServices = existsSync(googleServicesDestination)
  ? readFileSync(googleServicesDestination)
  : null;
try {
  copyFileSync(googleServicesPath, googleServicesDestination);
  run('./gradlew', [
    ':app:clean',
    ':app:assembleDebug',
    '-PpulseE2eeQa=true',
    `-PpulseE2eeQaInstance=${qaInstance}`,
    `-PpulseCallE2ee=${callsEnabled}`,
    '--console=plain',
  ], {
    cwd: path.join(projectRoot, 'android'),
    env: {
      ...qaEnvironment,
      GRADLE_USER_HOME: path.join(projectRoot, '.gradle-android'),
    },
  });
} finally {
  if (originalGoogleServices) {
    writeFileSync(googleServicesDestination, originalGoogleServices);
  } else if (existsSync(googleServicesDestination)) {
    unlinkSync(googleServicesDestination);
  }
}

const defaultApk = path.join(projectRoot, 'android/app/build/outputs/apk/debug/app-debug.apk');
const artifactDirectory = path.join(projectRoot, 'artifacts/e2ee-qa');
const namedApk = path.join(artifactDirectory, `pulse-e2ee-qa-${qaInstance}-debug.apk`);
mkdirSync(artifactDirectory, { recursive: true });
copyFileSync(defaultApk, namedApk);
console.log(
  `E2EE QA-APK: ${path.relative(projectRoot, namedApk)} `
  + `(groups=${groupsEnabled}, calls=${callsEnabled})`,
);
