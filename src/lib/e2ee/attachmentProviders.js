import {
  ATTACHMENT_ACCESS_PROVIDER_DIRECT,
  ATTACHMENT_ACCESS_PROVIDER_REMOTE,
  ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
  ATTACHMENT_STORAGE_PROVIDER_INLINE,
  ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK,
  ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
  buildAttachmentAccessProviderDescriptor,
  buildAttachmentStorageProviderDescriptor,
  resolveAttachmentAccessProviderKind,
  resolveAttachmentStorageProviderKind,
} from './attachmentProviderKinds';

export function createAttachmentStorageProviderRegistry({
  createInlineProvider,
  createRemoteMockProvider,
  createFutureDraftProvider = createRemoteMockProvider,
}) {
  return {
    [ATTACHMENT_STORAGE_PROVIDER_INLINE]: () => createInlineProvider(),
    [ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK]: (options = {}) => createRemoteMockProvider(options),
    [ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT]: (options = {}) => createFutureDraftProvider(options),
  };
}

export function resolveAttachmentStorageProvider(registry, {
  transportMode = 'inline',
  strategyKey = '',
  ...options
} = {}) {
  const { factory } = resolveAttachmentStorageProviderEntry(registry, {
    transportMode,
    strategyKey,
  });

  return factory({
    strategyKey,
    ...options,
  });
}

export function resolveAttachmentStorageProviderEntry(registry, {
  transportMode = 'inline',
  strategyKey = '',
} = {}) {
  const providerKind = resolveAttachmentStorageProviderKind({
    transportMode,
    strategyKey,
  });
  const providerFactory = registry?.[providerKind];

  if (typeof providerFactory !== 'function') {
    throw new Error(`Geen attachment storage provider geregistreerd voor ${providerKind}.`);
  }

  return {
    kind: providerKind,
    descriptor: buildAttachmentStorageProviderDescriptor(providerKind, strategyKey),
    factory: providerFactory,
  };
}

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

export function getAttachmentProviderRuntimeState({
  storageRegistry = null,
  accessRegistry = null,
  transportMode = 'inline',
  strategyKey = '',
  needsRemoteFetch = false,
} = {}) {
  const storageEntry = storageRegistry
    ? resolveAttachmentStorageProviderEntry(storageRegistry, {
      transportMode,
      strategyKey,
    })
    : null;
  const accessEntry = accessRegistry
    ? resolveAttachmentAccessProviderEntry(accessRegistry, {
      needsRemoteFetch,
      strategyKey,
    })
    : null;

  return {
    strategyKey,
    transportMode,
    needsRemoteFetch,
    storageProviderKind: storageEntry?.kind || '',
    accessProviderKind: accessEntry?.kind || '',
    storageDescriptor: storageEntry?.descriptor || null,
    accessDescriptor: accessEntry?.descriptor || null,
    usesRemoteStorage: Boolean(storageEntry?.descriptor?.usesRemoteStorage),
    usesRemoteFetch: Boolean(accessEntry?.descriptor?.usesRemoteFetch),
    isFutureDraft: Boolean(
      storageEntry?.descriptor?.isFutureDraft
      || accessEntry?.descriptor?.isFutureDraft
    ),
    supportsBinaryAccess: accessEntry?.descriptor?.supportsBinaryAccess ?? true,
  };
}
