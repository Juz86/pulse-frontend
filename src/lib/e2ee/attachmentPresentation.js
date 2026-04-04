export function getAttachmentContractPresentation(attachment = {}) {
  const transfer = attachment?.transfer || null;
  const contentEncoding = attachment?.contentEncoding || '';
  const originalMimeType = attachment?.originalMimeType || attachment?.mimeType || '';
  const envelopeKind = attachment?.envelopeKind || attachment?.encryption?.envelopeKind || '';
  const expectedPayloadSha256 = attachment?.expectedPayloadSha256 || attachment?.encryption?.sha256 || '';
  const isRemote = transfer === 'remote';
  const isEncryptedRemote = isRemote && contentEncoding === 'mock-e2ee-envelope-v1';
  const hasIntegrityContract = Boolean(isEncryptedRemote && expectedPayloadSha256);

  return {
    isRemote,
    isEncryptedRemote,
    hasIntegrityContract,
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
  };
}
