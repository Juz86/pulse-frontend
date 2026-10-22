const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(
  root,
  'android/app/build/reports/release-notices/resolved-components.json',
);
const target = path.join(
  root,
  'security/android-release-notices/release-1.0.24-v80-resolved-components.json',
);
const noticeTarget = path.join(
  root,
  'security/android-release-notices/release-1.0.24-v80-resolved-components.md',
);

if (!fs.existsSync(source)) {
  throw new Error(
    'Gradle-inventaris ontbreekt. Voer eerst :app:generateReleaseRuntimeNoticeInventory uit.',
  );
}

const inventory = JSON.parse(fs.readFileSync(source, 'utf8'));
if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.components)) {
  throw new Error('Ongeldige Gradle release-notice-inventaris.');
}

const normalized = {
  schemaVersion: 1,
  release: {
    versionName: '1.0.24',
    versionCode: 80,
    configuration: inventory.configuration,
  },
  components: inventory.components
    .map((component) => ({
      id: component.id,
      version: component.version,
      pomStatus: component.pomStatus,
      pomSha256: component.pomSha256 || '',
      licenseSource: component.licenseSource || '',
      licenseSourcePomSha256: component.licenseSourcePomSha256 || '',
      licenses: [...(component.licenses || [])]
        .map((license) => ({
          name: license.name || '',
          url: license.url || '',
          distribution: license.distribution || '',
        }))
        .sort((left, right) =>
          `${left.name}:${left.url}`.localeCompare(`${right.name}:${right.url}`),
        ),
    }))
    .sort((left, right) =>
      `${left.id}:${left.version}`.localeCompare(`${right.id}:${right.version}`),
    ),
};

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(normalized, null, 2)}\n`);

function tableValue(value) {
  return String(value || '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const noticeRows = normalized.components.flatMap((component) =>
  component.licenses.map((license) =>
    `| ${tableValue(component.id)} | ${tableValue(component.version)} | ${tableValue(license.name)} | ${tableValue(license.url)} | ${tableValue(component.licenseSource)} |`,
  ),
);
const notice = [
  '# Pulse Android Release Runtime Notices',
  '',
  `Release: ${normalized.release.versionName} (versionCode ${normalized.release.versionCode})`,
  '',
  'Generated from the resolved Gradle release runtime graph and its cached, verified Maven POM metadata.',
  'This catalog is technical release evidence. It does not replace review of license texts, NOTICE files, binary contents, or service terms.',
  '',
  '| Component | Version | Declared license | License URL | Metadata source |',
  '| --- | --- | --- | --- | --- |',
  ...noticeRows,
  '',
].join('\n');
fs.writeFileSync(noticeTarget, notice);

const withoutLicense = normalized.components.filter(
  (component) => component.licenses.length === 0,
);
const unavailable = normalized.components.filter(
  (component) => component.pomStatus !== 'resolved',
);

console.log(`Wrote ${normalized.components.length} resolved Android components.`);
console.log(`Wrote ${noticeRows.length} Android release notice rows.`);
console.log(`Components without POM license metadata: ${withoutLicense.length}.`);
console.log(`Components with unavailable POM: ${unavailable.length}.`);
