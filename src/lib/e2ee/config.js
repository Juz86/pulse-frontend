export const E2EE_MODE = process.env.REACT_APP_E2EE_MODE || 'mock';
export const E2EE_TRANSPORT = process.env.REACT_APP_E2EE_TRANSPORT || 'socket';
export const E2EE_ATTACHMENT_TRANSPORT = process.env.REACT_APP_E2EE_ATTACHMENT_TRANSPORT || 'inline';
export const E2EE_ATTACHMENT_STRATEGY = process.env.REACT_APP_E2EE_ATTACHMENT_STRATEGY || 'mock_media_v1';

export const isE2EEServiceTransportEnabled = E2EE_TRANSPORT === 'service';
export const isRemoteMockAttachmentTransportEnabled = E2EE_ATTACHMENT_TRANSPORT === 'remote_mock';
export const isFutureAttachmentStrategyEnabled = E2EE_ATTACHMENT_STRATEGY === 'pulse_media_v1';
export const shouldBootstrapE2EEDevice = isE2EEServiceTransportEnabled || E2EE_MODE === 'signal';

export function normalizeE2EEBackendCapabilities(payload = {}) {
  const e2ee = payload?.e2ee && typeof payload.e2ee === 'object' ? payload.e2ee : payload;
  const attachmentStrategies = Array.isArray(e2ee?.attachmentStrategies)
    ? e2ee.attachmentStrategies.filter((value) => typeof value === 'string' && value)
    : [];

  return {
    attachmentTransport: typeof e2ee?.attachmentTransport === 'string' ? e2ee.attachmentTransport : '',
    attachmentStrategies,
    defaultAttachmentStrategy: typeof e2ee?.defaultAttachmentStrategy === 'string'
      ? e2ee.defaultAttachmentStrategy
      : 'mock_media_v1',
    draftAttachmentStrategy: typeof e2ee?.draftAttachmentStrategy === 'string'
      ? e2ee.draftAttachmentStrategy
      : 'pulse_media_v1',
  };
}

export function isAttachmentStrategySupportedByBackend(capabilities, strategyKey) {
  if (!strategyKey) return false;
  const normalized = normalizeE2EEBackendCapabilities(capabilities);
  return normalized.attachmentStrategies.includes(strategyKey);
}

export function resolveEffectiveAttachmentStrategy({
  preferredStrategy = E2EE_ATTACHMENT_STRATEGY,
  capabilities = null,
} = {}) {
  const normalized = normalizeE2EEBackendCapabilities(capabilities);
  const fallbackStrategy = normalized.defaultAttachmentStrategy || 'mock_media_v1';

  if (!preferredStrategy) {
    return fallbackStrategy;
  }

  if (isAttachmentStrategySupportedByBackend(normalized, preferredStrategy)) {
    return preferredStrategy;
  }

  if (isAttachmentStrategySupportedByBackend(normalized, fallbackStrategy)) {
    return fallbackStrategy;
  }

  return 'mock_media_v1';
}

export async function probeE2EEServiceReady(baseUrl) {
  if (!isE2EEServiceTransportEnabled || !baseUrl) return false;

  try {
    const response = await fetch(`${baseUrl}/readyz`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) return false;
    const data = await response.json();
    return !!data?.ok;
  } catch {
    return false;
  }
}

export async function probeE2EEBackendCapabilities(baseUrl) {
  if (!baseUrl) {
    return normalizeE2EEBackendCapabilities();
  }

  try {
    const response = await fetch(`${baseUrl}/configz`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return normalizeE2EEBackendCapabilities();
    }

    const data = await response.json().catch(() => ({}));
    return normalizeE2EEBackendCapabilities(data);
  } catch {
    return normalizeE2EEBackendCapabilities();
  }
}
