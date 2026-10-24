import {
  E2EE_V2_QA_BACKEND_URL,
  assertE2eeV2QaConfiguration,
} from '../config';
import { BACKEND_URL, setSocketE2EEDeviceId } from '../../../services/socket';
import { registerAndroidE2eeV2Device } from './androidDeviceRegistration';
import {
  receiveAndroidE2eeV2Text,
  sendAndroidE2eeV2Text,
} from './androidMessageOrchestrator';
import {
  distributeAndroidGroupSenderKey,
  receiveAndroidGroupSenderKey,
  receiveAndroidGroupText,
  sendAndroidGroupText,
} from './androidGroupMessageOrchestrator';
import {
  clearNativeE2eeV2TextMessageHistory,
  listNativeE2eeV2TextMessages,
  storeNativeE2eeV2TextMessage,
} from './nativeAndroidProvider';
import { createV2ApiClient } from './v2ApiClient';

const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requireUuid(randomUuid) {
  const value = randomUuid?.();
  if (!value) throw new Error('v2_secure_uuid_unavailable');
  return value;
}

function bindingKey(userId, bindingNamespace = 'qa') {
  if (!['qa', 'pilot'].includes(bindingNamespace)) throw new Error('v2_binding_namespace_invalid');
  return `pulse_e2ee_v2_${bindingNamespace}_binding_${userId}`;
}

function isValidBinding(value) {
  return Boolean(
    value
    && DEVICE_ID_PATTERN.test(String(value.deviceId || ''))
    && Number.isInteger(value.signalDeviceId)
    && value.signalDeviceId >= 1
    && value.signalDeviceId <= 127
  );
}

function isTemporaryBackendFailure(error) {
  return !Number.isInteger(error?.status) || error.status === 0 || error.status >= 500;
}

function groupDistributionKey(userId, conversationId, epoch, bindingNamespace) {
  return `pulse_e2ee_v2_${bindingNamespace}_group_${userId}_${conversationId}_${epoch}`;
}

function clearGroupDistributionBindings(userId, storage, bindingNamespace) {
  if (typeof storage?.key !== 'function' || !Number.isInteger(storage?.length)) return;
  const prefix = `pulse_e2ee_v2_${bindingNamespace}_group_${userId}_`;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach(key => storage.removeItem(key));
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

export function readAndroidE2eeV2QaBinding(
  userId,
  storage = window.localStorage,
  bindingNamespace = 'qa',
) {
  try {
    const value = JSON.parse(storage.getItem(bindingKey(userId, bindingNamespace)) || 'null');
    return isValidBinding(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearAndroidE2eeV2QaBinding(
  userId,
  storage = window.localStorage,
  bindingNamespace = 'qa',
) {
  storage.removeItem(bindingKey(userId, bindingNamespace));
}

export function createAndroidE2eeV2QaBinding({
  userId,
  registeredDevices = [],
  storage = window.localStorage,
  randomUuid = () => window.crypto?.randomUUID?.(),
  bindingNamespace = 'qa',
} = {}) {
  const existing = readAndroidE2eeV2QaBinding(userId, storage, bindingNamespace);
  if (existing) return existing;

  const usedSignalDeviceIds = new Set(
    registeredDevices
      .map((device) => Number(device?.signalDeviceId))
      .filter((value) => Number.isInteger(value))
  );
  const signalDeviceId = Array.from({ length: 127 }, (_, index) => index + 1)
    .find((candidate) => !usedSignalDeviceIds.has(candidate));
  if (!signalDeviceId) throw new Error('v2_signal_device_slots_exhausted');

  const binding = {
    deviceId: `${bindingNamespace}-${requireUuid(randomUuid)}`,
    signalDeviceId,
  };
  // Public routing metadata is persisted before native bootstrap. If network
  // registration fails, retrying must reuse the Signal device ID already bound
  // inside Android Keystore-backed storage.
  storage.setItem(bindingKey(userId, bindingNamespace), JSON.stringify(binding));
  return binding;
}

export async function startAndroidE2eeV2QaRuntime({
  user,
  backendUrl = E2EE_V2_QA_BACKEND_URL,
  runtimeBackendUrl = BACKEND_URL,
  api = createV2ApiClient({ baseUrl: backendUrl }),
  registerDevice = registerAndroidE2eeV2Device,
  storage = window.localStorage,
  randomUuid = () => window.crypto?.randomUUID?.(),
  bindSocketDevice = setSocketE2EEDeviceId,
  assertConfiguration = assertE2eeV2QaConfiguration,
  receiveMessage = receiveAndroidE2eeV2Text,
  sendMessage = sendAndroidE2eeV2Text,
  distributeGroupKey = distributeAndroidGroupSenderKey,
  receiveGroupKey = receiveAndroidGroupSenderKey,
  receiveGroupMessage = receiveAndroidGroupText,
  sendGroupMessage = sendAndroidGroupText,
  clearStoredMessages = clearNativeE2eeV2TextMessageHistory,
  listStoredMessages = listNativeE2eeV2TextMessages,
  storeMessage = storeNativeE2eeV2TextMessage,
  bindingNamespace = 'qa',
} = {}) {
  assertConfiguration({ enabled: true, backendUrl, runtimeBackendUrl });
  if (!user?.uid) throw new Error('v2_auth_required');

  const existingBinding = readAndroidE2eeV2QaBinding(user.uid, storage, bindingNamespace);
  const devices = existingBinding ? [] : await api.listDevices(user);
  const binding = createAndroidE2eeV2QaBinding({
    userId: user.uid,
    registeredDevices: devices,
    storage,
    randomUuid,
    bindingNamespace,
  });
  let registration;
  if (existingBinding) {
    registration = {
      ...existingBinding,
      identityVersion: existingBinding.identityVersion || 1,
      status: 'REGISTERED_CACHED',
    };
  } else {
    try {
      registration = await registerDevice({
        user,
        ...binding,
        deviceLabel: bindingNamespace === 'pilot'
          ? 'Pulse Android E2EE Pilot'
          : 'Pulse Android E2EE QA',
        api,
      });
      storage.setItem(bindingKey(user.uid, bindingNamespace), JSON.stringify({
        ...binding,
        identityVersion: registration.identityVersion,
        registered: true,
      }));
    } catch (error) {
      if (!existingBinding || !isTemporaryBackendFailure(error)) throw error;
      registration = {
        ...existingBinding,
        identityVersion: existingBinding.identityVersion || 1,
        status: 'OFFLINE_REGISTERED',
      };
    }
  }
  bindSocketDevice(registration.deviceId);

  const receivedMessages = new Map();
  let receiveQueue = Promise.resolve();
  const messageKey = (conversationId, messageId) => `${conversationId}\u0000${messageId}`;
  const receiveTextMessage = ({ conversationId, messageId }) => {
    const operation = receiveQueue.then(async () => {
      const key = messageKey(conversationId, messageId);
      let cached = receivedMessages.get(key);
      if (!cached) {
        const message = await receiveMessage({
          user,
          localDeviceId: registration.deviceId,
          localSignalDeviceId: registration.signalDeviceId,
          conversationId,
          messageId,
          api,
        });
        await storeMessage({ userId: user.uid, ...message });
        cached = { message, acknowledged: false };
        receivedMessages.set(key, cached);
      }
      if (!cached.acknowledged) {
        await api.acknowledgeMessage(user, {
          conversationId,
          messageId,
          deviceId: registration.deviceId,
        });
        cached.acknowledged = true;
      }
      return cached.message;
    });
    receiveQueue = operation.catch(() => {});
    return operation;
  };

  const receiveGroupDistribution = ({ conversationId, epoch, distributionId }) => (
    receiveGroupKey({
      user,
      localDeviceId: registration.deviceId,
      localSignalDeviceId: registration.signalDeviceId,
      conversationId,
      epoch,
      distributionId,
      api,
    })
  );

  const receiveGroupTextMessage = ({ conversationId, messageId }) => (
    receiveGroupMessage({
      user,
      localDeviceId: registration.deviceId,
      localSignalDeviceId: registration.signalDeviceId,
      conversationId,
      messageId,
      api,
      commitPlaintext: async (message) => storeMessage({
        userId: user.uid,
        ...message,
        clientMessageId: message.clientMessageId || null,
        senderDeviceId: message.senderDeviceId,
        createdAt: message.createdAt || new Date().toISOString(),
      }),
    })
  );

  const claimGroupTargets = async ({ conversationId, memberUserIds }) => {
    const recipients = [...new Set(memberUserIds || [])]
      .filter(memberUserId => memberUserId && memberUserId !== user.uid);
    const claims = await Promise.all(recipients.map(recipientUserId => (
      api.claimRecipientBundles(user, {
        conversationId,
        recipientUserId,
        requesterDeviceId: registration.deviceId,
        claimId: requireUuid(randomUuid),
      })
    )));
    const ownClaim = await api.claimOwnDeviceBundles(user, {
      conversationId,
      requesterDeviceId: registration.deviceId,
      claimId: requireUuid(randomUuid),
    });
    return [...claims, ownClaim].flatMap(claim => (claim.devices || []).map(device => ({
      userId: claim.recipientUserId,
      deviceId: device.deviceId,
      signalDeviceId: device.signalDeviceId,
      identityVersion: device.identityVersion,
      bundle: publicBundle(device),
    })));
  };

  return Object.freeze({
    ...registration,
    api,
    invalidateLocalDevice({ reason = 'security_event' } = {}) {
      clearAndroidE2eeV2QaBinding(user.uid, storage, bindingNamespace);
      clearGroupDistributionBindings(user.uid, storage, bindingNamespace);
      bindSocketDevice(null);
      receivedMessages.clear();
      return { invalidated: true, reason };
    },
    async clearTextMessages({ conversationId }) {
      const result = await clearStoredMessages({
        userId: user.uid,
        conversationId,
      });
      for (const key of receivedMessages.keys()) {
        if (key.startsWith(`${conversationId}\u0000`)) receivedMessages.delete(key);
      }
      return result;
    },
    async sendText({ conversationId, recipientUserId, plaintext, clientMessageId }) {
      const stableClientMessageId = clientMessageId || requireUuid(randomUuid);
      const result = await sendMessage({
        user,
        localDeviceId: registration.deviceId,
        localSignalDeviceId: registration.signalDeviceId,
        conversationId,
        recipientUserId,
        plaintext,
        clientMessageId: stableClientMessageId,
        api,
      });
      await storeMessage({
        userId: user.uid,
        conversationId,
        messageId: result.messageId,
        clientMessageId: result.clientMessageId || stableClientMessageId,
        senderUserId: user.uid,
        senderDeviceId: registration.deviceId,
        messageType: 'text',
        plaintext,
        createdAt: result.acceptedAt || new Date().toISOString(),
      });
      return result;
    },
    async prepareGroupEpoch({ conversationId, epoch, memberUserIds, force = false }) {
      const key = groupDistributionKey(user.uid, conversationId, epoch, bindingNamespace);
      if (!force) {
        const existing = storage.getItem(key);
        if (existing) return { conversationId, epoch, distributionId: existing, reused: true };
      }
      const distributionId = requireUuid(randomUuid);
      const recipientTargets = await claimGroupTargets({ conversationId, memberUserIds });
      const result = await distributeGroupKey({
        user,
        localDeviceId: registration.deviceId,
        localSignalDeviceId: registration.signalDeviceId,
        localIdentityVersion: registration.identityVersion || 1,
        conversationId,
        epoch,
        distributionId,
        recipientTargets,
        api,
      });
      storage.setItem(key, distributionId);
      return { ...result, conversationId, epoch, distributionId, reused: false };
    },
    async sendGroupText({ conversationId, epoch, plaintext, clientMessageId }) {
      const key = groupDistributionKey(user.uid, conversationId, epoch, bindingNamespace);
      const distributionId = storage.getItem(key);
      if (!distributionId) throw new Error('group_e2ee_distribution_required');
      const stableClientMessageId = clientMessageId || requireUuid(randomUuid);
      const result = await sendGroupMessage({
        user,
        localDeviceId: registration.deviceId,
        localSignalDeviceId: registration.signalDeviceId,
        localIdentityVersion: registration.identityVersion || 1,
        conversationId,
        epoch,
        distributionId,
        plaintext,
        clientMessageId: stableClientMessageId,
        api,
      });
      await storeMessage({
        userId: user.uid,
        conversationId,
        messageId: result.messageId,
        clientMessageId: result.clientMessageId || stableClientMessageId,
        senderUserId: user.uid,
        senderDeviceId: registration.deviceId,
        messageType: 'text',
        plaintext,
        createdAt: result.acceptedAt || new Date().toISOString(),
      });
      return result;
    },
    async fetchGroupMessages({ conversationId, epoch, limit = 50 }) {
      const stored = await listStoredMessages({
        userId: user.uid,
        conversationId,
        limit,
        offset: 0,
      });
      const distributions = await api.listGroupDistributions(user, {
        conversationId,
        epoch,
        deviceId: registration.deviceId,
        limit,
      });
      for (const distribution of distributions) await receiveGroupDistribution(distribution);
      const pending = await api.listGroupMessages(user, {
        conversationId,
        deviceId: registration.deviceId,
        limit,
      });
      const byMessageId = new Map(stored.map(message => [message.messageId, message]));
      for (const message of pending) {
        const received = await receiveGroupTextMessage(message);
        byMessageId.set(received.messageId, received);
      }
      return [...byMessageId.values()].sort((left, right) => (
        Date.parse(left.createdAt || '') - Date.parse(right.createdAt || '')
        || left.messageId.localeCompare(right.messageId)
      ));
    },
    async fetchTextMessages({ conversationId, limit = 50, offset = 0 }) {
      const resultKeys = new Set();
      const stored = await listStoredMessages({
        userId: user.uid,
        conversationId,
        limit,
        offset,
      });
      stored.forEach((message) => {
        const key = messageKey(conversationId, message.messageId);
        receivedMessages.set(key, {
          message,
          acknowledged: false,
        });
        resultKeys.add(key);
      });
      let messages;
      try {
        messages = await api.listMessageFeed(user, {
          conversationId,
          deviceId: registration.deviceId,
          limit,
          offset,
        });
      } catch (error) {
        const canUseOfflineHistory = stored.length > 0 && isTemporaryBackendFailure(error);
        if (!canUseOfflineHistory) throw error;
        messages = [];
      }
      const ordered = [...messages].sort((left, right) => (
        Date.parse(left.createdAt || '') - Date.parse(right.createdAt || '')
        || left.messageId.localeCompare(right.messageId)
      ));
      for (const message of ordered) {
        const received = await receiveTextMessage({
          conversationId: message.conversationId,
          messageId: message.messageId,
        });
        resultKeys.add(messageKey(received.conversationId, received.messageId));
      }
      return [...resultKeys]
        .map((key) => receivedMessages.get(key)?.message)
        .filter(Boolean)
        .filter((message) => message.conversationId === conversationId)
        .sort((left, right) => (
          Date.parse(left.createdAt || '') - Date.parse(right.createdAt || '')
          || left.messageId.localeCompare(right.messageId)
        ));
    },
    receiveTextMessage,
    receiveGroupDistribution,
    receiveGroupMessage: receiveGroupTextMessage,
  });
}
