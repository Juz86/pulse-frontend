import {
  ATTACHMENT_ACCESS_PROVIDER_DIRECT,
  ATTACHMENT_ACCESS_PROVIDER_REMOTE,
  ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
  ATTACHMENT_STORAGE_PROVIDER_INLINE,
  ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK,
  ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
  resolveAttachmentAccessProviderKind,
  resolveAttachmentStorageProviderKind,
} from './attachmentProviderKinds';

export function createAttachmentStorageProviderRegistry({
  createInlineProvider,
  createRemoteMockProvider,
}) {
  return {
    [ATTACHMENT_STORAGE_PROVIDER_INLINE]: () => createInlineProvider(),
    [ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK]: (options = {}) => createRemoteMockProvider(options),
    [ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT]: (options = {}) => createRemoteMockProvider(options),
  };
}

export function resolveAttachmentStorageProvider(registry, {
  transportMode = 'inline',
  strategyKey = '',
  ...options
} = {}) {
  const providerKind = resolveAttachmentStorageProviderKind({
    transportMode,
    strategyKey,
  });
  const providerFactory = registry?.[providerKind];

  if (typeof providerFactory !== 'function') {
    throw new Error(`Geen attachment storage provider geregistreerd voor ${providerKind}.`);
  }

  return providerFactory({
    strategyKey,
    ...options,
  });
}

export function createAttachmentAccessProviderRegistry({
  createDirectProvider,
  createRemoteProvider,
}) {
  return {
    [ATTACHMENT_ACCESS_PROVIDER_DIRECT]: () => createDirectProvider(),
    [ATTACHMENT_ACCESS_PROVIDER_REMOTE]: (options = {}) => createRemoteProvider(options),
    [ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT]: (options = {}) => createRemoteProvider(options),
  };
}

export function resolveAttachmentAccessProvider(registry, {
  needsRemoteFetch = false,
  strategyKey = '',
  ...options
} = {}) {
  const providerKind = resolveAttachmentAccessProviderKind({
    needsRemoteFetch,
    strategyKey,
  });
  const providerFactory = registry?.[providerKind];

  if (typeof providerFactory !== 'function') {
    throw new Error(`Geen attachment access provider geregistreerd voor ${providerKind}.`);
  }

  return providerFactory({
    strategyKey,
    ...options,
  });
}
