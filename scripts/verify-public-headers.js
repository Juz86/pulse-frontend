const fs = require('fs');
const path = require('path');

const headersPath = path.join(process.cwd(), 'public', '_headers');
const headers = fs.readFileSync(headersPath, 'utf8');

const webappOnlySources = [
  'api.pulse-messenger.com',
  'firebaseio.com',
  'firebaseapp.com',
  'fcm.googleapis.com',
  'firebasestorage.googleapis.com',
  'wss://api.pulse-messenger.com',
];

const violations = webappOnlySources.filter((source) => headers.includes(source));

if (violations.length) {
  console.error('public/_headers must stay landing-safe. Remove webapp-only sources:');
  violations.forEach((source) => console.error(`- ${source}`));
  process.exit(1);
}

console.log('public/_headers fallback is landing-safe.');
