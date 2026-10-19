import {
  E2EE_V2_QA_BACKEND_URL,
  assertE2eeV2QaConfiguration,
} from '../config';
import { BACKEND_URL, setSocketE2EEDeviceId } from '../../../services/socket';
import { registerAndroidE2eeV2Device } from './androidDeviceRegistration';
import { sendAndroidE2eeV2Text } from './androidMessageOrchestrator';
import { createV2ApiClient } from './v2ApiClient';

const BINDING_PREFIX = 'pulse_e2ee_v2_qa_binding_';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requireUuid(randomUuid) {
  const value = randomUuid?.();
  if (!value) throw new Error('v2_secure_uuid_unavailable');
  return value;
}

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

export function readAndroidE2eeV2QaBinding(userId, storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(bindingKey(userId)) || 'null');
    return isValidBinding(value) ? value : null;
  } catch {
    return null;
  }
}

export function createAndroidE2eeV2QaBinding({
  userId,
  registeredDevices = [],
  storage = window.localStorage,
  randomUuid = () => window.crypto?.randomUUID?.(),
} = {}) {
  const existing = readAndroidE2eeV2QaBinding(userId, storage);
  if (existing) return existing;

  const usedSignalDeviceIds = new Set(
    registeredDevices
      .map((device) => Number(device?.signalDeviceId))
      .filter((value) => Number.isInteger(value))
  );
  const signalDeviceId = Array.from({ length: 127 }, (_, index) => index + 1)
    .find((candidate) => !usedSignalDeviceIds.has(candidate));
  if (!signalDeviceId) throw new Error('v2_signal_device_slots_exhausted');

  const binding = {
    deviceId: `qa-${requireUuid(randomUuid)}`,
    signalDeviceId,
  };
  // Public routing metadata is persisted before native bootstrap. If network
  // registration fails, retrying must reuse the Signal device ID already bound
  // inside Android Keystore-backed storage.
  storage.setItem(bindingKey(userId), JSON.stringify(binding));
  return binding;
}

export async function startAndroidE2eeV2QaRuntime({
  user,
  backendUrl = E2EE_V2_QA_BACKEND_URL,
  runtimeBackendUrl = BACKEND_URL,
  api = createV2ApiClient({ baseUrl: backendUrl }),
  registerDevice = registerAndroidE2eeV2Device,
  storage = window.localStorage,
  randomUuid = () => window.crypto?.randomUUID?.(),
  bindSocketDevice = setSocketE2EEDeviceId,
  assertConfiguration = assertE2eeV2QaConfiguration,
} = {}) {
  assertConfiguration({ enabled: true, backendUrl, runtimeBackendUrl });
  if (!user?.uid) throw new Error('v2_auth_required');

  const devices = await api.listDevices(user);
  const binding = createAndroidE2eeV2QaBinding({
    userId: user.uid,
    registeredDevices: devices,
    storage,
    randomUuid,
  });
  const registration = await registerDevice({
    user,
    ...binding,
    deviceLabel: 'Pulse Android E2EE QA',
    api,
  });
  bindSocketDevice(registration.deviceId);

  return Object.freeze({
    ...registration,
    api,
    async sendText({ conversationId, recipientUserId, plaintext, clientMessageId }) {
      return sendAndroidE2eeV2Text({
        user,
        localDeviceId: registration.deviceId,
        localSignalDeviceId: registration.signalDeviceId,
        conversationId,
        recipientUserId,
        plaintext,
        clientMessageId,
        api,
      });
    },
  });
}
