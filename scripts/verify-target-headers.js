const fs = require('fs');
const path = require('path');

const target = process.env.REACT_APP_SITE_TARGET === 'landing' ? 'landing' : 'webapp';
const browserE2eeQaEnabled = process.env.REACT_APP_E2EE_V2_BROWSER_QA_ENABLED === 'true';
const headersPath = path.join(process.cwd(), 'build', '_headers');
const indexHtmlPath = path.join(process.cwd(), 'build', 'index.html');

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

if (!fs.existsSync(indexHtmlPath)) {
  console.error(`Missing build index file: ${indexHtmlPath}`);
  process.exit(1);
}

const headers = fs.readFileSync(headersPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
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

if (browserE2eeQaEnabled && fs.existsSync(path.join(process.cwd(), 'build', 'e2ee-storage-bridge.html'))) {
  violations.push('Browser E2EE QA build must not contain the legacy storage bridge');
}

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
  if (browserE2eeQaEnabled) {
    if (cspLine.includes("script-src 'self' 'unsafe-inline'")) {
      violations.push('Browser E2EE QA CSP must not allow unsafe-inline scripts');
    }
    if (!cspLine.includes("script-src 'self' 'wasm-unsafe-eval'")) {
      violations.push('Browser E2EE QA CSP must allow only the scoped WASM evaluator');
    }
    if (!cspLine.includes("worker-src 'self'")) {
      violations.push('Browser E2EE QA CSP must restrict workers to self');
    }
    if (cspLine.includes("worker-src 'self' blob:")) {
      violations.push('Browser E2EE QA CSP must not allow blob workers');
    }
    if (cspLine.includes('sentry.io')) {
      violations.push('Browser E2EE QA CSP must not allow third-party error telemetry');
    }
  }
}

const expectedTargetMarker = `<meta name="pulse-target" content="${target}"`;
if (!indexHtml.includes(expectedTargetMarker)) {
  violations.push(`build/index.html must include ${expectedTargetMarker}`);
}

if (violations.length) {
  console.error(`${target} header verification failed:`);
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`${target} headers verified.`);
