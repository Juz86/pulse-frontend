import { ENCRYPTED_MESSAGE_PROTOCOL } from './messageProtocolConstants';

export const ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE = 'Bewerken voor versleutelde berichten is nog niet beschikbaar.';

export function isEncryptedProtocol(protocol) {
  return protocol === ENCRYPTED_MESSAGE_PROTOCOL;
}

export function canEditMessage(message) {
  return !isEncryptedProtocol(message?.protocol);
}

export function canApplyPlaintextEditUpdate(message) {
  return !isEncryptedProtocol(message?.protocol);
}
