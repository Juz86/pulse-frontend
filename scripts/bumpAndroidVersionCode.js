const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const source = fs.readFileSync(gradlePath, 'utf8');

const match = source.match(/versionCode\s+(\d+)/);
if (!match) {
  console.error('[Pulse] Kon versionCode niet vinden in android/app/build.gradle');
  process.exit(1);
}

const current = Number(match[1]);
const next = current + 1;

const updated = source.replace(/versionCode\s+\d+/, `versionCode ${next}`);
fs.writeFileSync(gradlePath, updated, 'utf8');

console.log(`[Pulse] Android versionCode verhoogd: ${current} -> ${next}`);
