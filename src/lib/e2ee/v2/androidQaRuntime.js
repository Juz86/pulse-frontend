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
  clearNativeE2eeV2TextMessageHistory,
  listNativeE2eeV2TextMessages,
  storeNativeE2eeV2TextMessage,
} from './nativeAndroidProvider';
import { createV2ApiClient } from './v2ApiClient';

const BINDING_PREFIX = 'pulse_e2ee_v2_qa_binding_';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requireUuid(randomUuid) {
  const value = randomUuid?.();
  if (!value) throw new Error('v2_secure_uuid_unavailable');
  return value;
}

function bindingKey(userId) {
  return `${BINDING_PREFIX}${userId}`;
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

export function readAndroidE2eeV2QaBinding(userId, storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(bindingKey(userId)) || 'null');
    return isValidBinding(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearAndroidE2eeV2QaBinding(userId, storage = window.localStorage) {
  storage.removeItem(bindingKey(userId));
}

export function createAndroidE2eeV2QaBinding({
  userId,
  registeredDevices = [],
  storage = window.localStorage,
  randomUuid = () => window.crypto?.randomUUID?.(),
} = {}) {
  const existing = readAndroidE2eeV2QaBinding(userId, storage);
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
    deviceId: `qa-${requireUuid(randomUuid)}`,
    signalDeviceId,
  };
  // Public routing metadata is persisted before native bootstrap. If network
  // registration fails, retrying must reuse the Signal device ID already bound
  // inside Android Keystore-backed storage.
  storage.setItem(bindingKey(userId), JSON.stringify(binding));
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
  clearStoredMessages = clearNativeE2eeV2TextMessageHistory,
  listStoredMessages = listNativeE2eeV2TextMessages,
  storeMessage = storeNativeE2eeV2TextMessage,
} = {}) {
  assertConfiguration({ enabled: true, backendUrl, runtimeBackendUrl });
  if (!user?.uid) throw new Error('v2_auth_required');

  const existingBinding = readAndroidE2eeV2QaBinding(user.uid, storage);
  const devices = existingBinding ? [] : await api.listDevices(user);
  const binding = createAndroidE2eeV2QaBinding({
    userId: user.uid,
    registeredDevices: devices,
    storage,
    randomUuid,
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
        deviceLabel: 'Pulse Android E2EE QA',
        api,
      });
      storage.setItem(bindingKey(user.uid), JSON.stringify({
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

  return Object.freeze({
    ...registration,
    api,
    invalidateLocalDevice({ reason = 'security_event' } = {}) {
      clearAndroidE2eeV2QaBinding(user.uid, storage);
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
  });
}
