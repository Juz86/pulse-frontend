import { getAttachmentStrategyDisplayName } from './attachmentStrategyConstants';
import { getDefaultAttachmentProviderRuntimeState } from './attachmentDefaultProviders';

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
  return getAttachmentStrategyRuntimeState({ preferredStrategy, capabilities }).effectiveStrategy;
}

export function getAttachmentStrategyRuntimeState({
  preferredStrategy = E2EE_ATTACHMENT_STRATEGY,
  capabilities = null,
  effectiveStrategyOverride = null,
} = {}) {
  const normalized = normalizeE2EEBackendCapabilities(capabilities);
  const fallbackStrategy = normalized.defaultAttachmentStrategy || 'mock_media_v1';
  const preferred = preferredStrategy || fallbackStrategy;
  let effectiveStrategy = effectiveStrategyOverride || 'mock_media_v1';

  if (effectiveStrategyOverride) {
    effectiveStrategy = effectiveStrategyOverride;
  } else if (!preferredStrategy) {
    effectiveStrategy = fallbackStrategy;
  } else if (isAttachmentStrategySupportedByBackend(normalized, preferred)) {
    effectiveStrategy = preferred;
  } else if (isAttachmentStrategySupportedByBackend(normalized, fallbackStrategy)) {
    effectiveStrategy = fallbackStrategy;
  }
  const fallbackActive = preferred !== effectiveStrategy;
  const preferredStrategySupported = isAttachmentStrategySupportedByBackend(normalized, preferred);

  return {
    preferredStrategy: preferred,
    effectiveStrategy,
    fallbackStrategy,
    fallbackActive,
    preferredStrategySupported,
    capabilities: normalized,
  };
}

export function getAttachmentRuntimeState({
  preferredStrategy = E2EE_ATTACHMENT_STRATEGY,
  capabilities = null,
  effectiveStrategyOverride = null,
  attachmentTransport = E2EE_ATTACHMENT_TRANSPORT,
  needsRemoteFetch = false,
} = {}) {
  const strategyRuntime = getAttachmentStrategyRuntimeState({
    preferredStrategy,
    capabilities,
    effectiveStrategyOverride,
  });
  const providerRuntime = getDefaultAttachmentProviderRuntimeState({
    transportMode: attachmentTransport,
    strategyKey: strategyRuntime.effectiveStrategy,
    needsRemoteFetch,
  });

  return {
    ...strategyRuntime,
    providerRuntime,
  };
}

export function getAttachmentStrategyRuntimeCopy({
  preferredStrategy = E2EE_ATTACHMENT_STRATEGY,
  capabilities = null,
  effectiveStrategyOverride = null,
} = {}) {
  const runtimeState = getAttachmentStrategyRuntimeState({
    preferredStrategy,
    capabilities,
    effectiveStrategyOverride,
  });
  const { preferredStrategy: preferred, effectiveStrategy, fallbackActive } = runtimeState;

  if (fallbackActive) {
    return {
      tone: 'fallback',
      text: `Bijlagen gebruiken nu de remote mock-opslagtest met fallbackprofiel ${getAttachmentStrategyDisplayName(effectiveStrategy)}. Backendondersteuning voor ${getAttachmentStrategyDisplayName(preferred)} ontbreekt nog.`,
    };
  }

  if (effectiveStrategy === 'pulse_media_v1') {
    return {
      tone: runtimeState.preferredStrategySupported ? 'future' : 'draft',
      text: `Bijlagen gebruiken nu de remote mock-opslagtest met draftprofiel ${getAttachmentStrategyDisplayName(effectiveStrategy)}.`,
    };
  }

  return {
    tone: 'default',
    text: `Bijlagen gebruiken nu de remote mock-opslagtest met profiel ${getAttachmentStrategyDisplayName(effectiveStrategy)}.`,
  };
}

export function getFutureAttachmentStrategyBannerCopy({
  preferredStrategy = E2EE_ATTACHMENT_STRATEGY,
  capabilities = null,
  effectiveStrategyOverride = null,
} = {}) {
  const runtimeState = getAttachmentStrategyRuntimeState({
    preferredStrategy,
    capabilities,
    effectiveStrategyOverride,
  });

  if (!runtimeState.fallbackActive) {
    return {
      tone: 'future',
      text: `Pulse test nu het toekomstige attachment-profiel ${getAttachmentStrategyDisplayName(runtimeState.effectiveStrategy)} via de remote mock-opslagflow.`,
    };
  }

  return {
    tone: 'fallback',
    text: `Het attachment-profiel ${getAttachmentStrategyDisplayName(runtimeState.preferredStrategy)} staat lokaal aan, maar deze backend adverteert die draftondersteuning nog niet via /configz. Pulse valt daarom nu terug op ${getAttachmentStrategyDisplayName(runtimeState.effectiveStrategy)}.`,
  };
}

export function getFutureAttachmentStrategyBannerState({
  preferredStrategy = E2EE_ATTACHMENT_STRATEGY,
  capabilities = null,
  effectiveStrategyOverride = null,
  showFutureMediaBanner = false,
  attachmentTransport = E2EE_ATTACHMENT_TRANSPORT,
} = {}) {
  const visible = Boolean(
    attachmentTransport === 'remote_mock'
    && showFutureMediaBanner
    && preferredStrategy === 'pulse_media_v1'
  );

  return {
    visible,
    ...getFutureAttachmentStrategyBannerCopy({
      preferredStrategy,
      capabilities,
      effectiveStrategyOverride,
    }),
  };
}

export function getServiceTransportFallbackBannerState({
  transport = E2EE_TRANSPORT,
  serviceTransportReady = true,
} = {}) {
  const visible = Boolean(transport === 'service' && !serviceTransportReady);

  return {
    visible,
    tone: 'fallback',
    text: 'Serviceversleuteling is tijdelijk niet beschikbaar. Pulse gebruikt nu automatisch socketfallback.',
  };
}

export function getAttachmentStrategyComposerHintState({
  preferredStrategy = E2EE_ATTACHMENT_STRATEGY,
  capabilities = null,
  effectiveStrategyOverride = null,
  attachmentTransport = E2EE_ATTACHMENT_TRANSPORT,
  paused = false,
  attachmentStatus = '',
} = {}) {
  const runtimeCopy = getAttachmentStrategyRuntimeCopy({
    preferredStrategy,
    capabilities,
    effectiveStrategyOverride,
  });

  return {
    visible: Boolean(!paused && !attachmentStatus && attachmentTransport === 'remote_mock'),
    ...runtimeCopy,
  };
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
