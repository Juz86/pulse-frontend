import {
  E2EE_MODE,
  E2EE_TRANSPORT,
  E2EE_V2_QA_BACKEND_URL,
  assertBrowserE2eeV2QaConfiguration,
} from '../config';
import { BACKEND_URL, setSocketE2EEDeviceId } from '../../../services/socket';
import {
  clearBrowserE2eeV2QaBinding,
  createBrowserE2eeV2QaBinding,
  readBrowserE2eeV2QaBinding,
  updateBrowserE2eeV2QaBinding,
} from './browserDeviceBinding';
import { registerBrowserE2eeV2Device } from './browserDeviceRegistration';
import { createBrowserE2eeV2MessageOrchestrator } from './browserMessageOrchestrator';
import { handleBrowserE2eeV2SecurityEvent } from './browserSessionLifecycle';
import { createV2ApiClient } from './v2ApiClient';

function isTemporaryBackendFailure(error) {
  return !Number.isInteger(error?.status) || error.status === 0 || error.status >= 500;
}

function chronological(left, right) {
  return Date.parse(left.createdAt || '') - Date.parse(right.createdAt || '')
    || String(left.messageId || '').localeCompare(String(right.messageId || ''));
}

export async function startBrowserE2eeV2QaRuntime({
  user,
  client,
  backendUrl = E2EE_V2_QA_BACKEND_URL,
  runtimeBackendUrl = BACKEND_URL,
  api = createV2ApiClient({ baseUrl: backendUrl }),
  storage = window.localStorage,
  randomUuid = () => window.crypto?.randomUUID?.(),
  bindSocketDevice = setSocketE2EEDeviceId,
  assertConfiguration = assertBrowserE2eeV2QaConfiguration,
  registerDevice = registerBrowserE2eeV2Device,
  createMessageOrchestrator = createBrowserE2eeV2MessageOrchestrator,
  handleSecurityEvent = handleBrowserE2eeV2SecurityEvent,
  bindingNamespace = 'qa',
} = {}) {
  assertConfiguration({
    enabled: true,
    browserEnabled: true,
    mode: E2EE_MODE,
    transport: E2EE_TRANSPORT,
    backendUrl,
    runtimeBackendUrl,
  });
  if (!user?.uid) throw new Error('v2_auth_required');
  if (!client || typeof client.initialize !== 'function') {
    throw new Error('v2_browser_provider_invalid');
  }

  const existing = readBrowserE2eeV2QaBinding(user.uid, storage, bindingNamespace);
  const registeredDevices = existing ? [] : await api.listDevices(user);
  const binding = createBrowserE2eeV2QaBinding({
    userId: user.uid,
    registeredDevices,
    storage,
    randomUuid,
    bindingNamespace,
  });
  const initialized = await client.initialize({ uid: user.uid, ...binding });
  let registration;
  if (existing?.registered && initialized?.bootstrapped) {
    registration = {
      ...existing,
      identityVersion: existing.identityVersion || 1,
      status: 'REGISTERED_CACHED',
    };
  } else {
    registration = await registerDevice({
      user,
      ...binding,
      client,
      api,
    });
    updateBrowserE2eeV2QaBinding(user.uid, {
      ...binding,
      identityVersion: registration.identityVersion,
      registered: true,
    }, storage, bindingNamespace);
  }
  bindSocketDevice(registration.deviceId);

  const messages = createMessageOrchestrator({ client, api, nextUuid: randomUuid });
  try {
    await messages.retryOutbox({ user });
  } catch (error) {
    if (!isTemporaryBackendFailure(error)) throw error;
  }

  const receiveTextMessage = ({ conversationId, messageId }) => (
    messages.receiveAndAcknowledge({
      user,
      localDeviceId: registration.deviceId,
      localSignalDeviceId: registration.signalDeviceId,
      conversationId,
      messageId,
    })
  );

  return Object.freeze({
    ...registration,
    api,
    async sendText({ conversationId, recipientUserId, plaintext, clientMessageId }) {
      const result = await messages.sendText({
        user,
        localDeviceId: registration.deviceId,
        localSignalDeviceId: registration.signalDeviceId,
        conversationId,
        recipientUserId,
        plaintext,
        clientMessageId,
      });
      await client.storeReceivedMessage({
        conversationId,
        messageId: result.messageId,
        clientMessageId: result.clientMessageId || clientMessageId,
        senderUserId: user.uid,
        senderDeviceId: registration.deviceId,
        messageType: 'text',
        plaintext,
        createdAt: result.acceptedAt || new Date().toISOString(),
      });
      return result;
    },
    receiveTextMessage,
    async fetchTextMessages({ conversationId, limit = 50, offset = 0 }) {
      const stored = await messages.listReceivedMessages({ conversationId });
      let feed;
      try {
        feed = await api.listMessageFeed(user, {
          conversationId,
          deviceId: registration.deviceId,
          limit,
          offset,
        });
      } catch (error) {
        if (stored.length === 0 || !isTemporaryBackendFailure(error)) throw error;
        feed = [];
      }
      const byId = new Map(stored.map((message) => [message.messageId, message]));
      for (const item of [...feed].sort(chronological)) {
        if (byId.has(item.messageId)) continue;
        // Receive sequentially to preserve the Double Ratchet order.
        // eslint-disable-next-line no-await-in-loop
        const received = await receiveTextMessage(item);
        byId.set(received.messageId, received);
      }
      return [...byId.values()].sort(chronological);
    },
    clearTextMessages({ conversationId }) {
      return messages.clearReceivedMessages({ conversationId });
    },
    handleSecurityEvent(options) {
      return handleSecurityEvent({ ...options, client });
    },
    invalidateLocalDevice({ reason = 'security_event' } = {}) {
      clearBrowserE2eeV2QaBinding(user.uid, storage, bindingNamespace);
      bindSocketDevice(null);
      return { invalidated: true, reason };
    },
    close() {
      bindSocketDevice(null);
      client.close();
    },
  });
}
