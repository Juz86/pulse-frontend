#!/usr/bin/env node

/*
 * Creates the signed, downloadable web bundle consumed by Pulse Android.
 *
 * The private ECDSA P-256 key is deliberately never stored in this repository.
 * Configure PULSE_NATIVE_UPDATE_SIGNING_PRIVATE_KEY as a Cloudflare Pages
 * build secret (base64 encoded PEM) and PULSE_NATIVE_UPDATE_VERSION for each
 * deployment. The matching public key is compiled into the Android app.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const buildDir = path.join(process.cwd(), 'build');
const privateKeyInput = String(process.env.PULSE_NATIVE_UPDATE_SIGNING_PRIVATE_KEY || '').trim();

if (!privateKeyInput) {
  console.log('[Pulse] Native update package skipped: signing key is not configured.');
  process.exit(0);
}

if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  throw new Error('build/index.html ontbreekt; voer eerst een webapp-build uit.');
}

function readPrivateKey(value) {
  if (value.includes('BEGIN PRIVATE KEY')) return value.replace(/\\n/g, '\n');
  return Buffer.from(value, 'base64').toString('utf8');
}

function safeVersion(value) {
  const normalized = String(value || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(normalized)) {
    throw new Error('PULSE_NATIVE_UPDATE_VERSION moet 1-80 tekens bevatten: letters, cijfers, punt, streepje of underscore.');
  }
  return normalized;
}

const version = safeVersion(
  process.env.PULSE_NATIVE_UPDATE_VERSION
  || process.env.CF_PAGES_COMMIT_SHA
  || process.env.GITHUB_SHA
);
const webOrigin = String(process.env.REACT_APP_WEB_APP_URL || 'https://web.pulse-messenger.com').replace(/\/+$/, '');
const parsedOrigin = new URL(webOrigin);
if (parsedOrigin.protocol !== 'https:' || parsedOrigin.hostname !== 'web.pulse-messenger.com') {
  throw new Error('Native updates mogen uitsluitend vanaf https://web.pulse-messenger.com worden gepubliceerd.');
}

const outputDir = path.join(buildDir, 'native-updates');
const zipName = `pulse-web-${version}.zip`;
const zipPath = path.join(outputDir, zipName);
const manifestPath = path.join(outputDir, 'latest.json');
const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-native-update-'));
const stagingBuild = path.join(stagingRoot, 'bundle');

try {
  fs.cpSync(buildDir, stagingBuild, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(buildDir, source);
      return relative.split(path.sep)[0] !== 'native-updates';
    },
  });

  const tempZip = path.join(stagingRoot, zipName);
  const archive = spawnSync('jar', ['--create', '--file', tempZip, '-C', stagingBuild, '.'], {
    encoding: 'utf8',
  });
  if (archive.status !== 0) {
    throw new Error(`Kan native update ZIP niet maken: ${archive.stderr || archive.stdout || 'onbekende fout'}`);
  }

  const bundle = fs.readFileSync(tempZip);
  const sha256 = crypto.createHash('sha256').update(bundle).digest('hex');
  const bundleUrl = `${webOrigin}/native-updates/${zipName}`;
  const canonicalPayload = [
    'pulse-native-update-v1',
    version,
    bundleUrl,
    sha256,
    String(bundle.length),
  ].join('\n');
  const signature = crypto.sign('sha256', Buffer.from(canonicalPayload, 'utf8'), crypto.createPrivateKey(readPrivateKey(privateKeyInput)));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.copyFileSync(tempZip, zipPath);
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    version,
    bundleUrl,
    bundleSize: bundle.length,
    sha256,
    signature: signature.toString('base64'),
  }, null, 2)}\n`);
  console.log(`[Pulse] Signed native update ${version} (${Math.round(bundle.length / 1024)} KiB).`);
} finally {
  fs.rmSync(stagingRoot, { recursive: true, force: true });
}
