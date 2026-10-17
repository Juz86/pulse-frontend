const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const requiredFiles = [
  'LICENSE',
  'README.md',
  'SOURCE_DISTRIBUTION.md',
  'THIRD_PARTY_NOTICES.md',
];
const forbiddenTrackedFiles = [
  /(^|\/)google-services\.json$/i,
  /(^|\/)keystore\.properties$/i,
  /\.(jks|keystore|p12|pfx|pem|key)$/i,
];
const forbiddenContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{32,}/,
  /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----\\n[A-Za-z0-9+/=]{32,}/,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{36,}/,
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(projectRoot, file))) {
    failures.push(`required_file_missing:${file}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
if (packageJson.license !== 'AGPL-3.0-only') {
  failures.push('package_license_must_be_AGPL-3.0-only');
}

const license = fs.readFileSync(path.join(projectRoot, 'LICENSE'), 'utf8');
if (!license.includes('GNU AFFERO GENERAL PUBLIC LICENSE') || !license.includes('Version 3, 19 November 2007')) {
  failures.push('license_text_is_not_AGPLv3');
}

const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  cwd: projectRoot,
  encoding: 'utf8',
}).split('\0').filter(Boolean);

for (const file of trackedFiles) {
  if (forbiddenTrackedFiles.some((pattern) => pattern.test(file))) {
    failures.push(`sensitive_file_tracked:${file}`);
    continue;
  }

  const absolutePath = path.join(projectRoot, file);
  let stats;
  try {
    stats = fs.statSync(absolutePath);
  } catch {
    continue;
  }
  if (!stats.isFile() || stats.size > 2 * 1024 * 1024) continue;

  const content = fs.readFileSync(absolutePath);
  if (content.includes(0)) continue;
  const text = content.toString('utf8');
  for (const pattern of forbiddenContent) {
    if (pattern.test(text)) {
      failures.push(`secret_pattern_found:${file}:${pattern.source}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Open-source release check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Open-source release check passed (${trackedFiles.length} tracked files inspected).`);
