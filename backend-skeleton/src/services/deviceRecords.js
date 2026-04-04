export function toDeviceSummary(device = {}) {
  return {
    id: device.id,
    userId: device.userId,
    deviceLabel: device.deviceLabel || 'Onbekend apparaat',
    platform: device.platform || 'unknown',
    protocol: device.protocol || 'signal_v1',
    protocolVersion: device.protocolVersion || 1,
    status: device.status || 'active',
    oneTimePreKeyCount: Number(device.oneTimePreKeyCount || 0),
    signedPreKeyKeyId: device.signedPreKey?.keyId ?? null,
    signedPreKeyRotatedAt: device.signedPreKeyRotatedAt || null,
    createdAt: device.createdAt || null,
    updatedAt: device.updatedAt || null,
    revokedAt: device.revokedAt || null,
  };
}

export function isOwnedActiveDevice(device = {}, uid) {
  return !!device && device.userId === uid && device.status === 'active';
}
