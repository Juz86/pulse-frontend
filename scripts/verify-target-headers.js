const fs = require('fs');
const path = require('path');

const target = process.env.REACT_APP_SITE_TARGET === 'landing' ? 'landing' : 'webapp';
const headersPath = path.join(process.cwd(), 'build', '_headers');

function websocketOriginFromUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsed.host}`;
  } catch {
    return '';
  }
}

const apiUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'https://api.pulse-messenger.com';
const wsUrl = process.env.REACT_APP_WS_URL || apiUrl;
const signalingUrl = process.env.REACT_APP_SIGNALING_URL || wsUrl;
const webappOnlySources = Array.from(new Set([
  new URL(apiUrl).host,
  'firebaseio.com',
  'firebaseapp.com',
  'fcm.googleapis.com',
  'firebasestorage.googleapis.com',
  websocketOriginFromUrl(wsUrl),
  websocketOriginFromUrl(signalingUrl),
  'wss://firestore.googleapis.com',
].filter(Boolean)));

if (!fs.existsSync(headersPath)) {
  console.error(`Missing Cloudflare headers file: ${headersPath}`);
  process.exit(1);
}

const headers = fs.readFileSync(headersPath, 'utf8');
const cspLine = headers
  .split('\n')
  .find((line) => line.trim().startsWith('Content-Security-Policy:'));
const permissionsPolicyLine = headers
  .split('\n')
  .find((line) => line.trim().startsWith('Permissions-Policy:'));

if (!cspLine) {
  console.error('Missing Content-Security-Policy in build/_headers.');
  process.exit(1);
}

const violations = [];

if (target === 'landing') {
  for (const source of webappOnlySources) {
    if (cspLine.includes(source)) {
      violations.push(`Landing CSP must not include ${source}`);
    }
  }
  if (!permissionsPolicyLine?.includes('camera=()')) {
    violations.push('Landing Permissions-Policy must keep camera=()');
  }
  if (!permissionsPolicyLine?.includes('microphone=()')) {
    violations.push('Landing Permissions-Policy must keep microphone=()');
  }
} else {
  for (const source of webappOnlySources) {
    if (!cspLine.includes(source)) {
      violations.push(`Webapp CSP must include ${source}`);
    }
  }
  if (!permissionsPolicyLine?.includes('camera=(self)')) {
    violations.push('Webapp Permissions-Policy must allow camera=(self)');
  }
  if (!permissionsPolicyLine?.includes('microphone=(self)')) {
    violations.push('Webapp Permissions-Policy must allow microphone=(self)');
  }
}

if (violations.length) {
  console.error(`${target} header verification failed:`);
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`${target} headers verified.`);
