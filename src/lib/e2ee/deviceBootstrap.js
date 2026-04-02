import { BACKEND_URL } from '../../services/socket';
import { pulseCryptoAdapter } from './adapter/pulseCryptoAdapter';
import { secureKeyStore } from './secureKeyStore';

function detectPlatform() {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  return 'web';
}

export async function bootstrapDevice(user) {
  const existing = await secureKeyStore.getIdentity(user.uid);
  if (existing) return existing;

  const token = await user.getIdToken();
  const identityKeyPair = await pulseCryptoAdapter.generateIdentityKeyPair();
  const signedPreKey = await pulseCryptoAdapter.generateSignedPreKey(identityKeyPair);
  const oneTimePreKeys = await pulseCryptoAdapter.generateOneTimePreKeys(20);

  const identity = {
    userId: user.uid,
    deviceId: null,
    cryptoProvider: process.env.REACT_APP_E2EE_MODE || 'mock',
    cryptoVersion: 1,
    identityKeyPair,
    signedPreKey,
    oneTimePreKeys,
  };

  const res = await fetch(`${BACKEND_URL}/devices/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      deviceLabel: navigator.platform || 'Onbekend apparaat',
      identityPublicKey: identity.identityKeyPair.publicKey,
      signedPreKey: {
        keyId: identity.signedPreKey.keyId,
        publicKey: identity.signedPreKey.publicKey,
        signature: identity.signedPreKey.signature,
      },
      oneTimePreKeys: identity.oneTimePreKeys.map((key) => ({
        keyId: key.keyId,
        publicKey: key.publicKey,
      })),
      platform: detectPlatform(),
      protocol: 'signal_v1',
      protocolVersion: 1,
    }),
  });

  if (!res.ok) {
    throw new Error('Kon device bootstrap niet afronden.');
  }

  const data = await res.json();
  const completeIdentity = {
    ...identity,
    deviceId: data.deviceId,
  };

  await secureKeyStore.saveIdentity(user.uid, completeIdentity);
  return completeIdentity;
}
