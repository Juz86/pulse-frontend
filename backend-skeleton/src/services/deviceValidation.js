export function isActiveDevice(device = {}) {
  return !!device && device.status === 'active';
}

export function canUseSenderDevice(device = {}, uid) {
  return !!device && device.userId === uid && device.status === 'active';
}

export function canTargetRecipientDevice(device = {}, recipientUserId) {
  return !!device && device.userId === recipientUserId && device.status === 'active';
}
