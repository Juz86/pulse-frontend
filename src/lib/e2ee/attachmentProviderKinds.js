import { ATTACHMENT_FUTURE_MEDIA_STRATEGY } from './attachmentStrategyConstants';

export const ATTACHMENT_STORAGE_PROVIDER_INLINE = 'inline';
export const ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK = 'remote_mock';
export const ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT = 'remote_mock_future_draft';

export const ATTACHMENT_ACCESS_PROVIDER_DIRECT = 'direct';
export const ATTACHMENT_ACCESS_PROVIDER_REMOTE = 'remote';
export const ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT = 'remote_future_draft';

export function getAttachmentStorageProviderKind(strategyKey = '') {
  return strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
    ? ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT
    : ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK;
}

export function getAttachmentAccessProviderKind(strategyKey = '') {
  return strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
    ? ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT
    : ATTACHMENT_ACCESS_PROVIDER_REMOTE;
}

export function resolveAttachmentStorageProviderKind({
  transportMode = 'inline',
  strategyKey = '',
} = {}) {
  if (transportMode === 'remote_mock') {
    return getAttachmentStorageProviderKind(strategyKey);
  }

  return ATTACHMENT_STORAGE_PROVIDER_INLINE;
}

export function resolveAttachmentAccessProviderKind({
  needsRemoteFetch = false,
  strategyKey = '',
} = {}) {
  if (needsRemoteFetch) {
    return getAttachmentAccessProviderKind(strategyKey);
  }

  return ATTACHMENT_ACCESS_PROVIDER_DIRECT;
}

export function buildAttachmentStorageProviderDescriptor(kind, strategyKey = '') {
  const resolvedKind = kind || getAttachmentStorageProviderKind(strategyKey);

  return {
    kind: resolvedKind,
    strategyKey,
    transportMode: resolvedKind === ATTACHMENT_STORAGE_PROVIDER_INLINE ? 'inline' : 'remote_mock',
    usesRemoteStorage: resolvedKind !== ATTACHMENT_STORAGE_PROVIDER_INLINE,
    isFutureDraft: resolvedKind === ATTACHMENT_STORAGE_PROVIDER_REMOTE_MOCK_FUTURE_DRAFT,
    supportsUpload: true,
  };
}

export function buildAttachmentAccessProviderDescriptor(kind, strategyKey = '') {
  const resolvedKind = kind || getAttachmentAccessProviderKind(strategyKey);

  return {
    kind: resolvedKind,
    strategyKey,
    usesRemoteFetch: resolvedKind !== ATTACHMENT_ACCESS_PROVIDER_DIRECT,
    isFutureDraft: resolvedKind === ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
    supportsBinaryAccess: resolvedKind !== ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT,
  };
}
