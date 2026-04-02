export const ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE = 'Bewerken voor versleutelde berichten is nog niet beschikbaar.';

export function isEncryptedProtocol(protocol) {
  return protocol === 'signal_v1';
}

export function canEditMessage(message) {
  return !isEncryptedProtocol(message?.protocol);
}

export function canApplyPlaintextEditUpdate(message) {
  return !isEncryptedProtocol(message?.protocol);
}
