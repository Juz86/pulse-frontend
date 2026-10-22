import {
  clearNativeE2eeV2UserState,
  getNativeE2eeV2Status,
  invalidateNativeE2eeV2RemoteDevice,
} from './nativeAndroidProvider';
import {
  PULSE_E2EE_V2_PROTOCOL,
  PULSE_E2EE_V2_VERSION,
} from './protocolV2Contract';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const INVALIDATING_EVENTS = new Set(['identity_changed', 'device_revoked']);

function requireReleasedProvider(status, errorCode = 'v2_native_provider_not_released') {
  if (status?.providerAvailable !== true || status?.privateMaterialExportable !== false) {
    throw new Error(errorCode);
  }
}

function requireSecurityEvent(event) {
  if (
    event?.protocol !== PULSE_E2EE_V2_PROTOCOL
    || event?.protocolVersion !== PULSE_E2EE_V2_VERSION
    || !INVALIDATING_EVENTS.has(event?.type)
    || !ID_PATTERN.test(String(event?.userId || ''))
    || !ID_PATTERN.test(String(event?.deviceId || ''))
    || !Number.isInteger(event?.signalDeviceId)
    || event.signalDeviceId < 1
    || event.signalDeviceId > 127
    || !Number.isInteger(event?.identityVersion)
    || event.identityVersion < 1
  ) {
    throw new Error('v2_security_event_invalid');
  }
  return event;
}

export async function handleAndroidE2eeV2SecurityEvent({
  user,
  localDeviceId,
  localSignalDeviceId,
  event,
  getStatus = getNativeE2eeV2Status,
  invalidateRemoteDevice = invalidateNativeE2eeV2RemoteDevice,
  clearUserState = clearNativeE2eeV2UserState,
  providerUnavailableCode,
} = {}) {
  if (!user?.uid) throw new Error('v2_auth_required');
  requireReleasedProvider(await getStatus(), providerUnavailableCode);
  const securityEvent = requireSecurityEvent(event);

  if (securityEvent.userId === user.uid && securityEvent.deviceId === localDeviceId) {
    await clearUserState(user.uid);
    return {
      action: 'local_device_invalidated',
      requiresRegistration: securityEvent.type === 'identity_changed',
      revoked: securityEvent.type === 'device_revoked',
    };
  }

  await invalidateRemoteDevice({
    userId: user.uid,
    localSignalDeviceId,
    remoteUserId: securityEvent.userId,
    remoteDeviceId: securityEvent.deviceId,
    remoteSignalDeviceId: securityEvent.signalDeviceId,
    remoteIdentityVersion: securityEvent.identityVersion,
    revoked: securityEvent.type === 'device_revoked',
  });
  return {
    action: 'remote_session_invalidated',
    requiresRegistration: false,
    revoked: securityEvent.type === 'device_revoked',
  };
}
