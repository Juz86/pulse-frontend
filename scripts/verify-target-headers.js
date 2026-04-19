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
];

const violations = [];

if (target === 'landing') {
  for (const source of webappOnlySources) {
    if (cspLine.includes(source)) {
      violations.push(`Landing CSP must not include ${source}`);
    }
  }
} else {
  for (const source of webappOnlySources) {
    if (!cspLine.includes(source)) {
      violations.push(`Webapp CSP must include ${source}`);
    }
  }
}

if (violations.length) {
  console.error(`${target} header verification failed:`);
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`${target} headers verified.`);
