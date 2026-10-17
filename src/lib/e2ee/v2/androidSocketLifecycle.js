import { receiveAndroidE2eeV2Text } from './androidMessageOrchestrator';
import { handleAndroidE2eeV2SecurityEvent } from './androidSessionLifecycle';
import {
  PULSE_E2EE_V2_PROTOCOL,
  PULSE_E2EE_V2_VERSION,
} from './protocolV2Contract';

const SECURITY_EVENTS = Object.freeze([
  'e2ee:identity-changed',
  'e2ee:device-security',
]);
const MESSAGE_EVENT = 'e2ee:v2:message-available';
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

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

export function attachAndroidE2eeV2SocketLifecycle({
  socket,
  user,
  localDeviceId,
  localSignalDeviceId,
  handleSecurityEvent = handleAndroidE2eeV2SecurityEvent,
  receiveMessage = receiveAndroidE2eeV2Text,
  onMessage,
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

  SECURITY_EVENTS.forEach((eventName) => socket.on(eventName, onSecurityEvent));
  socket.on(MESSAGE_EVENT, onMessageAvailable);

  return () => {
    attached = false;
    SECURITY_EVENTS.forEach((eventName) => socket.off(eventName, onSecurityEvent));
    socket.off(MESSAGE_EVENT, onMessageAvailable);
    handledSecurityEvents.clear();
    handledMessages.clear();
  };
}
