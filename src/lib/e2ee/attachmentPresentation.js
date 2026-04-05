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

export function getAttachmentAccessVerificationPresentation(attachmentOrContract = {}, unwrapContext = null) {
  const accessVerification = attachmentOrContract?.accessVerification || null;
  const contract = accessVerification
    ? {
        integrityVerified: Boolean(accessVerification.integrityVerified),
        wrappedKeyVerified: Boolean(accessVerification.wrappedKeyVerified),
      }
    : attachmentOrContract;
  const resolvedUnwrapKind = unwrapContext?.unwrapKind || accessVerification?.unwrapKind || '';
  const integrityVerified = Boolean(contract?.integrityVerified);
  const wrappedKeyVerified = Boolean(contract?.wrappedKeyVerified);
  const hasUnwrapContext = Boolean(resolvedUnwrapKind && resolvedUnwrapKind !== 'none');

  return {
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

export function getConversationAttachmentSummaryPresentation(conversation = {}) {
  const previewName = typeof conversation?.lastMessage === 'string' && conversation.lastMessage.startsWith('Bijlage: ')
    ? conversation.lastMessage.slice('Bijlage: '.length).split(' · ')[0].trim()
    : '';
  const attachment = {
    name: previewName || 'Bestand',
    transfer: conversation?.lastAttachmentTransfer || '',
    mimeType: conversation?.lastAttachmentOriginalMimeType || '',
    originalMimeType: conversation?.lastAttachmentOriginalMimeType || '',
    contentEncoding: conversation?.lastAttachmentEncoding || '',
    expectedPayloadSha256: conversation?.lastAttachmentExpectedPayloadSha256 || '',
  };
  const attachmentPresentation = getAttachmentContractPresentation(attachment);

  return {
    isAttachmentSummary: conversation?.lastMessageType === 'attachment',
    showRemoteAttachmentBadge: conversation?.lastMessageType === 'attachment' && attachmentPresentation.isRemote,
    previewText: getAttachmentPreviewText(attachment, { includeStorageSignal: true }),
    storageShortLabel: attachmentPresentation.storageShortLabel,
    mimeLabel: attachmentPresentation.mimeLabel,
  };
}
