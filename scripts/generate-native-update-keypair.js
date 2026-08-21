#!/usr/bin/env node

// Run this once on a trusted developer machine. Never commit the private key.
const crypto = require('crypto');

// P-256 works with Android's built-in crypto provider across supported Android
// versions, unlike Ed25519 which is unavailable on older devices.
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicDer = publicKey.export({ type: 'spki', format: 'der' });

console.log('PULSE_NATIVE_UPDATE_PUBLIC_KEY=' + publicDer.toString('base64'));
console.log('PULSE_NATIVE_UPDATE_SIGNING_PRIVATE_KEY=' + Buffer.from(privatePem, 'utf8').toString('base64'));
