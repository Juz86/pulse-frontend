import { BACKEND_URL } from '../../services/socket';
import { E2EE_MODE } from './config';
import { pulseCryptoAdapter } from './adapter/pulseCryptoAdapter';
import { normalizeAttachmentPayload } from './attachmentPayload';
import { getAttachmentBaseDisplayText } from './attachmentPresentation';
import { ENCRYPTED_MESSAGE_PROTOCOL } from './messageProtocolConstants';
import {
  getEncryptedMessageDisplayText,
  getSharedContactFallbackDisplayText,
  getSharedContactDisplayText,
} from './messageCopy';
import { normalizeIncomingMessage } from './messageModel';
import { getOutgoingMessageScopeError } from './messageTransportPayload';
import { secureKeyStore } from './secureKeyStore';
import { sessionStore } from './sessionStore';

function serializeMessagePayload({ plaintext, messageType = 'text', sharedContact = null }) {
  if (messageType === 'contact') {
    return JSON.stringify({
      kind: 'contact',
      sharedContact: sharedContact || null,
    });
  }

  return plaintext;
}

function deserializeMessagePayload({ plaintext, messageType = 'text' }) {
  if (messageType === 'attachment') {
    try {
      const parsed = JSON.parse(plaintext);
      const attachment = parsed?.attachment || null;

      return {
        text: parsed?.text || getAttachmentBaseDisplayText(attachment),
        type: 'attachment',
        sharedContact: null,
        attachment: normalizeAttachmentPayload(attachment),
      };
    } catch {
      return {
        text: getAttachmentBaseDisplayText(),
        type: 'attachment',
        sharedContact: null,
        attachment: null,
      };
    }
  }

  if (messageType !== 'contact') {
    return {
      text: plaintext,
      type: 'text',
      sharedContact: null,
      attachment: null,
    };
  }

  try {
    const parsed = JSON.parse(plaintext);
    const sharedContact = parsed?.sharedContact || null;

    return {
      text: getSharedContactDisplayText(sharedContact),
      type: 'contact',
      sharedContact,
      attachment: null,
    };
  } catch {
    return {
      text: getSharedContactFallbackDisplayText(),
      type: 'contact',
      sharedContact: null,
      attachment: null,
    };
  }
}

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

  if (created.length === 0) {
    throw new Error('Ontvanger heeft nog geen actief chat-apparaat. Laat de ontvanger opnieuw inloggen en de chat openen.');
  }

  return created;
}

async function sendEncryptedPayload({ token, body }) {
  const res = await fetch(`${BACKEND_URL}/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(payload?.error || 'Bericht versturen mislukt.');
    error.status = res.status;
    error.code = payload?.error || 'request_failed';
    throw error;
  }

  return payload;
}

async function hydrateMockCiphertext(raw, currentUserId) {
  if (E2EE_MODE !== 'mock' || !raw?.ciphertext) return null;

  try {
    const decrypted = await pulseCryptoAdapter.decryptMessage({
      sessionData: null,
      ciphertext: raw.ciphertext,
      encryptedMessageKey: raw.encryptedMessageKey || null,
    });
    const structured = deserializeMessagePayload({
      plaintext: decrypted.plaintext,
      messageType: raw.messageType || 'text',
    });

    return normalizeIncomingMessage({
      ...raw,
      text: structured.text,
      type: structured.type,
      sharedContact: structured.sharedContact,
      attachment: structured.attachment,
      decryptedLocally: true,
      ciphertextAvailable: true,
    }, currentUserId);
  } catch {
    return null;
  }
}

export const messagingService = {
  async sendMessage({
    user,
    conversationId,
    recipientUserId,
    recipientUserIds = null,
    plaintext,
    replyToMessageId = null,
    messageType = 'text',
    sharedContact = null,
    mentions = [],
  }, currentDeviceId) {
    if (!user) throw new Error('Geen gebruiker beschikbaar.');
    if (!currentDeviceId) throw new Error('Geen huidig device beschikbaar.');
    const targetUserIds = Array.from(new Set(
      (Array.isArray(recipientUserIds) ? recipientUserIds : [recipientUserId]).filter(Boolean)
    ));
    if (targetUserIds.length === 0) throw new Error('Geen ontvanger beschikbaar.');
    const outgoingScopeError = getOutgoingMessageScopeError(messageType);
    if (outgoingScopeError) {
      throw new Error(outgoingScopeError);
    }

    const token = await getAuthToken(user);
    const payloadPlaintext = serializeMessagePayload({
      plaintext,
      messageType,
      sharedContact,
    });

    const buildRequestBody = async () => {
      const recipientPayloads = [];
      let primaryCiphertext = '';

      for (const targetUserId of targetUserIds) {
        const sessions = await ensureSessions(user, targetUserId);

        for (const session of sessions) {
          const encrypted = await pulseCryptoAdapter.encryptMessage({
            sessionData: session.sessionData,
            plaintext: payloadPlaintext,
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
            recipientUserId: targetUserId,
            recipientDeviceId: session.remoteDeviceId,
            encryptedMessageKey: encrypted.encryptedMessageKey,
          });
        }
      }

      if (recipientPayloads.length === 0) {
        throw new Error('Geen geldige ontvanger-apparaten gevonden voor dit gesprek.');
      }

      return {
        conversationId,
        senderDeviceId: currentDeviceId,
        ciphertext: primaryCiphertext,
        messageType,
        sharedContact,
        mentions,
        protocol: ENCRYPTED_MESSAGE_PROTOCOL,
        protocolVersion: 1,
        replyToMessageId,
        recipientPayloads,
      };
    };

    try {
      const requestBody = await buildRequestBody();
      return await sendEncryptedPayload({ token, body: requestBody });
    } catch (error) {
      const recoverable = ['recipient_device_not_found', 'no_recipient_devices'].includes(error?.code);
      if (!recoverable) throw error;

      for (const targetUserId of targetUserIds) {
        await sessionStore.clearByUser(user.uid, targetUserId);
      }

      const retryBody = await buildRequestBody();
      return sendEncryptedPayload({ token, body: retryBody });
    }
  },

  async hydrateIncomingMessage(raw, currentUserId) {
    if (raw.protocol !== ENCRYPTED_MESSAGE_PROTOCOL) {
      return normalizeIncomingMessage(raw, currentUserId);
    }

    const identity = await secureKeyStore.getIdentity(currentUserId);
    if (!identity) {
      const mockHydrated = await hydrateMockCiphertext(raw, currentUserId);
      if (mockHydrated) return mockHydrated;

      return normalizeIncomingMessage({
        ...raw,
        text: getEncryptedMessageDisplayText(),
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
        text: getEncryptedMessageDisplayText(),
        decryptedLocally: false,
        ciphertextAvailable: true,
      }, currentUserId);
    }

    const decrypted = await pulseCryptoAdapter.decryptMessage({
      sessionData: sessionRecord.sessionData,
      ciphertext: raw.ciphertext,
      encryptedMessageKey: raw.encryptedMessageKey,
    });
    const structured = deserializeMessagePayload({
      plaintext: decrypted.plaintext,
      messageType: raw.messageType || 'text',
    });

    await sessionStore.save(currentUserId, {
      ...sessionRecord,
      sessionData: decrypted.updatedSessionData,
      updatedAt: new Date().toISOString(),
    });

    return normalizeIncomingMessage({
      ...raw,
      text: structured.text,
      type: structured.type,
      sharedContact: structured.sharedContact,
      attachment: structured.attachment,
      decryptedLocally: true,
      ciphertextAvailable: true,
    }, currentUserId);
  },

  async sendReceipt({ user, messageId, type }) {
    if (!user || !messageId || !['delivered', 'read'].includes(type)) return;

    const identity = await secureKeyStore.getIdentity(user.uid);
    const currentDeviceId = identity?.deviceId || null;
    if (!currentDeviceId) return;

    const token = await getAuthToken(user);
    await fetch(`${BACKEND_URL}/messages/receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messageId,
        recipientDeviceId: currentDeviceId,
        type,
      }),
    });
  },
};
