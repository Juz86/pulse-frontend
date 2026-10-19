const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const backendUrl = String(process.env.PULSE_E2EE_QA_BACKEND_URL || '').replace(/\/+$/, '');
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
  if (result.status !== 0) process.exit(result.status || 1);
}

requireIsolatedBackend(backendUrl);

const qaEnvironment = {
  ...process.env,
  REACT_APP_SITE_TARGET: 'webapp',
  REACT_APP_E2EE_MODE: 'signal',
  REACT_APP_E2EE_TRANSPORT: 'v2',
  REACT_APP_E2EE_V2_QA_ENABLED: 'true',
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
run('./gradlew', [':app:assembleDebug', '-PpulseE2eeQa=true', '--console=plain'], {
  cwd: path.join(projectRoot, 'android'),
  env: {
    ...qaEnvironment,
    GRADLE_USER_HOME: path.join(projectRoot, '.gradle-android'),
  },
});

console.log('E2EE QA-APK: android/app/build/outputs/apk/debug/app-debug.apk');
