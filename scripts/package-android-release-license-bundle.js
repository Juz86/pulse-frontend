const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const gradleCache = path.join(root, '.gradle-android/caches/modules-2/files-2.1');
const inventoryPath = path.join(
  root,
  'security/android-release-notices/release-1.0.24-v80-resolved-components.json',
);
const catalogPath = path.join(
  root,
  'security/android-release-notices/release-1.0.24-v80-resolved-components.md',
);
const outputDir = path.join(
  root,
  'public/legal/third-party/android-runtime-1.0.24-v80',
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function findArtifact(group, module, version, extension) {
  const base = path.join(gradleCache, group, module, version);
  const expected = `${module}-${version}.${extension}`;
  const matches = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      if (entry.isFile() && entry.name === expected) matches.push(target);
    }
  }

  visit(base);
  if (matches.length !== 1) {
    throw new Error(`Expected one cached artifact ${group}:${module}:${version}, found ${matches.length}`);
  }
  return matches[0];
}

const embeddedLicenses = [
  {
    coordinate: 'androidx.core:core:1.15.0',
    extension: 'aar',
    entry: 'META-INF/androidx/core/core/LICENSE.txt',
    target: 'LICENSE-APACHE-2.0.txt',
    sha256: '809fa1ed21450f59827d1e9aec720bbc4b687434fa22283c6cb5dd82a47ab9c0',
  },
  {
    coordinate: 'com.google.android.play:app-update:2.1.0',
    extension: 'aar',
    entry: 'LICENSE',
    target: 'LICENSE-GOOGLE-PLAY-APP-UPDATE-2.1.0.txt',
    sha256: 'bde711044e714375585b59a9d0973d093d6061985a709b8b1f235523ebc8c01e',
  },
  {
    coordinate: 'com.google.android.play:app-update-ktx:2.1.0',
    extension: 'aar',
    entry: 'LICENSE',
    target: 'LICENSE-GOOGLE-PLAY-APP-UPDATE-KTX-2.1.0.txt',
    sha256: 'c2e3d59a90d75c6e039c0125a068fd509d4b386835d04cb1ac32725f418484bb',
  },
  {
    coordinate: 'com.google.android.play:core-common:2.0.3',
    extension: 'aar',
    entry: 'LICENSE',
    target: 'LICENSE-GOOGLE-PLAY-CORE-COMMON-2.0.3.txt',
    sha256: 'dad11d2da19198161f392a355c870025157763b1942fc30f789308f678269883',
  },
  {
    coordinate: 'com.google.android.play:integrity:1.3.0',
    extension: 'aar',
    entry: 'LICENSE',
    target: 'LICENSE-GOOGLE-PLAY-INTEGRITY-1.3.0.txt',
    sha256: 'de99dfafdd1f133400c8d18b57850636f1065c6f0e5051c9dbe6bea2cc317aa4',
  },
];

const sourceFiles = [
  {
    source: 'LICENSE',
    target: 'LICENSE-AGPL-3.0.txt',
  },
  {
    source: 'security/android-release-notices/upstream/socket.io-client-java-2.1.2/LICENSE',
    target: 'LICENSE-SOCKET.IO-CLIENT-JAVA-2.1.2.txt',
  },
  {
    source: 'security/android-release-notices/upstream/engine.io-client-java-2.1.0/LICENSE',
    target: 'LICENSE-ENGINE.IO-CLIENT-JAVA-2.1.0.txt',
  },
];

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
if (inventory.components?.length !== 174) {
  throw new Error('Expected the frozen 174-component Android runtime inventory.');
}

fs.mkdirSync(outputDir, { recursive: true });
const outputs = [];

for (const definition of embeddedLicenses) {
  const [group, module, version] = definition.coordinate.split(':');
  const artifact = findArtifact(group, module, version, definition.extension);
  const content = execFileSync('unzip', ['-p', artifact, definition.entry], {
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (sha256(content) !== definition.sha256) {
    throw new Error(`Embedded license hash changed for ${definition.coordinate}`);
  }
  fs.writeFileSync(path.join(outputDir, definition.target), content);
  outputs.push({
    path: definition.target,
    sha256: definition.sha256,
    source: `${definition.coordinate}!/${definition.entry}`,
  });
}

for (const definition of sourceFiles) {
  const content = read(definition.source);
  fs.writeFileSync(path.join(outputDir, definition.target), content);
  outputs.push({
    path: definition.target,
    sha256: sha256(content),
    source: definition.source,
  });
}

for (const [source, target] of [
  [inventoryPath, 'COMPONENTS.json'],
  [catalogPath, 'COMPONENTS.md'],
]) {
  const content = fs.readFileSync(source);
  fs.writeFileSync(path.join(outputDir, target), content);
  outputs.push({
    path: target,
    sha256: sha256(content),
    source: path.relative(root, source),
  });
}

outputs.sort((left, right) => left.path.localeCompare(right.path));
const manifest = {
  schemaVersion: 1,
  release: { versionName: '1.0.24', versionCode: 80 },
  componentCount: inventory.components.length,
  files: outputs,
};
fs.writeFileSync(
  path.join(outputDir, 'BUNDLE-MANIFEST.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`Packaged ${outputs.length} Android license files for ${inventory.components.length} components.`);
