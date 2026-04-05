import {
  ATTACHMENT_FUTURE_ENVELOPE_ALG,
  ATTACHMENT_FUTURE_MEDIA_STRATEGY,
  ATTACHMENT_MOCK_ENVELOPE_ALG,
  ATTACHMENT_MOCK_MEDIA_STRATEGY,
} from './attachmentStrategyConstants';

export function getAttachmentContractPresentation(attachment = {}) {
  const transfer = attachment?.transfer || null;
  const strategyKey = attachment?.strategyKey || attachment?.encryption?.strategyKey || '';
  const contentEncoding = attachment?.contentEncoding || '';
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

  return {
    isRemote,
    isEncryptedRemote,
    hasIntegrityContract,
    hasWrappedMediaKeyContract,
    mimeLabel: originalMimeType || 'Bestand gedeeld',
    storageLabel: isMockEncryptedRemote
      ? 'Mock versleutelde opslaglink'
      : isFutureEncryptedRemote
        ? 'Toekomstige versleutelde opslaglink'
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

export function getAttachmentPreviewText(attachment = {}, { includeStorageSignal = true } = {}) {
  const presentation = getAttachmentContractPresentation(attachment);
  const baseLabel = `Bijlage: ${attachment?.name || 'Bestand'}`;

  if (!includeStorageSignal || !presentation.storageShortLabel) {
    return baseLabel;
  }

  return `${baseLabel} · ${presentation.storageShortLabel}`;
}
