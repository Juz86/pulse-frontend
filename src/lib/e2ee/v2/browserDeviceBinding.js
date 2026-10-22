const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function bindingKey(userId, bindingNamespace = 'qa') {
  if (!['qa', 'pilot'].includes(bindingNamespace)) throw new Error('v2_binding_namespace_invalid');
  return `pulse_e2ee_v2_browser_${bindingNamespace}_binding_${userId}`;
}

function isValidBinding(value) {
  return Boolean(
    value
    && DEVICE_ID_PATTERN.test(String(value.deviceId || ''))
    && Number.isInteger(value.signalDeviceId)
    && value.signalDeviceId >= 1
    && value.signalDeviceId <= 127
  );
}

export function readBrowserE2eeV2QaBinding(
  userId,
  storage = window.localStorage,
  bindingNamespace = 'qa',
) {
  try {
    const value = JSON.parse(storage.getItem(bindingKey(userId, bindingNamespace)) || 'null');
    return isValidBinding(value) ? value : null;
  } catch {
    return null;
  }
}

export function createBrowserE2eeV2QaBinding({
  userId,
  registeredDevices = [],
  storage = window.localStorage,
  randomUuid = () => window.crypto?.randomUUID?.(),
  bindingNamespace = 'qa',
} = {}) {
  const existing = readBrowserE2eeV2QaBinding(userId, storage, bindingNamespace);
  if (existing) return existing;
  const randomId = randomUuid?.();
  if (!randomId) throw new Error('v2_secure_uuid_unavailable');
  const occupied = new Set(registeredDevices
    .map((device) => Number(device?.signalDeviceId))
    .filter((value) => Number.isInteger(value)));
  const signalDeviceId = Array.from({ length: 127 }, (_, index) => index + 1)
    .find((candidate) => !occupied.has(candidate));
  if (!signalDeviceId) throw new Error('v2_signal_device_slots_exhausted');
  const binding = { deviceId: `browser-${bindingNamespace}-${randomId}`, signalDeviceId };
  storage.setItem(bindingKey(userId, bindingNamespace), JSON.stringify(binding));
  return binding;
}

export function updateBrowserE2eeV2QaBinding(
  userId,
  binding,
  storage = window.localStorage,
  bindingNamespace = 'qa',
) {
  if (!isValidBinding(binding)) throw new Error('v2_browser_binding_invalid');
  storage.setItem(bindingKey(userId, bindingNamespace), JSON.stringify(binding));
  return binding;
}

export function clearBrowserE2eeV2QaBinding(
  userId,
  storage = window.localStorage,
  bindingNamespace = 'qa',
) {
  storage.removeItem(bindingKey(userId, bindingNamespace));
}
