import {
  PULSE_GROUP_E2EE_PROTOCOL,
  PULSE_GROUP_E2EE_VERSION,
} from '../group/groupProtocolContract';
import {
  createNativeE2eeV2GroupSenderKeyDistribution,
  decryptNativeE2eeV2GroupText,
  decryptNativeE2eeV2Text,
  encryptNativeE2eeV2GroupText,
  encryptNativeE2eeV2Text,
  getNativeE2eeV2Status,
  processNativeE2eeV2GroupSenderKeyDistribution,
} from './nativeAndroidProvider';
import { v2ApiClient } from './v2ApiClient';

function requireProvider(status) {
  if (status?.providerAvailable !== true || status?.privateMaterialExportable !== false) {
    throw new Error('v2_native_provider_not_released');
  }
}

function requireUser(user) {
  if (!user?.uid) throw new Error('v2_auth_required');
}

function groupHeader(value) {
  return {
    protocol: PULSE_GROUP_E2EE_PROTOCOL,
    protocolVersion: PULSE_GROUP_E2EE_VERSION,
    ...value,
  };
}

function targetKey(target) {
  return `${target.userId}\u0000${target.deviceId}`;
}

function requireUniqueTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('group_e2ee_recipient_devices_required');
  }
  const seen = new Set();
  targets.forEach((target) => {
    const key = targetKey(target);
    if (seen.has(key)) throw new Error('group_e2ee_duplicate_recipient_device');
    seen.add(key);
  });
  return targets;
}

export async function distributeAndroidGroupSenderKey({
  user,
  localDeviceId,
  localSignalDeviceId,
  localIdentityVersion,
  conversationId,
  epoch,
  distributionId,
  recipientTargets,
  api = v2ApiClient,
  getStatus = getNativeE2eeV2Status,
  createDistribution = createNativeE2eeV2GroupSenderKeyDistribution,
  encryptText = encryptNativeE2eeV2Text,
} = {}) {
  requireUser(user);
  requireProvider(await getStatus());
  const targets = requireUniqueTargets(recipientTargets);
  const created = await createDistribution({
    userId: user.uid,
    localSignalDeviceId,
    groupId: conversationId,
    epoch,
    distributionId,
  });
  if (!created?.distribution) throw new Error('group_e2ee_distribution_create_failed');

  const recipientEnvelopes = [];
  for (const target of targets) {
    const encrypted = await encryptText({
      operationId: `group-distribution:${distributionId}:${target.userId}:${target.deviceId}`,
      userId: user.uid,
      localSignalDeviceId,
      remoteUserId: target.userId,
      remoteDeviceId: target.deviceId,
      remoteSignalDeviceId: target.signalDeviceId,
      remoteIdentityVersion: target.identityVersion,
      plaintext: created.distribution,
      ...(target.bundle ? { remoteBundle: target.bundle } : {}),
    });
    recipientEnvelopes.push({
      recipientUserId: target.userId,
      recipientDeviceId: target.deviceId,
      envelopeType: encrypted.envelopeType,
      ciphertext: encrypted.ciphertext,
    });
  }

  const payload = groupHeader({
    conversationId,
    senderDeviceId: localDeviceId,
    senderSignalDeviceId: localSignalDeviceId,
    senderIdentityVersion: localIdentityVersion,
    epoch,
    distributionId,
    recipientEnvelopes,
  });
  return api.sendGroupDistribution(
    user,
    payload,
    targets.map(target => ({ userId: target.userId, deviceId: target.deviceId })),
  );
}

export async function receiveAndroidGroupSenderKey({
  user,
  localDeviceId,
  localSignalDeviceId,
  conversationId,
  epoch,
  distributionId,
  api = v2ApiClient,
  getStatus = getNativeE2eeV2Status,
  decryptText = decryptNativeE2eeV2Text,
  processDistribution = processNativeE2eeV2GroupSenderKeyDistribution,
} = {}) {
  requireUser(user);
  requireProvider(await getStatus());
  const envelope = await api.fetchGroupDistribution(user, {
    conversationId, epoch, distributionId, deviceId: localDeviceId,
  });
  const decrypted = await decryptText({
    operationId: `group-distribution-receive:${conversationId}:${epoch}:${distributionId}`,
    userId: user.uid,
    localSignalDeviceId,
    remoteUserId: envelope.senderUserId,
    remoteDeviceId: envelope.senderDeviceId,
    remoteSignalDeviceId: envelope.senderSignalDeviceId,
    remoteIdentityVersion: envelope.senderIdentityVersion,
    envelopeType: envelope.envelopeType,
    ciphertext: envelope.ciphertext,
  });
  await processDistribution({
    userId: user.uid,
    localSignalDeviceId,
    senderUserId: envelope.senderUserId,
    senderSignalDeviceId: envelope.senderSignalDeviceId,
    groupId: conversationId,
    epoch,
    distributionId,
    distribution: decrypted.plaintext,
  });
  await api.acknowledgeGroupDistribution(user, {
    conversationId, epoch, distributionId, deviceId: localDeviceId,
  });
  return { ...envelope, processed: true };
}

export async function sendAndroidGroupText({
  user,
  localDeviceId,
  localSignalDeviceId,
  localIdentityVersion,
  conversationId,
  epoch,
  distributionId,
  plaintext,
  clientMessageId,
  api = v2ApiClient,
  getStatus = getNativeE2eeV2Status,
  encryptGroupText = encryptNativeE2eeV2GroupText,
  wait = delay => new Promise(resolve => setTimeout(resolve, delay)),
  distributionWaitAttempts = 20,
  distributionWaitDelayMs = 500,
} = {}) {
  requireUser(user);
  if (!plaintext) throw new Error('v2_plaintext_required');
  requireProvider(await getStatus());
  const encrypted = await encryptGroupText({
    userId: user.uid,
    localSignalDeviceId,
    groupId: conversationId,
    epoch,
    distributionId,
    plaintext,
  });
  if (encrypted.epoch !== epoch || encrypted.distributionId !== distributionId) {
    throw new Error('group_e2ee_native_context_mismatch');
  }
  const payload = groupHeader({
    conversationId,
    clientMessageId,
    senderDeviceId: localDeviceId,
    senderSignalDeviceId: localSignalDeviceId,
    senderIdentityVersion: localIdentityVersion,
    epoch,
    distributionId,
    messageType: 'text',
    ciphertext: encrypted.ciphertext,
  });
  for (let attempt = 1; attempt <= distributionWaitAttempts; attempt += 1) {
    try {
      return await api.sendGroupMessage(user, payload);
    } catch (error) {
      if (
        error?.code !== 'group_e2ee_distribution_required'
        || attempt === distributionWaitAttempts
      ) {
        throw error;
      }
      await wait(distributionWaitDelayMs);
    }
  }
  throw new Error('group_e2ee_distribution_required');
}

export async function receiveAndroidGroupText({
  user,
  localDeviceId,
  localSignalDeviceId,
  conversationId,
  messageId,
  api = v2ApiClient,
  getStatus = getNativeE2eeV2Status,
  decryptGroupText = decryptNativeE2eeV2GroupText,
  commitPlaintext,
} = {}) {
  requireUser(user);
  requireProvider(await getStatus());
  const message = await api.fetchGroupMessage(user, {
    conversationId, messageId, deviceId: localDeviceId,
  });
  const decrypted = await decryptGroupText({
    userId: user.uid,
    localSignalDeviceId,
    senderUserId: message.senderUserId,
    senderSignalDeviceId: message.senderSignalDeviceId,
    groupId: conversationId,
    epoch: message.epoch,
    distributionId: message.distributionId,
    ciphertext: message.ciphertext,
  });
  const committed = { ...message, plaintext: decrypted.plaintext };
  await commitPlaintext?.(committed);
  await api.acknowledgeGroupMessage(user, {
    conversationId, messageId, deviceId: localDeviceId,
  });
  return committed;
}
