export function getAttachmentContractPresentation(attachment = {}) {
  const transfer = attachment?.transfer || null;
  const contentEncoding = attachment?.contentEncoding || '';
  const originalMimeType = attachment?.originalMimeType || attachment?.mimeType || '';
  const envelopeKind = attachment?.envelopeKind || attachment?.encryption?.envelopeKind || '';
  const expectedPayloadSha256 = attachment?.expectedPayloadSha256 || attachment?.encryption?.sha256 || '';
  const mediaKeyId = attachment?.encryption?.mediaKeyId || '';
  const keyWrapAlg = attachment?.encryption?.keyWrapAlg || '';
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
      ? `Envelope: ${envelopeKind || 'mock media'}${hasIntegrityContract ? ' · integriteitscheck actief' : ''}`
      : '',
    keyContractDetail: hasWrappedMediaKeyContract
      ? `Media key: ${mediaKeyId} · wrap: ${keyWrapAlg}`
      : '',
  };
}

export function getAttachmentAccessVerificationPresentation(contract = {}, unwrapContext = null) {
  const integrityVerified = Boolean(contract?.integrityVerified);
  const wrappedKeyVerified = Boolean(contract?.wrappedKeyVerified);
  const hasUnwrapContext = Boolean(unwrapContext?.unwrapKind && unwrapContext.unwrapKind !== 'none');

  return {
    integrityAccessLabel: integrityVerified ? 'Downloadcontract bevestigd' : '',
    wrappedKeyAccessLabel: wrappedKeyVerified
      ? `Wrapped media key gevalideerd${hasUnwrapContext ? ` · ${unwrapContext.unwrapKind}` : ''}`
      : '',
  };
}
