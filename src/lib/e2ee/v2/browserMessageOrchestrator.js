import {
  receiveAndroidE2eeV2Text,
  sendAndroidE2eeV2Text,
} from './androidMessageOrchestrator';
import { v2ApiClient } from './v2ApiClient';

function requireClient(client) {
  if (!client
    || typeof client.status !== 'function'
    || typeof client.listSessionDevices !== 'function'
    || typeof client.encrypt !== 'function'
    || typeof client.decrypt !== 'function'
    || typeof client.saveOutbox !== 'function'
    || typeof client.listOutbox !== 'function'
    || typeof client.removeOutbox !== 'function'
    || typeof client.storeReceivedMessage !== 'function'
    || typeof client.listReceivedMessages !== 'function'
    || typeof client.clearReceivedMessages !== 'function') {
    throw new Error('v2_browser_provider_invalid');
  }
  return client;
}

async function releasedBrowserStatus(client) {
  const status = await client.status();
  return {
    ...status,
    providerAvailable: status?.wasmReady === true && status?.bootstrapped === true,
    privateMaterialExportable: false,
  };
}

export function createBrowserE2eeV2MessageOrchestrator({
  client,
  api = v2ApiClient,
  nextUuid,
} = {}) {
  const provider = requireClient(client);
  const getStatus = () => releasedBrowserStatus(provider);

  const receiveText = (options = {}) => receiveAndroidE2eeV2Text({
    ...options,
    api,
    getStatus,
    decryptText: (payload) => provider.decrypt(payload),
    providerUnavailableCode: 'v2_browser_provider_not_released',
  });

  return Object.freeze({
    sendText(options = {}) {
      return sendAndroidE2eeV2Text({
        ...options,
        api,
        getStatus,
        listSessionDevices: (payload) => provider.listSessionDevices(payload),
        encryptText: (payload) => provider.encrypt(payload),
        persistCiphertextOutbox: (payload) => provider.saveOutbox(payload),
        removeCiphertextOutbox: (payload) => provider.removeOutbox(payload),
        providerUnavailableCode: 'v2_browser_provider_not_released',
        ...(nextUuid ? { nextUuid } : {}),
      });
    },

    receiveText,

    async receiveAndAcknowledge(options = {}) {
      const message = await receiveText(options);
      await provider.storeReceivedMessage(message);
      await api.acknowledgeMessage(options.user, {
        conversationId: options.conversationId,
        messageId: options.messageId,
        deviceId: options.localDeviceId,
      });
      return message;
    },

    async retryOutbox({ user } = {}) {
      const { messages } = await provider.listOutbox();
      const results = [];
      for (const pending of messages) {
        // Keep retries sequential so a single browser device preserves send order.
        // eslint-disable-next-line no-await-in-loop
        const result = await api.sendMessage(
          user,
          pending.message,
          pending.expectedRecipientDevices,
        );
        // eslint-disable-next-line no-await-in-loop
        await provider.removeOutbox({ clientMessageId: pending.message.clientMessageId });
        results.push(result);
      }
      return results;
    },

    async listReceivedMessages({ conversationId } = {}) {
      const result = await provider.listReceivedMessages({ conversationId });
      return Array.isArray(result?.messages) ? result.messages : [];
    },

    clearReceivedMessages({ conversationId } = {}) {
      return provider.clearReceivedMessages({ conversationId });
    },
  });
}
