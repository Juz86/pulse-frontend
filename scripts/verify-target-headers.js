const fs = require('fs');
const path = require('path');

const target = process.env.REACT_APP_SITE_TARGET === 'landing' ? 'landing' : 'webapp';
const headersPath = path.join(process.cwd(), 'build', '_headers');

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

const webappOnlySources = [
  'api.pulse-messenger.com',
  'firebaseio.com',
  'firebaseapp.com',
  'fcm.googleapis.com',
  'firebasestorage.googleapis.com',
  'wss://api.pulse-messenger.com',
  'wss://firestore.googleapis.com',
];

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
