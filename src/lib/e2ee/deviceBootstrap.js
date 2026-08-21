import { BACKEND_URL } from '../../services/socket';
import { pulseCryptoAdapter } from './adapter/pulseCryptoAdapter';
import { secureKeyStore } from './secureKeyStore';

const PREKEY_REFILL_THRESHOLD = 8;
const PREKEY_REFILL_BATCH_SIZE = 20;

function detectPlatform() {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  return 'web';
}

async function getActiveRegisteredDevice(user, deviceId) {
  if (!deviceId) return null;

  const token = await user.getIdToken();
  const res = await fetch(`${BACKEND_URL}/devices`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const devices = Array.isArray(data?.devices) ? data.devices : [];
  return devices.find((device) => device?.id === deviceId && device?.status === 'active') || null;
}

function serializeOneTimePreKeys(oneTimePreKeys = []) {
  return oneTimePreKeys.map((key) => ({
    keyId: key.keyId,
    publicKey: key.publicKey,
  }));
}

async function refillOneTimePreKeys(user, identity) {
  const token = await user.getIdToken();
  const issuedAt = Date.now();
  const generatedPreKeys = await pulseCryptoAdapter.generateOneTimePreKeys(PREKEY_REFILL_BATCH_SIZE);
  const oneTimePreKeys = generatedPreKeys.map((key, index) => ({
    ...key,
    // Nieuwe batches moeten unieke ids krijgen, ook nadat een apparaat al eerder
    // prekeys heeft gepubliceerd. Dit voorkomt dat de backend de batch overschrijft.
    keyId: issuedAt + index,
  }));

  const res = await fetch(`${BACKEND_URL}/devices/${identity.deviceId}/prekeys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ oneTimePreKeys: serializeOneTimePreKeys(oneTimePreKeys) }),
  });

  if (!res.ok) throw new Error('Kon encryptiesleutels niet aanvullen.');

  const refreshedIdentity = {
    ...identity,
    oneTimePreKeys: [...(identity.oneTimePreKeys || []), ...oneTimePreKeys],
  };
  await secureKeyStore.saveIdentity(user.uid, refreshedIdentity);
  return refreshedIdentity;
}

export async function bootstrapDevice(user) {
  const existing = await secureKeyStore.getIdentity(user.uid);
  if (existing?.deviceId) {
    const activeDevice = await getActiveRegisteredDevice(user, existing.deviceId).catch(() => null);
    if (activeDevice) {
      if (Number(activeDevice.oneTimePreKeyCount || 0) < PREKEY_REFILL_THRESHOLD) {
        console.info('[Pulse][E2EE] Prekey-voorraad is laag. Encryptiesleutels worden aangevuld.');
        return refillOneTimePreKeys(user, existing);
      }
      return existing;
    }
    console.warn('[Pulse][E2EE] Lokaal device bestaat, maar backend-device ontbreekt/inactief. Device wordt opnieuw geregistreerd.');
  } else if (existing) {
    console.warn('[Pulse][E2EE] Lokaal identity record zonder deviceId. Device wordt opnieuw geregistreerd.');
  }

  const token = await user.getIdToken();
  const identityKeyPair = existing?.identityKeyPair || await pulseCryptoAdapter.generateIdentityKeyPair();
  const signedPreKey = await pulseCryptoAdapter.generateSignedPreKey(identityKeyPair);
  const oneTimePreKeys = await pulseCryptoAdapter.generateOneTimePreKeys(PREKEY_REFILL_BATCH_SIZE);

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
      oneTimePreKeys: serializeOneTimePreKeys(identity.oneTimePreKeys),
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
