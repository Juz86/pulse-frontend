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
const zlib = require('zlib');

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

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function listBundleFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    // Never package an older native update inside the next native update.
    if (!prefix && entry.name === 'native-updates') return [];
    const fullPath = path.join(directory, entry.name);
    const relativePath = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return listBundleFiles(fullPath, `${relativePath}/`);
    if (!entry.isFile()) return [];
    return [{ fullPath, relativePath }];
  });
}

function createZip(sourceDirectory, destination) {
  const parts = [];
  const centralDirectory = [];
  const files = listBundleFiles(sourceDirectory);
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.relativePath.replace(/\\/g, '/'), 'utf8');
    const content = fs.readFileSync(file.fullPath);
    const compressed = zlib.deflateRawSync(content, { level: 9 });
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // Deflate
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralDirectory.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralSize = centralDirectory.reduce((size, item) => size + item.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  fs.writeFileSync(destination, Buffer.concat([...parts, ...centralDirectory, end]));
}

try {
  const tempZip = path.join(stagingRoot, zipName);
  createZip(buildDir, tempZip);

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
