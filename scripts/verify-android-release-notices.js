const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(
  root,
  'security/android-release-notices/release-1.0.24-v80.json',
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const releaseMode = process.argv.includes('--release');

function fail(message) {
  throw new Error(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function sha256(relativePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireText(text, expected, label) {
  requireValue(text.includes(expected), `${label} ontbreekt: ${expected}`);
}

requireValue(manifest.schemaVersion === 1, 'Onbekende notice-schemaVersion.');
requireValue(Array.isArray(manifest.webRuntime), 'webRuntime ontbreekt.');
requireValue(Array.isArray(manifest.androidRuntime), 'androidRuntime ontbreekt.');
requireValue(Array.isArray(manifest.blockers), 'blockers ontbreekt.');

const resolvedInventoryPath = manifest.release.resolvedComponentsPath;
requireValue(
  typeof resolvedInventoryPath === 'string' && resolvedInventoryPath.length > 0,
  'resolvedComponentsPath ontbreekt.',
);
requireValue(
  fs.existsSync(path.join(root, resolvedInventoryPath)),
  'Opgeloste Android componentinventaris ontbreekt.',
);
requireValue(
  sha256(resolvedInventoryPath) === manifest.release.resolvedComponentsSha256,
  'Opgeloste Android componentinventaris-hash wijkt af.',
);
const resolvedNoticesPath = manifest.release.resolvedNoticesPath;
requireValue(
  typeof resolvedNoticesPath === 'string' && fs.existsSync(path.join(root, resolvedNoticesPath)),
  'Leesbare Android noticecatalogus ontbreekt.',
);
requireValue(
  sha256(resolvedNoticesPath) === manifest.release.resolvedNoticesSha256,
  'Leesbare Android noticecatalogus-hash wijkt af.',
);
const webrtcWrapperLicensePath = manifest.release.webrtcWrapperLicensePath;
const webrtcNoticesPath = manifest.release.webrtcNoticesPath;
requireValue(
  typeof webrtcWrapperLicensePath === 'string' &&
    fs.existsSync(path.join(root, webrtcWrapperLicensePath)),
  'WebRTC-wrapperlicentie ontbreekt.',
);
requireValue(
  sha256(webrtcWrapperLicensePath) === manifest.release.webrtcWrapperLicenseSha256,
  'WebRTC-wrapperlicentie-hash wijkt af.',
);
requireValue(
  typeof webrtcNoticesPath === 'string' && fs.existsSync(path.join(root, webrtcNoticesPath)),
  'WebRTC-noticebestand ontbreekt.',
);
requireValue(
  sha256(webrtcNoticesPath) === manifest.release.webrtcNoticesSha256,
  'WebRTC-noticehash wijkt af.',
);
const webrtcNoticeComponentCount = read(webrtcNoticesPath)
  .split('\n')
  .filter((line) => line.startsWith('# ')).length;
requireValue(
  webrtcNoticeComponentCount === manifest.release.webrtcNoticesComponentCount,
  'Aantal WebRTC-noticesecties wijkt af.',
);
const androidLicenseBundleManifestPath = manifest.release.androidLicenseBundleManifestPath;
requireValue(
  typeof androidLicenseBundleManifestPath === 'string' &&
    fs.existsSync(path.join(root, androidLicenseBundleManifestPath)),
  'Android licentiebundelmanifest ontbreekt.',
);
requireValue(
  sha256(androidLicenseBundleManifestPath) ===
    manifest.release.androidLicenseBundleManifestSha256,
  'Android licentiebundelmanifest-hash wijkt af.',
);
const androidLicenseBundle = JSON.parse(read(androidLicenseBundleManifestPath));
requireValue(androidLicenseBundle.schemaVersion === 1, 'Onbekende licentiebundel-schemaVersion.');
requireValue(
  androidLicenseBundle.componentCount === manifest.release.resolvedComponentCount,
  'Licentiebundel hoort bij een andere componentinventaris.',
);
requireValue(
  androidLicenseBundle.files?.length === manifest.release.androidLicenseBundleFileCount,
  'Aantal bestanden in de Android licentiebundel wijkt af.',
);
const androidLicenseBundleDirectory = path.dirname(androidLicenseBundleManifestPath);
for (const file of androidLicenseBundle.files) {
  requireValue(
    typeof file.path === 'string' && path.basename(file.path) === file.path,
    'Ongeldig bestandspad in Android licentiebundel.',
  );
  const bundledPath = path.join(androidLicenseBundleDirectory, file.path);
  requireValue(fs.existsSync(path.join(root, bundledPath)), `Licentiebestand ontbreekt: ${file.path}`);
  requireValue(sha256(bundledPath) === file.sha256, `Licentiebestand-hash wijkt af: ${file.path}`);
}
const dataSafetyDraftPath = manifest.release.dataSafetyDraftPath;
requireValue(
  typeof dataSafetyDraftPath === 'string' && fs.existsSync(path.join(root, dataSafetyDraftPath)),
  'Android Data Safety-concept ontbreekt.',
);
requireValue(
  sha256(dataSafetyDraftPath) === manifest.release.dataSafetyDraftSha256,
  'Android Data Safety-concepthash wijkt af.',
);
const dataSafetyDraft = read(dataSafetyDraftPath);
for (const expectedSection of [
  '## Concept voor de Play-verklaring',
  '## Beslispunten vóór indiening',
  '## Play Console-checklist',
]) {
  requireText(dataSafetyDraft, expectedSection, 'Android Data Safety-concept');
}
const resolvedInventory = JSON.parse(read(resolvedInventoryPath));
requireValue(resolvedInventory.schemaVersion === 1, 'Onbekende componentinventaris-schemaVersion.');
requireValue(
  resolvedInventory.release?.versionName === manifest.release.versionName &&
    resolvedInventory.release?.versionCode === manifest.release.versionCode,
  'Componentinventaris hoort bij een andere release.',
);
requireValue(
  resolvedInventory.components?.length === manifest.release.resolvedComponentCount,
  'Aantal opgeloste Android componenten wijkt af.',
);
for (const component of resolvedInventory.components) {
  requireValue(component.pomStatus === 'resolved', `POM ontbreekt: ${component.id}:${component.version}`);
  requireValue(/^[a-f0-9]{64}$/.test(component.pomSha256), `POM-hash ontbreekt: ${component.id}:${component.version}`);
  requireValue(component.licenses?.length > 0, `Licentiemetadata ontbreekt: ${component.id}:${component.version}`);
  requireValue(component.licenseSource, `Licentiebron ontbreekt: ${component.id}:${component.version}`);
  requireValue(
    /^[a-f0-9]{64}$/.test(component.licenseSourcePomSha256),
    `Licentiebronhash ontbreekt: ${component.id}:${component.version}`,
  );
}

const buildGradle = read('android/app/build.gradle');
const variablesGradle = read('android/variables.gradle');
const cordovaGradle = read('android/capacitor-cordova-android-plugins/build.gradle');
const androidDependencySources = `${buildGradle}\n${variablesGradle}\n${cordovaGradle}`;
const lock = JSON.parse(read('package-lock.json'));

requireText(buildGradle, `versionCode ${manifest.release.versionCode}`, 'versionCode');
requireText(buildGradle, `versionName "${manifest.release.versionName}"`, 'versionName');
requireText(buildGradle, `applicationId "${manifest.release.applicationId}"`, 'applicationId');

const androidPins = new Map(
  manifest.androidRuntime.map((component) => [component.id, component.version]),
);
const resolvedAndroidComponents = new Map(
  resolvedInventory.components.map((component) => [component.id, component.version]),
);
const bomControlledTransitives = new Set([
  'com.google.android.play:integrity',
  'com.google.android.recaptcha:recaptcha',
]);
for (const [id, version] of androidPins) {
  requireValue(
    resolvedAndroidComponents.get(id) === version,
    `Android-pin ontbreekt in opgeloste componentinventaris: ${id}:${version}`,
  );
  if (bomControlledTransitives.has(id)) continue;
  const artifact = id.split(':')[1];
  requireValue(
    androidDependencySources.includes(`${id}:${version}`) ||
      androidDependencySources.includes(`${id}:$`) ||
      variablesGradle.includes(`${artifact}Version = '${version}'`) ||
      (id.startsWith('org.signal:') && variablesGradle.includes(`libsignalVersion = '${version}'`)),
    `Android-pin wijkt af of ontbreekt: ${id}:${version}`,
  );
}

for (const component of manifest.webRuntime) {
  const entry = lock.packages?.[`node_modules/${component.id}`];
  requireValue(entry, `Npm-package ontbreekt: ${component.id}`);
  requireValue(
    entry.version === component.version,
    `Npm-versie wijkt af: ${component.id} ${entry.version} != ${component.version}`,
  );
  requireValue(
    entry.license === component.license,
    `Npm-licentie wijkt af: ${component.id} ${entry.license} != ${component.license}`,
  );
}

requireValue(
  sha256('package-lock.json') === manifest.release.packageLockSha256,
  'package-lock.json hash wijkt af.',
);
requireValue(
  sha256('android/app/build.gradle') === manifest.release.androidBuildGradleSha256,
  'android/app/build.gradle hash wijkt af.',
);
requireValue(
  sha256('android/variables.gradle') === manifest.release.androidVariablesGradleSha256,
  'android/variables.gradle hash wijkt af.',
);

const aabPath = 'android/app/build/outputs/bundle/release/app-release.aab';
const aabExists = fs.existsSync(path.join(root, aabPath));
if (aabExists) {
  requireValue(sha256(aabPath) === manifest.release.aabSha256, 'AAB-hash wijkt af.');
}

if (releaseMode) {
  requireValue(aabExists, 'Release-AAB ontbreekt.');
  const aabNoticePrefix =
    'base/assets/public/legal/third-party/webrtc-sdk-android-144.7559.15/';
  let bundledWebrtcLicense;
  let bundledWebrtcNotices;
  try {
    bundledWebrtcLicense = execFileSync(
      'unzip',
      ['-p', path.join(root, aabPath), `${aabNoticePrefix}LICENSE-MIT.txt`],
      { encoding: null },
    );
    bundledWebrtcNotices = execFileSync(
      'unzip',
      ['-p', path.join(root, aabPath), `${aabNoticePrefix}WEBRTC-NOTICES.md`],
      { encoding: null },
    );
  } catch {
    fail('WebRTC-licentie- of noticebestand ontbreekt in de release-AAB.');
  }
  requireValue(
    sha256Buffer(bundledWebrtcLicense) === manifest.release.webrtcWrapperLicenseSha256,
    'WebRTC-wrapperlicentie in de release-AAB wijkt af.',
  );
  requireValue(
    sha256Buffer(bundledWebrtcNotices) === manifest.release.webrtcNoticesSha256,
    'WebRTC-noticebestand in de release-AAB wijkt af.',
  );
  for (const file of androidLicenseBundle.files) {
    let bundledLicense;
    try {
      bundledLicense = execFileSync(
        'unzip',
        [
          '-p',
          path.join(root, aabPath),
          `base/assets/public/legal/third-party/android-runtime-1.0.24-v80/${file.path}`,
        ],
        { encoding: null, maxBuffer: 16 * 1024 * 1024 },
      );
    } catch {
      fail(`Licentiebestand ontbreekt in de release-AAB: ${file.path}`);
    }
    requireValue(
      sha256Buffer(bundledLicense) === file.sha256,
      `Licentiebestand in de release-AAB wijkt af: ${file.path}`,
    );
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', manifest.release.sourceCommit, head], {
      cwd: root,
      stdio: 'ignore',
    });
  } catch {
    fail('De vastgelegde releasebroncommit is geen ancestor van HEAD.');
  }
  for (const releaseFile of [
    path.relative(root, manifestPath),
    resolvedInventoryPath,
    resolvedNoticesPath,
    webrtcWrapperLicensePath,
    webrtcNoticesPath,
    androidLicenseBundleManifestPath,
    ...androidLicenseBundle.files.map((file) =>
      path.join(androidLicenseBundleDirectory, file.path)),
    dataSafetyDraftPath,
  ]) {
    try {
      execFileSync('git', ['cat-file', '-e', `HEAD:${releaseFile}`], {
        cwd: root,
        stdio: 'ignore',
      });
    } catch {
      fail(`Releasebewijs staat niet in de broncommit: ${releaseFile}`);
    }
  }
  requireValue(manifest.status === 'approved', 'Android release-notices zijn niet goedgekeurd.');
  requireValue(manifest.blockers.length === 0, 'Android release-notices bevatten open blockers.');
  const unresolved = [...manifest.webRuntime, ...manifest.androidRuntime].filter(
    (component) => component.review !== 'approved',
  );
  requireValue(unresolved.length === 0, 'Niet alle componentnotices zijn goedgekeurd.');
}

console.log(
  `Android release-notice inventory: OK (${manifest.webRuntime.length} web, ${manifest.androidRuntime.length} Android, status ${manifest.status})`,
);
