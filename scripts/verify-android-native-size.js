const fs = require('fs');
const path = require('path');

const strippedLibDir = process.argv[2];
const expectedAbis = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const maxLibraryBytes = 20 * 1024 * 1024;

if (!strippedLibDir) {
  throw new Error('Gebruik: verify-android-native-size.js <stripped-lib-dir>');
}

for (const abi of expectedAbis) {
  const library = path.join(strippedLibDir, abi, 'libsignal_jni.so');
  if (!fs.existsSync(library)) {
    throw new Error(`Release libsignal-ABI ontbreekt: ${abi}`);
  }

  const size = fs.statSync(library).size;
  if (size > maxLibraryBytes) {
    throw new Error(
      `${abi}/libsignal_jni.so is ${size} bytes; `
        + 'native debugsecties zijn waarschijnlijk niet gestript.',
    );
  }
}

console.log(`Native releasegrootte is geldig voor ${expectedAbis.length} ABI's.`);
