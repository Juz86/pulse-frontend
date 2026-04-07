import { ATTACHMENT_FUTURE_MEDIA_STRATEGY } from './attachmentStrategyConstants';

export const ATTACHMENT_ACCESS_PROVIDER_DIRECT = 'direct';
export const ATTACHMENT_ACCESS_PROVIDER_REMOTE = 'remote';
export const ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT = 'remote_future_draft';

export function getAttachmentAccessProviderKind(strategyKey = '') {
  return strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
    ? ATTACHMENT_ACCESS_PROVIDER_REMOTE_FUTURE_DRAFT
    : ATTACHMENT_ACCESS_PROVIDER_REMOTE;
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
