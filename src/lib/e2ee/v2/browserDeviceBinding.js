const BINDING_PREFIX = 'pulse_e2ee_v2_browser_qa_binding_';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function bindingKey(userId) {
  return `${BINDING_PREFIX}${userId}`;
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

export function readBrowserE2eeV2QaBinding(userId, storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(bindingKey(userId)) || 'null');
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
} = {}) {
  const existing = readBrowserE2eeV2QaBinding(userId, storage);
  if (existing) return existing;
  const randomId = randomUuid?.();
  if (!randomId) throw new Error('v2_secure_uuid_unavailable');
  const occupied = new Set(registeredDevices
    .map((device) => Number(device?.signalDeviceId))
    .filter((value) => Number.isInteger(value)));
  const signalDeviceId = Array.from({ length: 127 }, (_, index) => index + 1)
    .find((candidate) => !occupied.has(candidate));
  if (!signalDeviceId) throw new Error('v2_signal_device_slots_exhausted');
  const binding = { deviceId: `browser-qa-${randomId}`, signalDeviceId };
  storage.setItem(bindingKey(userId), JSON.stringify(binding));
  return binding;
}

export function updateBrowserE2eeV2QaBinding(
  userId,
  binding,
  storage = window.localStorage,
) {
  if (!isValidBinding(binding)) throw new Error('v2_browser_binding_invalid');
  storage.setItem(bindingKey(userId), JSON.stringify(binding));
  return binding;
}

export function clearBrowserE2eeV2QaBinding(userId, storage = window.localStorage) {
  storage.removeItem(bindingKey(userId));
}
