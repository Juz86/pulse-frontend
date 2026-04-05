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
  const isEncryptedRemote = isRemote && contentEncoding === 'mock-e2ee-envelope-v1';
  const hasIntegrityContract = Boolean(isEncryptedRemote && expectedPayloadSha256);
  const hasWrappedMediaKeyContract = Boolean(isEncryptedRemote && mediaKeyId && keyWrapAlg);

  return {
    isRemote,
    isEncryptedRemote,
    hasIntegrityContract,
    hasWrappedMediaKeyContract,
    mimeLabel: originalMimeType || 'Bestand gedeeld',
    storageLabel: isEncryptedRemote
      ? 'Mock versleutelde opslaglink'
      : isRemote
        ? 'Beveiligde opslaglink'
        : '',
    storageShortLabel: isEncryptedRemote
      ? 'versleuteld'
      : isRemote
        ? 'opslaglink'
        : '',
    storageDetail: isEncryptedRemote
      ? `Envelope: ${envelopeKind || 'mock media'}${strategyKey ? ` · strategie ${strategyKey}` : ''}${hasIntegrityContract ? ' · integriteitscheck actief' : ''}`
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

  return {
    strategyLabel: strategyKey ? `Media-strategie: ${strategyKey}` : '',
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
