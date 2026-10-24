import { receiveAndroidE2eeV2Text } from './androidMessageOrchestrator';
import { handleAndroidE2eeV2SecurityEvent } from './androidSessionLifecycle';
import {
  PULSE_E2EE_V2_PROTOCOL,
  PULSE_E2EE_V2_VERSION,
} from './protocolV2Contract';
import {
  PULSE_GROUP_E2EE_PROTOCOL,
  PULSE_GROUP_E2EE_VERSION,
} from '../group/groupProtocolContract';

const SECURITY_EVENTS = Object.freeze([
  'e2ee:identity-changed',
  'e2ee:device-security',
]);
const MESSAGE_EVENT = 'e2ee:v2:message-available';
const GROUP_DISTRIBUTION_EVENT = 'e2ee:group:distribution-available';
const GROUP_MESSAGE_EVENT = 'e2ee:group:message-available';
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function messageKey(payload) {
  if (
    payload?.protocol !== PULSE_E2EE_V2_PROTOCOL
    || payload?.protocolVersion !== PULSE_E2EE_V2_VERSION
    || !ID_PATTERN.test(String(payload?.conversationId || ''))
    || !ID_PATTERN.test(String(payload?.messageId || ''))
  ) {
    throw new Error('v2_message_available_invalid');
  }
  return `${payload.conversationId}\u0000${payload.messageId}`;
}

function securityKey(payload) {
  return [
    payload?.type,
    payload?.userId,
    payload?.deviceId,
    payload?.signalDeviceId,
    payload?.identityVersion,
  ].join('\u0000');
}

function groupDistributionKey(payload) {
  if (
    payload?.protocol !== PULSE_GROUP_E2EE_PROTOCOL
    || payload?.protocolVersion !== PULSE_GROUP_E2EE_VERSION
    || !ID_PATTERN.test(String(payload?.conversationId || ''))
    || !Number.isSafeInteger(payload?.epoch)
    || payload.epoch < 1
    || !UUID_PATTERN.test(String(payload?.distributionId || ''))
  ) {
    throw new Error('group_e2ee_distribution_available_invalid');
  }
  return `${payload.conversationId}\u0000${payload.epoch}\u0000${payload.distributionId}`;
}

function groupMessageKey(payload) {
  if (
    payload?.protocol !== PULSE_GROUP_E2EE_PROTOCOL
    || payload?.protocolVersion !== PULSE_GROUP_E2EE_VERSION
    || !ID_PATTERN.test(String(payload?.conversationId || ''))
    || !UUID_PATTERN.test(String(payload?.messageId || ''))
  ) {
    throw new Error('group_e2ee_message_available_invalid');
  }
  return `${payload.conversationId}\u0000${payload.messageId}`;
}

export function attachAndroidE2eeV2SocketLifecycle({
  socket,
  user,
  localDeviceId,
  localSignalDeviceId,
  handleSecurityEvent = handleAndroidE2eeV2SecurityEvent,
  receiveMessage = receiveAndroidE2eeV2Text,
  receiveGroupDistribution,
  receiveGroupMessage,
  onMessage,
  onGroupMessage,
  onLocalDeviceInvalidated,
  onError,
} = {}) {
  if (!socket || !user?.uid || !localDeviceId || !localSignalDeviceId) {
    throw new Error('v2_socket_lifecycle_config_invalid');
  }

  let attached = true;
  let queue = Promise.resolve();
  const handledSecurityEvents = new Set();
  const handledMessages = new Set();
  const handledGroupDistributions = new Set();
  const handledGroupMessages = new Set();

  const enqueue = (operation) => {
    queue = queue.then(operation).catch((error) => {
      if (attached) onError?.(error);
    });
  };

  const onSecurityEvent = (event = {}) => {
    const key = securityKey(event);
    if (handledSecurityEvents.has(key)) return;
    handledSecurityEvents.add(key);
    enqueue(async () => {
      try {
        const result = await handleSecurityEvent({
          user,
          localDeviceId,
          localSignalDeviceId,
          event,
        });
        if (result?.action === 'local_device_invalidated') {
          onLocalDeviceInvalidated?.(result, event);
        }
      } catch (error) {
        handledSecurityEvents.delete(key);
        throw error;
      }
    });
  };

  const onMessageAvailable = (payload = {}) => {
    let key;
    try {
      key = messageKey(payload);
    } catch (error) {
      onError?.(error);
      return;
    }
    if (handledMessages.has(key)) return;
    handledMessages.add(key);
    enqueue(async () => {
      try {
        const message = await receiveMessage({
          user,
          localDeviceId,
          localSignalDeviceId,
          conversationId: payload.conversationId,
          messageId: payload.messageId,
        });
        onMessage?.(message);
      } catch (error) {
        handledMessages.delete(key);
        throw error;
      }
    });
  };

  const enqueueGroupEvent = ({ payload, keyFor, handled, receive, onReceived }) => {
    let key;
    try {
      key = keyFor(payload);
    } catch (error) {
      onError?.(error);
      return;
    }
    if (handled.has(key)) return;
    handled.add(key);
    enqueue(async () => {
      try {
        const result = await receive(payload);
        onReceived?.(result);
      } catch (error) {
        handled.delete(key);
        throw error;
      }
    });
  };

  const onGroupDistributionAvailable = (payload = {}) => enqueueGroupEvent({
    payload,
    keyFor: groupDistributionKey,
    handled: handledGroupDistributions,
    receive: receiveGroupDistribution,
  });
  const onGroupMessageAvailable = (payload = {}) => enqueueGroupEvent({
    payload,
    keyFor: groupMessageKey,
    handled: handledGroupMessages,
    receive: receiveGroupMessage,
    onReceived: onGroupMessage,
  });

  SECURITY_EVENTS.forEach((eventName) => socket.on(eventName, onSecurityEvent));
  socket.on(MESSAGE_EVENT, onMessageAvailable);
  if (receiveGroupDistribution) socket.on(GROUP_DISTRIBUTION_EVENT, onGroupDistributionAvailable);
  if (receiveGroupMessage) socket.on(GROUP_MESSAGE_EVENT, onGroupMessageAvailable);

  return () => {
    attached = false;
    SECURITY_EVENTS.forEach((eventName) => socket.off(eventName, onSecurityEvent));
    socket.off(MESSAGE_EVENT, onMessageAvailable);
    if (receiveGroupDistribution) socket.off(GROUP_DISTRIBUTION_EVENT, onGroupDistributionAvailable);
    if (receiveGroupMessage) socket.off(GROUP_MESSAGE_EVENT, onGroupMessageAvailable);
    handledSecurityEvents.clear();
    handledMessages.clear();
    handledGroupDistributions.clear();
    handledGroupMessages.clear();
  };
}
