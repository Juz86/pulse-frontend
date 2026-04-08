export function getSharedContactDisplayText(sharedContact = null) {
  return `Contactpersoon: ${sharedContact?.name || 'Contactpersoon'}`;
}

export function getSharedContactFallbackDisplayText() {
  return 'Contactpersoon gedeeld';
}

export function getEncryptedMessageDisplayText() {
  return 'Versleuteld bericht';
}

export function getDeletedMessageDisplayText() {
  return 'Bericht verwijderd';
}
