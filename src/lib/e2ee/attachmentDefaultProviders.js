import { E2EE_ATTACHMENT_STRATEGY, E2EE_ATTACHMENT_TRANSPORT } from './attachmentConfig';
import { createDefaultAttachmentAccessProviderRegistry } from './attachmentAccessAdapter';
import { createDefaultAttachmentStorageProviderRegistry } from './attachmentUploadAdapter';
import { getAttachmentProviderRuntimeState } from './attachmentProviders';

export function createDefaultAttachmentProviderRegistries() {
  return {
    storageRegistry: createDefaultAttachmentStorageProviderRegistry(),
    accessRegistry: createDefaultAttachmentAccessProviderRegistry(),
  };
}

export function getDefaultAttachmentProviderRuntimeState({
  transportMode = E2EE_ATTACHMENT_TRANSPORT,
  strategyKey = E2EE_ATTACHMENT_STRATEGY,
  needsRemoteFetch = false,
} = {}) {
  const { storageRegistry, accessRegistry } = createDefaultAttachmentProviderRegistries();

  return getAttachmentProviderRuntimeState({
    storageRegistry,
    accessRegistry,
    transportMode,
    strategyKey,
    needsRemoteFetch,
  });
}
