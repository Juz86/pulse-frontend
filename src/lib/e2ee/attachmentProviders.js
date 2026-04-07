import {
  ATTACHMENT_ACCESS_PROVIDER_DIRECT,
  ATTACHMENT_ACCESS_PROVIDER_REMOTE,
  ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
  buildAttachmentAccessProviderDescriptor,
  resolveAttachmentAccessProviderKind,
} from './attachmentProviderKinds';

export function createAttachmentAccessProviderRegistry({
  createDirectProvider,
  createRemoteProvider,
  createFutureDraftProvider = createRemoteProvider,
}) {
  return {
    [ATTACHMENT_ACCESS_PROVIDER_DIRECT]: () => createDirectProvider(),
    [ATTACHMENT_ACCESS_PROVIDER_REMOTE]: (options = {}) => createRemoteProvider(options),
    [ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT]: (options = {}) => createFutureDraftProvider(options),
  };
}

export function resolveAttachmentAccessProvider(registry, {
  needsRemoteFetch = false,
  strategyKey = '',
  ...options
} = {}) {
  const { factory } = resolveAttachmentAccessProviderEntry(registry, {
    needsRemoteFetch,
    strategyKey,
  });

  return factory({
    strategyKey,
    ...options,
  });
}

export function resolveAttachmentAccessProviderEntry(registry, {
  needsRemoteFetch = false,
  strategyKey = '',
} = {}) {
  const providerKind = resolveAttachmentAccessProviderKind({
    needsRemoteFetch,
    strategyKey,
  });
  const providerFactory = registry?.[providerKind];

  if (typeof providerFactory !== 'function') {
    throw new Error(`Geen attachment access provider geregistreerd voor ${providerKind}.`);
  }

  return {
    kind: providerKind,
    descriptor: buildAttachmentAccessProviderDescriptor(providerKind, strategyKey),
    factory: providerFactory,
  };
}
