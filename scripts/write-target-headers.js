const fs = require('fs');
const path = require('path');

const target = process.env.REACT_APP_SITE_TARGET === 'landing' ? 'landing' : 'webapp';
const buildDir = path.join(process.cwd(), 'build');
const headersPath = path.join(buildDir, '_headers');
const indexHtmlPath = path.join(buildDir, 'index.html');
const legacyBridgePath = path.join(buildDir, 'e2ee-storage-bridge.html');
const firebaseMessagingSwPath = path.join(buildDir, 'firebase-messaging-sw.js');
const robotsPath = path.join(buildDir, 'robots.txt');
const sitemapPath = path.join(buildDir, 'sitemap.xml');
const assetManifestPath = path.join(buildDir, 'asset-manifest.json');

const DEFAULT_MARKETING_URL = 'https://pulse-messenger.com';
const DEFAULT_WEB_APP_URL = 'https://web.pulse-messenger.com';
const DEFAULT_API_URL = 'https://api.pulse-messenger.com';
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC91LqqIw8z8NH7e1ChCKD3zUo_VXQeyRY',
  authDomain: 'pulse-messenger-3cb9d.firebaseapp.com',
  projectId: 'pulse-messenger-3cb9d',
  storageBucket: 'pulse-messenger-3cb9d.firebasestorage.app',
  messagingSenderId: '764605255111',
  appId: '1:764605255111:web:7cecff60d89c64f08e5de2',
};
const STABLE_ENTRY_ALIASES = {
  js: ['main.latest.js', 'main.dcb481f2.js'],
  css: ['main.latest.css', 'main.2fb0d8de.css'],
};

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function originFromUrl(value, fallback = '') {
  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

function websocketOriginFromUrl(value) {
  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

const MARKETING_URL = trimTrailingSlash(process.env.REACT_APP_MARKETING_URL || DEFAULT_MARKETING_URL);
const APP_URL = trimTrailingSlash(
  process.env.REACT_APP_APP_URL ||
  process.env.REACT_APP_WEB_APP_URL ||
  DEFAULT_WEB_APP_URL
);
const API_URL = trimTrailingSlash(
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  DEFAULT_API_URL
);
const WS_URL = trimTrailingSlash(process.env.REACT_APP_WS_URL || API_URL);
const SIGNALING_URL = trimTrailingSlash(process.env.REACT_APP_SIGNALING_URL || WS_URL);
const RTC_CONFIG_URL = trimTrailingSlash(process.env.REACT_APP_RTC_CONFIG_URL || API_URL);
const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: process.env.REACT_APP_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
};
const canonicalBaseUrl = target === 'landing' ? MARKETING_URL : APP_URL;
const logoUrl = `${canonicalBaseUrl}/logo512.png`;
const apiOrigin = originFromUrl(API_URL, DEFAULT_API_URL);
const signalingOrigin = originFromUrl(SIGNALING_URL, apiOrigin);
const rtcConfigOrigin = originFromUrl(RTC_CONFIG_URL, apiOrigin);
const wsOrigin = websocketOriginFromUrl(WS_URL);
const signalingWsOrigin = websocketOriginFromUrl(SIGNALING_URL);
const connectSources = Array.from(new Set([
  "'self'",
  apiOrigin,
  signalingOrigin,
  rtcConfigOrigin,
  wsOrigin,
  signalingWsOrigin,
  'https://*.firebaseio.com',
  'wss://*.firebaseio.com',
  'https://*.googleapis.com',
  'wss://firestore.googleapis.com',
  'https://firebasestorage.googleapis.com',
  'https://fcm.googleapis.com',
  'https://*.ingest.de.sentry.io',
  'https://*.ingest.sentry.io',
].filter(Boolean)));
const mediaSources = Array.from(new Set([
  "'self'",
  'blob:',
  apiOrigin,
  'https://firebasestorage.googleapis.com',
].filter(Boolean)));
const imageSources = Array.from(new Set([
  "'self'",
  'data:',
  'blob:',
  apiOrigin,
  'https://firebasestorage.googleapis.com',
  'https://*.googleusercontent.com',
].filter(Boolean)));

const commonHeaders = [
  'X-Frame-Options: DENY',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy: same-origin',
];

const landingPermissionsPolicy = 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()';
const webappPermissionsPolicy = 'camera=(self), microphone=(self), geolocation=(), interest-cohort=(), browsing-topics=()';

const landingCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.ingest.de.sentry.io https://*.ingest.sentry.io",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const webappCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src ${imageSources.join(' ')}`,
  `connect-src ${connectSources.join(' ')}`,
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  `media-src ${mediaSources.join(' ')}`,
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const headers = [
  '/*',
  ...commonHeaders.map((header) => `  ${header}`),
  `  Permissions-Policy: ${target === 'landing' ? landingPermissionsPolicy : webappPermissionsPolicy}`,
  `  Content-Security-Policy: ${target === 'landing' ? landingCsp : webappCsp}`,
  '',
  '/',
  '  Cache-Control: no-cache, no-store, must-revalidate',
  '',
  '/index.html',
  '  Cache-Control: no-cache, no-store, must-revalidate',
  '',
  '/static/js/main.latest.js',
  '  Cache-Control: no-cache, no-store, must-revalidate',
  '',
  '/static/css/main.latest.css',
  '  Cache-Control: no-cache, no-store, must-revalidate',
  '',
  '/static/js/main.dcb481f2.js',
  '  Cache-Control: no-cache, no-store, must-revalidate',
  '',
  '/static/css/main.2fb0d8de.css',
  '  Cache-Control: no-cache, no-store, must-revalidate',
  '',
  '/static/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
].join('\n');

if (!fs.existsSync(buildDir)) {
  throw new Error(`Build folder not found: ${buildDir}`);
}

fs.writeFileSync(headersPath, headers);
console.log(`Wrote ${target} security headers to build/_headers.`);

function replaceAll(html, replacements) {
  return replacements.reduce((nextHtml, [pattern, value]) => nextHtml.replace(pattern, value), html);
}

function writeStableEntryAssets() {
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`Build index not found: ${indexHtmlPath}`);
  }

  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  const jsMatch = html.match(/\/static\/js\/(main\.[^"]+\.js)/);
  const cssMatch = html.match(/\/static\/css\/(main\.[^"]+\.css)/);

  if (!jsMatch || !cssMatch) {
    throw new Error('Unable to locate main JS/CSS entry assets in build/index.html');
  }

  const currentJsFile = jsMatch[1];
  const currentCssFile = cssMatch[1];
  const currentJsPath = path.join(buildDir, 'static', 'js', currentJsFile);
  const currentCssPath = path.join(buildDir, 'static', 'css', currentCssFile);

  for (const alias of STABLE_ENTRY_ALIASES.js) {
    const aliasPath = path.join(buildDir, 'static', 'js', alias);
    if (path.basename(currentJsPath) !== alias) {
      fs.copyFileSync(currentJsPath, aliasPath);
    }
  }

  for (const alias of STABLE_ENTRY_ALIASES.css) {
    const aliasPath = path.join(buildDir, 'static', 'css', alias);
    if (path.basename(currentCssPath) !== alias) {
      fs.copyFileSync(currentCssPath, aliasPath);
    }
  }

  html = html
    .replace(`/static/js/${currentJsFile}`, '/static/js/main.latest.js')
    .replace(`/static/css/${currentCssFile}`, '/static/css/main.latest.css');

  fs.writeFileSync(indexHtmlPath, html);

  if (fs.existsSync(assetManifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(assetManifestPath, 'utf8'));
    if (manifest.files) {
      manifest.files['main.js'] = '/static/js/main.latest.js';
      manifest.files['main.css'] = '/static/css/main.latest.css';
    }
    if (manifest.entrypoints) {
      manifest.entrypoints = manifest.entrypoints.map((entry) => {
        if (entry === `static/js/${currentJsFile}`) return 'static/js/main.latest.js';
        if (entry === `static/css/${currentCssFile}`) return 'static/css/main.latest.css';
        return entry;
      });
    }
    fs.writeFileSync(assetManifestPath, JSON.stringify(manifest, null, 2));
  }

  console.log(`Aliased stable webapp entry assets: ${currentJsFile} -> main.latest.js, ${currentCssFile} -> main.latest.css`);
}

function writeTargetMetadata() {
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`Build index not found: ${indexHtmlPath}`);
  }

  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const nextHtml = replaceAll(html, [
    [/<meta name="pulse-target" content="[^"]*"\s*\/>/, `<meta name="pulse-target" content="${target}" />`],
    [/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonicalBaseUrl}/" />`],
    [/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonicalBaseUrl}/" />`],
    [/<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${logoUrl}" />`],
    [/<meta name="twitter:image" content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${logoUrl}" />`],
    [/"url": "https:\/\/[^"]*"/, `"url": "${canonicalBaseUrl}/"`],
    [/"logo": "https:\/\/[^"]*"/, `"logo": "${logoUrl}"`],
  ]);

  fs.writeFileSync(indexHtmlPath, nextHtml);
  console.log(`Wrote ${target} metadata to build/index.html.`);

  if (fs.existsSync(legacyBridgePath)) {
    const bridgeHtml = fs.readFileSync(legacyBridgePath, 'utf8')
      .replace(/__PULSE_WEBAPP_ORIGIN__/g, APP_URL);
    fs.writeFileSync(legacyBridgePath, bridgeHtml);
    console.log(`Wrote webapp bridge origin to build/e2ee-storage-bridge.html.`);
  }

  if (fs.existsSync(firebaseMessagingSwPath)) {
    const messagingSw = fs.readFileSync(firebaseMessagingSwPath, 'utf8');
    const nextMessagingSw = replaceAll(messagingSw, [
      [/__PULSE_FIREBASE_API_KEY__/g, FIREBASE_CONFIG.apiKey],
      [/__PULSE_FIREBASE_AUTH_DOMAIN__/g, FIREBASE_CONFIG.authDomain],
      [/__PULSE_FIREBASE_PROJECT_ID__/g, FIREBASE_CONFIG.projectId],
      [/__PULSE_FIREBASE_STORAGE_BUCKET__/g, FIREBASE_CONFIG.storageBucket],
      [/__PULSE_FIREBASE_MESSAGING_SENDER_ID__/g, FIREBASE_CONFIG.messagingSenderId],
      [/__PULSE_FIREBASE_APP_ID__/g, FIREBASE_CONFIG.appId],
    ]);
    fs.writeFileSync(firebaseMessagingSwPath, nextMessagingSw);
    console.log(`Wrote Firebase runtime config to build/firebase-messaging-sw.js.`);
  }
}

function writeTargetCrawlerFiles() {
  if (target === 'landing') {
    fs.writeFileSync(robotsPath, [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      `Sitemap: ${MARKETING_URL}/sitemap.xml`,
      '',
    ].join('\n'));
    return;
  }

  fs.writeFileSync(robotsPath, [
    'User-agent: *',
    'Disallow: /',
    '',
  ].join('\n'));

  if (fs.existsSync(sitemapPath)) {
    fs.rmSync(sitemapPath);
  }
}

writeTargetMetadata();
writeStableEntryAssets();
writeTargetCrawlerFiles();
