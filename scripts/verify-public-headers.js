const fs = require('fs');
const path = require('path');

const headersPath = path.join(process.cwd(), 'public', '_headers');
const headers = fs.readFileSync(headersPath, 'utf8');
const apiUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || 'https://api.pulse-messenger.com';
const wsUrl = process.env.REACT_APP_WS_URL || apiUrl;
const signalingUrl = process.env.REACT_APP_SIGNALING_URL || wsUrl;

function websocketOriginFromUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsed.host}`;
  } catch {
    return '';
  }
}

const webappOnlySources = Array.from(new Set([
  new URL(apiUrl).host,
  'firebaseio.com',
  'firebaseapp.com',
  'fcm.googleapis.com',
  'firebasestorage.googleapis.com',
  websocketOriginFromUrl(wsUrl),
  websocketOriginFromUrl(signalingUrl),
].filter(Boolean)));

const violations = webappOnlySources.filter((source) => headers.includes(source));

if (violations.length) {
  console.error('public/_headers must stay landing-safe. Remove webapp-only sources:');
  violations.forEach((source) => console.error(`- ${source}`));
  process.exit(1);
}

console.log('public/_headers fallback is landing-safe.');
