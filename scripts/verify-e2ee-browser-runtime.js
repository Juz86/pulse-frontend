const { createHash } = require('crypto');
const { readFileSync, statSync } = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(
  path.join(projectRoot, 'security/e2ee/browser-provider-runtime.json'),
  'utf8',
));

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

requireValue(manifest.status === 'isolated_qa_only', 'Browserruntime mag alleen QA-status hebben.');
requireValue(
  manifest.libsignalCommit === '1738ead8a12ffe539f6309958123dadb16dc3b95',
  'Browserruntime gebruikt niet de Android-libsignal-pin.',
);

for (const [name, artifact] of Object.entries(manifest.artifacts)) {
  const artifactPath = path.join(projectRoot, artifact.path);
  requireValue(sha256(artifactPath) === artifact.sha256, `${name}-artifact heeft een onjuiste hash.`);
  if (artifact.bytes) {
    requireValue(statSync(artifactPath).size === artifact.bytes, `${name}-artifact heeft een onjuiste grootte.`);
  }
}

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const directPackages = {
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
};
requireValue(
  !Object.keys(directPackages).some((name) => name.includes('signal-wasm')),
  'De QA-runtime mag niet stil naar een npm-release wisselen.',
);

console.log('E2EE browser QA runtime: OK');
console.log(`libsignal: ${manifest.libsignalCommit}`);
console.log(`WASM SHA-256: ${manifest.artifacts.wasm.sha256}`);
console.log('status: isolated_qa_only');
