const fs = require('fs');
const path = require('path');

const target = process.env.REACT_APP_SITE_TARGET === 'landing' ? 'landing' : 'webapp';
const buildDir = path.join(process.cwd(), 'build');
const headersPath = path.join(buildDir, '_headers');
const indexHtmlPath = path.join(buildDir, 'index.html');
const robotsPath = path.join(buildDir, 'robots.txt');
const sitemapPath = path.join(buildDir, 'sitemap.xml');

const MARKETING_URL = (process.env.REACT_APP_MARKETING_URL || 'https://pulse-messenger.com').replace(/\/+$/, '');
const APP_URL = (
  process.env.REACT_APP_APP_URL ||
  process.env.REACT_APP_WEB_APP_URL ||
  'https://web.pulse-messenger.com'
).replace(/\/+$/, '');
const canonicalBaseUrl = target === 'landing' ? MARKETING_URL : APP_URL;
const logoUrl = `${canonicalBaseUrl}/logo512.png`;

const commonHeaders = [
  'X-Frame-Options: DENY',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy: same-origin',
];

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
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://*.firebaseapp.com https://*.googleapis.com",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleusercontent.com",
  "connect-src 'self' https://api.pulse-messenger.com wss://api.pulse-messenger.com https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://firebasestorage.googleapis.com https://fcm.googleapis.com https://*.ingest.de.sentry.io https://*.ingest.sentry.io",
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

const headers = [
  '/*',
  ...commonHeaders.map((header) => `  ${header}`),
  `  Content-Security-Policy: ${target === 'landing' ? landingCsp : webappCsp}`,
  '',
  '/',
  '  Cache-Control: no-cache, no-store, must-revalidate',
  '',
  '/index.html',
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

function writeTargetMetadata() {
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`Build index not found: ${indexHtmlPath}`);
  }

  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const nextHtml = replaceAll(html, [
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonicalBaseUrl}/" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonicalBaseUrl}/" />`],
    [/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${logoUrl}" />`],
    [/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${logoUrl}" />`],
    [/"url": "https:\/\/[^"]*"/, `"url": "${canonicalBaseUrl}/"`],
    [/"logo": "https:\/\/[^"]*"/, `"logo": "${logoUrl}"`],
  ]);

  fs.writeFileSync(indexHtmlPath, nextHtml);
  console.log(`Wrote ${target} metadata to build/index.html.`);
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
writeTargetCrawlerFiles();
