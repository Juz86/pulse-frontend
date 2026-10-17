import {
  decryptNativeE2eeV2Text,
  encryptNativeE2eeV2Text,
  getNativeE2eeV2Status,
  listNativeE2eeV2SessionDevices,
} from './nativeAndroidProvider';
import { v2ApiClient } from './v2ApiClient';

function requireReleasedProvider(status) {
  if (status?.providerAvailable !== true || status?.privateMaterialExportable !== false) {
    throw new Error('v2_native_provider_not_released');
  }
}

function createUuid() {
  const value = window.crypto?.randomUUID?.();
  if (!value) throw new Error('v2_secure_uuid_unavailable');
  return value;
}

function publicBundle(device) {
  return {
    registrationId: device.registrationId,
    signalDeviceId: device.signalDeviceId,
    identityKey: device.identityKey,
    identityVersion: device.identityVersion,
    signedPreKey: device.signedPreKey,
    kyberPreKey: device.kyberPreKey,
    oneTimePreKey: device.oneTimePreKey,
  };
}

function targetKey(target) {
  return `${target.userId}\u0000${target.deviceId}`;
}

function claimedTargets(claim) {
  return (claim?.devices || []).map((device) => ({
    userId: claim.recipientUserId,
    deviceId: device.deviceId,
    signalDeviceId: device.signalDeviceId,
    identityVersion: device.identityVersion,
    bundle: publicBundle(device),
  }));
}

function sessionTargets(userId, response) {
  return (response?.devices || []).map((device) => ({
    userId,
    deviceId: device.deviceId,
    signalDeviceId: device.signalDeviceId,
    identityVersion: device.identityVersion,
    bundle: null,
  }));
}

function ensureUniqueTargets(targets) {
  const seen = new Set();
  targets.forEach((target) => {
    const key = targetKey(target);
    if (seen.has(key)) throw new Error('v2_duplicate_target_device');
    seen.add(key);
  });
  return targets;
}

async function claimAllTargets({
  user,
  conversationId,
  recipientUserId,
  localDeviceId,
  api,
  nextUuid,
}) {
  const [recipientClaim, ownClaim] = await Promise.all([
    api.claimRecipientBundles(user, {
      conversationId,
      recipientUserId,
      requesterDeviceId: localDeviceId,
      claimId: nextUuid(),
    }),
    api.claimOwnDeviceBundles(user, {
      conversationId,
      requesterDeviceId: localDeviceId,
      claimId: nextUuid(),
    }),
  ]);
  return ensureUniqueTargets([
    ...claimedTargets(recipientClaim),
    ...claimedTargets(ownClaim),
  ]);
}

async function encryptTargets({
  user,
  localSignalDeviceId,
  plaintext,
  targets,
  existingEnvelopes = new Map(),
  encryptText,
}) {
  const envelopes = [];
  for (const target of targets) {
    const key = targetKey(target);
    const existing = existingEnvelopes.get(key);
    if (existing) {
      if (existing.signalDeviceId !== target.signalDeviceId) {
        throw new Error('v2_remote_device_mapping_changed');
      }
      if (existing.identityVersion !== target.identityVersion) {
        throw new Error('v2_remote_identity_version_changed');
      }
      envelopes.push(existing.envelope);
      continue;
    }
    const encrypted = await encryptText({
      userId: user.uid,
      localSignalDeviceId,
      remoteUserId: target.userId,
      remoteDeviceId: target.deviceId,
      remoteSignalDeviceId: target.signalDeviceId,
      remoteIdentityVersion: target.identityVersion,
      plaintext,
      ...(target.bundle ? { remoteBundle: target.bundle } : {}),
    });
    envelopes.push({
      recipientUserId: target.userId,
      recipientDeviceId: target.deviceId,
      envelopeType: encrypted.envelopeType,
      ciphertext: encrypted.ciphertext,
    });
  }
  return envelopes;
}

function envelopeMap(targets, envelopes) {
  return new Map(targets.map((target, index) => [targetKey(target), {
    signalDeviceId: target.signalDeviceId,
    identityVersion: target.identityVersion,
    envelope: envelopes[index],
  }]));
}

export async function sendAndroidE2eeV2Text({
  user,
  localDeviceId,
  localSignalDeviceId,
  conversationId,
  recipientUserId,
  plaintext,
  clientMessageId,
  api = v2ApiClient,
  getStatus = getNativeE2eeV2Status,
  listSessionDevices = listNativeE2eeV2SessionDevices,
  encryptText = encryptNativeE2eeV2Text,
  nextUuid = createUuid,
} = {}) {
  if (!user?.uid) throw new Error('v2_auth_required');
  if (!plaintext) throw new Error('v2_plaintext_required');
  requireReleasedProvider(await getStatus());

  const [recipientSessions, ownSessions] = await Promise.all([
    listSessionDevices({
      userId: user.uid,
      localSignalDeviceId,
      remoteUserId: recipientUserId,
    }),
    listSessionDevices({
      userId: user.uid,
      localSignalDeviceId,
      remoteUserId: user.uid,
    }),
  ]);
  let targets = ensureUniqueTargets([
    ...sessionTargets(recipientUserId, recipientSessions),
    ...sessionTargets(user.uid, ownSessions),
  ]);
  let claimed = false;
  if (!targets.some((target) => target.userId === recipientUserId)) {
    targets = await claimAllTargets({
      user,
      conversationId,
      recipientUserId,
      localDeviceId,
      api,
      nextUuid,
    });
    claimed = true;
  }

  const messageId = clientMessageId || nextUuid();
  let envelopes = await encryptTargets({
    user,
    localSignalDeviceId,
    plaintext,
    targets,
    encryptText,
  });

  const send = () => api.sendMessage(user, {
    conversationId,
    clientMessageId: messageId,
    senderDeviceId: localDeviceId,
    messageType: 'text',
    recipientEnvelopes: envelopes,
  }, targets.map((target) => ({ userId: target.userId, deviceId: target.deviceId })));

  try {
    return await send();
  } catch (error) {
    if (claimed || error?.code !== 'v2_recipient_set_mismatch') throw error;
    const previous = envelopeMap(targets, envelopes);
    targets = await claimAllTargets({
      user,
      conversationId,
      recipientUserId,
      localDeviceId,
      api,
      nextUuid,
    });
    envelopes = await encryptTargets({
      user,
      localSignalDeviceId,
      plaintext,
      targets,
      existingEnvelopes: previous,
      encryptText,
    });
    return send();
  }
}

export async function receiveAndroidE2eeV2Text({
  user,
  localDeviceId,
  localSignalDeviceId,
  conversationId,
  messageId,
  api = v2ApiClient,
  getStatus = getNativeE2eeV2Status,
  decryptText = decryptNativeE2eeV2Text,
} = {}) {
  if (!user?.uid) throw new Error('v2_auth_required');
  requireReleasedProvider(await getStatus());
  const envelope = await api.fetchEnvelope(user, {
    conversationId,
    messageId,
    deviceId: localDeviceId,
  });
  const decrypted = await decryptText({
    userId: user.uid,
    localSignalDeviceId,
    remoteUserId: envelope.senderUserId,
    remoteDeviceId: envelope.senderDeviceId,
    remoteSignalDeviceId: envelope.senderSignalDeviceId,
    remoteIdentityVersion: envelope.senderIdentityVersion,
    envelopeType: envelope.envelopeType,
    ciphertext: envelope.ciphertext,
  });
  return {
    ...envelope,
    plaintext: decrypted.plaintext,
  };
}
