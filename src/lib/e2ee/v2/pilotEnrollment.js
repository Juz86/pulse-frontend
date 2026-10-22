export async function checkE2eeV2PilotEnrollment({ user, api } = {}) {
  if (!user?.uid || typeof user.getIdToken !== 'function') {
    throw new Error('v2_auth_required');
  }
  if (!api || typeof api.getPilotStatus !== 'function') {
    throw new Error('v2_pilot_api_invalid');
  }
  const status = await api.getPilotStatus(user);
  return Object.freeze({
    enabled: status.enabled === true,
    enrolled: status.enabled === true && status.enrolled === true,
    mode: status.mode,
    sendingEnabled: status.sendingEnabled === true,
  });
}
