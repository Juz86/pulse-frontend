const { createHash } = require('crypto');
const { readFileSync, readdirSync, statSync } = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const reviewRoot = path.join(projectRoot, 'security/e2ee/browser-provider-review');
const manifestPath = path.join(reviewRoot, 'candidate.json');
const lockPath = path.join(reviewRoot, 'Cargo.lock');
const patchPath = path.join(reviewRoot, 'libsignal-0.105.1-parity.patch');

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function collectRuntimeFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const filePath = path.join(directory, name);
    if (statSync(filePath).isDirectory()) return collectRuntimeFiles(filePath);
    return /\.(?:js|jsx|ts|tsx)$/.test(name) ? [filePath] : [];
  });
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
requireValue(
  manifest.status === 'review_only_not_runtime_approved',
  'De browserprovider-kandidaat moet review-only blijven.',
);
requireValue(
  sha256(lockPath) === manifest.inputs.cargoLockSha256,
  'Cargo.lock komt niet overeen met de vastgelegde SHA-256.',
);
requireValue(
  sha256(patchPath) === manifest.inputs.parityPatchSha256,
  'De paritypatch komt niet overeen met de vastgelegde SHA-256.',
);

const lock = readFileSync(lockPath, 'utf8');
requireValue(
  lock.includes(`rev=${manifest.libsignal.commit}#${manifest.libsignal.commit}`),
  'Cargo.lock bevat niet de vastgepinde libsignal-commit.',
);
requireValue(
  lock.includes('name = "libsignal-debug"\nversion = "0.105.1"'),
  'Cargo.lock bevestigt libsignal 0.105.1 niet.',
);
requireValue(
  !lock.includes('b056faa6dd02961cff24064c54c089c52e1a0753'),
  'Cargo.lock bevat nog de oude libsignal 0.101.0-commit.',
);

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const directPackages = {
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
};
requireValue(
  !Object.keys(directPackages).some((name) => name.includes('signal-wasm')),
  'De reviewkandidaat mag geen directe npm-dependency zijn.',
);

const packageLock = JSON.parse(readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));
requireValue(
  !Object.keys(packageLock.packages || {}).some((name) => name.includes('signal-wasm')),
  'De reviewkandidaat mag niet in package-lock.json zijn geinstalleerd.',
);

const forbiddenImport = /(?:@getmaapp\/signal-wasm|from\s+['"][^'"]*signal-wasm|require\(['"][^'"]*signal-wasm)/;
const importedBy = collectRuntimeFiles(path.join(projectRoot, 'src')).filter((filePath) => (
  forbiddenImport.test(readFileSync(filePath, 'utf8'))
));
requireValue(importedBy.length === 0, `Runtime-import gevonden: ${importedBy.join(', ')}`);

const packagedArtifacts = readdirSync(reviewRoot).filter((name) => /\.(?:wasm|js|tgz)$/.test(name));
requireValue(
  packagedArtifacts.length === 0,
  `De reviewmap mag geen uitvoerbare artifacts bevatten: ${packagedArtifacts.join(', ')}`,
);

console.log('E2EE browser review candidate: OK');
console.log(`libsignal: ${manifest.libsignal.tag} @ ${manifest.libsignal.commit}`);
console.log(`Cargo.lock SHA-256: ${manifest.inputs.cargoLockSha256}`);
console.log(`parity patch SHA-256: ${manifest.inputs.parityPatchSha256}`);
console.log('runtime dependency: absent');
