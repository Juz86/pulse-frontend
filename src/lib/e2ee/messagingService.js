import { BACKEND_URL } from '../../services/socket';
import { E2EE_MODE } from './config';
import { pulseCryptoAdapter } from './adapter/pulseCryptoAdapter';
import { normalizeIncomingMessage } from './messageModel';
import { secureKeyStore } from './secureKeyStore';
import { sessionStore } from './sessionStore';

async function getAuthToken(user) {
  return user.getIdToken();
}

async function fetchKeyBundle(user, remoteUserId) {
  const token = await getAuthToken(user);
  const res = await fetch(`${BACKEND_URL}/users/${remoteUserId}/key-bundle`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error('Kon key bundle niet ophalen.');
  return res.json();
}

async function ensureSessions(user, remoteUserId) {
  const existing = await sessionStore.getByUser(user.uid, remoteUserId);
  if (existing.length) return existing;

  const identity = await secureKeyStore.getIdentity(user.uid);
  if (!identity) throw new Error('Geen lokale identity gevonden.');

  const bundle = await fetchKeyBundle(user, remoteUserId);
  const created = [];

  for (const device of bundle.devices || []) {
    const session = await pulseCryptoAdapter.createSessionFromPreKeyBundle({
      localIdentity: identity,
      remoteUserId,
      remoteDeviceId: device.deviceId,
      remoteBundle: {
        identityPublicKey: device.identityPublicKey,
        signedPreKey: device.signedPreKey,
        oneTimePreKey: device.oneTimePreKey,
      },
    });

    const record = {
      remoteUserId,
      remoteDeviceId: device.deviceId,
      sessionData: session.sessionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await sessionStore.save(user.uid, record);
    created.push(record);
  }

  return created;
}

async function hydrateMockCiphertext(raw, currentUserId) {
  if (E2EE_MODE !== 'mock' || !raw?.ciphertext) return null;

  try {
    const decrypted = await pulseCryptoAdapter.decryptMessage({
      sessionData: null,
      ciphertext: raw.ciphertext,
      encryptedMessageKey: raw.encryptedMessageKey || null,
    });

    return normalizeIncomingMessage({
      ...raw,
      text: decrypted.plaintext,
      decryptedLocally: true,
      ciphertextAvailable: true,
    }, currentUserId);
  } catch {
    return null;
  }
}

export const messagingService = {
  async sendMessage({ user, conversationId, recipientUserId, plaintext, replyToMessageId = null }, currentDeviceId) {
    if (!user) throw new Error('Geen gebruiker beschikbaar.');
    if (!currentDeviceId) throw new Error('Geen huidig device beschikbaar.');
    if (!recipientUserId) throw new Error('Geen ontvanger beschikbaar.');

    const sessions = await ensureSessions(user, recipientUserId);
    const recipientPayloads = [];
    let primaryCiphertext = '';

    for (const session of sessions) {
      const encrypted = await pulseCryptoAdapter.encryptMessage({
        sessionData: session.sessionData,
        plaintext,
      });

      await sessionStore.save(user.uid, {
        ...session,
        sessionData: encrypted.updatedSessionData,
        updatedAt: new Date().toISOString(),
      });

      if (!primaryCiphertext) {
        primaryCiphertext = encrypted.ciphertext;
      }

      recipientPayloads.push({
        recipientUserId,
        recipientDeviceId: session.remoteDeviceId,
        encryptedMessageKey: encrypted.encryptedMessageKey,
      });
    }

    const token = await getAuthToken(user);
    const res = await fetch(`${BACKEND_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId,
        senderDeviceId: currentDeviceId,
        ciphertext: primaryCiphertext,
        messageType: 'text',
        protocol: 'signal_v1',
        protocolVersion: 1,
        replyToMessageId,
        recipientPayloads,
      }),
    });

    if (!res.ok) throw new Error('Bericht versturen mislukt.');
    return res.json();
  },

  async hydrateIncomingMessage(raw, currentUserId) {
    if (raw.protocol !== 'signal_v1') {
      return normalizeIncomingMessage(raw, currentUserId);
    }

    const identity = await secureKeyStore.getIdentity(currentUserId);
    if (!identity) {
      const mockHydrated = await hydrateMockCiphertext(raw, currentUserId);
      if (mockHydrated) return mockHydrated;

      return normalizeIncomingMessage({
        ...raw,
        text: 'Versleuteld bericht',
        decryptedLocally: false,
        ciphertextAvailable: true,
      }, currentUserId);
    }

    const sessionRecord = await sessionStore.get(
      currentUserId,
      raw.senderUserId,
      raw.senderDeviceId
    );

    if (!sessionRecord) {
      const mockHydrated = await hydrateMockCiphertext(raw, currentUserId);
      if (mockHydrated) return mockHydrated;

      return normalizeIncomingMessage({
        ...raw,
        text: 'Versleuteld bericht',
        decryptedLocally: false,
        ciphertextAvailable: true,
      }, currentUserId);
    }

    const decrypted = await pulseCryptoAdapter.decryptMessage({
      sessionData: sessionRecord.sessionData,
      ciphertext: raw.ciphertext,
      encryptedMessageKey: raw.encryptedMessageKey,
    });

    await sessionStore.save(currentUserId, {
      ...sessionRecord,
      sessionData: decrypted.updatedSessionData,
      updatedAt: new Date().toISOString(),
    });

    return normalizeIncomingMessage({
      ...raw,
      text: decrypted.plaintext,
      decryptedLocally: true,
      ciphertextAvailable: true,
    }, currentUserId);
  },
};
