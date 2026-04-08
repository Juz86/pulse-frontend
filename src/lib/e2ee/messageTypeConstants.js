export const KNOWN_PULSE_MESSAGE_TYPES = ['text', 'contact', 'attachment', 'call', 'system'];

export const ACTIVE_OUTGOING_MESSAGE_TYPES = ['text', 'contact'];

export function resolveKnownPulseMessageType(messageType = 'text') {
  return KNOWN_PULSE_MESSAGE_TYPES.includes(messageType) ? messageType : 'text';
}
