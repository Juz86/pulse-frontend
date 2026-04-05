import {
  ATTACHMENT_FUTURE_ENVELOPE_ALG,
  ATTACHMENT_FUTURE_MEDIA_STRATEGY,
  ATTACHMENT_MOCK_ENVELOPE_ALG,
  ATTACHMENT_MOCK_MEDIA_STRATEGY,
  getAttachmentStrategyHint,
  getAttachmentStrategyStoragePrefix,
} from './attachmentStrategyConstants';
import { getAttachmentEncryptionCapability } from './attachmentCrypto';
import { getAttachmentAccessInfo } from './attachmentAccessAdapter';

export function getAttachmentStrategyPresentation(attachment = {}) {
  const strategyKey =
    attachment?.strategyKey
    || attachment?.encryption?.strategyKey
    || (attachment?.contentEncoding === ATTACHMENT_FUTURE_ENVELOPE_ALG
      ? ATTACHMENT_FUTURE_MEDIA_STRATEGY
      : (attachment?.contentEncoding === ATTACHMENT_MOCK_ENVELOPE_ALG
        ? ATTACHMENT_MOCK_MEDIA_STRATEGY
        : ''));
  const isMockStrategy = strategyKey === ATTACHMENT_MOCK_MEDIA_STRATEGY;
  const isFutureStrategy = strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY;

  return {
    strategyKey,
    isMockStrategy,
    isFutureStrategy,
    strategyHintLabel: getAttachmentStrategyHint(strategyKey),
    storageLabelPrefix: getAttachmentStrategyStoragePrefix(strategyKey),
  };
}

export function getAttachmentContractPresentation(attachment = {}) {
  const transfer = attachment?.transfer || null;
  const strategyPresentation = getAttachmentStrategyPresentation(attachment);
  const strategyKey = strategyPresentation.strategyKey;
  const contentEncoding = attachment?.contentEncoding || '';
  const strategyCapability = getAttachmentEncryptionCapability({
    ...(attachment?.encryption || {}),
    strategyKey,
    alg: attachment?.encryption?.alg || contentEncoding || '',
  });
  const originalMimeType = attachment?.originalMimeType || attachment?.mimeType || '';
  const envelopeKind = attachment?.envelopeKind || attachment?.encryption?.envelopeKind || '';
  const expectedPayloadSha256 = attachment?.expectedPayloadSha256 || attachment?.encryption?.sha256 || '';
  const mediaKeyId = attachment?.encryption?.mediaKeyId || '';
  const keyWrapAlg = attachment?.encryption?.keyWrapAlg || '';
  const wrappedMediaKeyDigest = attachment?.encryption?.wrappedMediaKeyDigest || '';
  const isRemote = transfer === 'remote';
  const isMockEncryptedRemote =
    isRemote &&
    (
      strategyKey === ATTACHMENT_MOCK_MEDIA_STRATEGY ||
      contentEncoding === ATTACHMENT_MOCK_ENVELOPE_ALG
    );
  const isFutureEncryptedRemote =
    isRemote &&
    (
      strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY ||
      contentEncoding === ATTACHMENT_FUTURE_ENVELOPE_ALG
    );
  const isEncryptedRemote = isMockEncryptedRemote || isFutureEncryptedRemote;
  const hasIntegrityContract = Boolean(isEncryptedRemote && expectedPayloadSha256);
  const hasWrappedMediaKeyContract = Boolean(isEncryptedRemote && mediaKeyId && keyWrapAlg);
  const hasUnsupportedBinaryAccess = Boolean(
    isEncryptedRemote && !strategyCapability.binaryAccessSupported
  );
  const availabilityHintLabel = strategyCapability.requiresFutureStrategySupport
    ? 'binary access volgt later'
    : hasUnsupportedBinaryAccess
      ? 'clientondersteuning ontbreekt'
      : '';

  return {
    isRemote,
    isEncryptedRemote,
    hasIntegrityContract,
    hasWrappedMediaKeyContract,
    hasUnsupportedBinaryAccess,
    availabilityHintLabel,
    strategyHintLabel: strategyPresentation.strategyHintLabel,
    mimeLabel: originalMimeType || 'Bestand gedeeld',
    storageLabel: isMockEncryptedRemote
      ? `${strategyPresentation.storageLabelPrefix} versleutelde opslaglink`
      : isFutureEncryptedRemote
        ? `${strategyPresentation.storageLabelPrefix} versleutelde opslaglink`
        : isEncryptedRemote
          ? 'Versleutelde opslaglink'
          : isRemote
            ? 'Beveiligde opslaglink'
            : '',
    storageShortLabel: isEncryptedRemote
      ? 'versleuteld'
      : isRemote
        ? 'opslaglink'
        : '',
    storageDetail: isEncryptedRemote
      ? `Envelope: ${envelopeKind || 'encrypted media'}${strategyKey ? ` · strategie ${strategyKey}` : ''}${hasIntegrityContract ? ' · integriteitscheck actief' : ''}`
      : '',
    keyContractDetail: hasWrappedMediaKeyContract
      ? `Media key: ${mediaKeyId} · wrap: ${keyWrapAlg}${wrappedMediaKeyDigest ? ' · digest actief' : ''}`
      : '',
  };
}

export function getAttachmentAccessVerificationPresentation(attachmentOrContract = {}, unwrapContext = null) {
  const accessVerification = attachmentOrContract?.accessVerification || null;
  const contract = accessVerification
    ? {
        strategyKey: typeof accessVerification.strategyKey === 'string' ? accessVerification.strategyKey : '',
        integrityVerified: Boolean(accessVerification.integrityVerified),
        wrappedKeyVerified: Boolean(accessVerification.wrappedKeyVerified),
      }
    : attachmentOrContract;
  const strategyKey = typeof contract?.strategyKey === 'string' ? contract.strategyKey : '';
  const resolvedUnwrapKind = unwrapContext?.unwrapKind || accessVerification?.unwrapKind || '';
  const integrityVerified = Boolean(contract?.integrityVerified);
  const wrappedKeyVerified = Boolean(contract?.wrappedKeyVerified);
  const hasUnwrapContext = Boolean(resolvedUnwrapKind && resolvedUnwrapKind !== 'none');
  const futureAccessPending =
    strategyKey === ATTACHMENT_FUTURE_MEDIA_STRATEGY
    && !integrityVerified
    && !wrappedKeyVerified;

  return {
    strategyLabel: strategyKey ? `Media-strategie: ${strategyKey}` : '',
    availabilityLabel: futureAccessPending ? 'Decrypt-draft actief voor pulse_media_v1' : '',
    integrityAccessLabel: integrityVerified ? 'Downloadcontract bevestigd' : '',
    wrappedKeyAccessLabel: wrappedKeyVerified
      ? `Wrapped media key gevalideerd${hasUnwrapContext ? ` · ${resolvedUnwrapKind}` : ''}`
      : '',
  };
}

export function getAttachmentActionPresentation(accessInfo = {}) {
  const binaryAccessSupportLabel = accessInfo?.binaryAccessSupportLabel || '';
  const blockedByFutureDraft = binaryAccessSupportLabel === 'future_strategy_required';
  const blockedByUnsupportedStrategy = binaryAccessSupportLabel === 'unsupported';
  const actionsEnabled = Boolean(accessInfo?.canOpen) && !blockedByFutureDraft && !blockedByUnsupportedStrategy;

  return {
    actionsEnabled,
    openLabel: blockedByFutureDraft || blockedByUnsupportedStrategy ? 'Nog niet beschikbaar' : 'Openen',
    downloadLabel: 'Downloaden',
    availabilityDetail: blockedByFutureDraft
      ? 'Openen en downloaden worden actief zodra deze decrypt-strategie beschikbaar is.'
      : blockedByUnsupportedStrategy
        ? 'Deze versleutelingsstrategie ondersteunt nu nog geen openen of downloaden in de client.'
      : '',
  };
}

export function getAttachmentInteractionPresentation(attachment = {}, unwrapContext = null) {
  const access = getAttachmentAccessInfo(attachment);
  const contract = getAttachmentContractPresentation(attachment);
  const verification = getAttachmentAccessVerificationPresentation(attachment, unwrapContext);
  const actions = getAttachmentActionPresentation(access);

  return {
    access,
    contract,
    verification,
    actions,
  };
}

export function buildAttachmentInteractionState(
  messageAttachment = {},
  resolvedAttachment = null,
  resolvedAttachmentAccess = null
) {
  const attachment = resolvedAttachment || messageAttachment;
  const interaction = getAttachmentInteractionPresentation(
    attachment,
    resolvedAttachmentAccess?.unwrapContext
  );
  const previewUrl = interaction.access.isImage && attachment?.thumbnailUrl
    ? attachment.thumbnailUrl
    : interaction.access.url;

  return {
    attachment,
    interaction,
    access: interaction.access,
    contract: interaction.contract,
    verification: interaction.verification,
    actions: interaction.actions,
    previewUrl,
  };
}

export function getAttachmentPreviewText(attachment = {}, { includeStorageSignal = true } = {}) {
  const presentation = getAttachmentContractPresentation(attachment);
  const baseLabel = `Bijlage: ${attachment?.name || 'Bestand'}`;

  if (!includeStorageSignal || !presentation.storageShortLabel) {
    return baseLabel;
  }

  return `${baseLabel} · ${presentation.storageShortLabel}`;
}

export function getAttachmentStrategyHintLabel(attachment = {}) {
  return getAttachmentStrategyPresentation(attachment).strategyHintLabel;
}
