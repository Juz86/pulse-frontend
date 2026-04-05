export const MAX_E2EE_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export function normalizeAttachmentPayload(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;

  const normalizedSize = Number.isFinite(attachment.size)
    ? Math.max(0, Number(attachment.size))
    : null;

  const url = typeof attachment.url === 'string' ? attachment.url : '';
  const downloadUrl = typeof attachment.downloadUrl === 'string' ? attachment.downloadUrl : '';
  const thumbnailUrl = typeof attachment.thumbnailUrl === 'string' ? attachment.thumbnailUrl : '';
  const storageKey = typeof attachment.storageKey === 'string' ? attachment.storageKey : '';
  const originalMimeType = typeof attachment.originalMimeType === 'string' ? attachment.originalMimeType : '';
  const contentEncoding = typeof attachment.contentEncoding === 'string' ? attachment.contentEncoding : '';
  const envelopeKind = typeof attachment.envelopeKind === 'string' ? attachment.envelopeKind : '';
  const expectedPayloadSha256 = typeof attachment.expectedPayloadSha256 === 'string'
    ? attachment.expectedPayloadSha256
    : '';
  const encryption = attachment.encryption && typeof attachment.encryption === 'object'
    ? {
        alg: typeof attachment.encryption.alg === 'string' ? attachment.encryption.alg : '',
        strategyKey: typeof attachment.encryption.strategyKey === 'string' ? attachment.encryption.strategyKey : '',
        keyId: typeof attachment.encryption.keyId === 'string' ? attachment.encryption.keyId : '',
        iv: typeof attachment.encryption.iv === 'string' ? attachment.encryption.iv : '',
        sha256: typeof attachment.encryption.sha256 === 'string' ? attachment.encryption.sha256 : '',
        mediaKeyId: typeof attachment.encryption.mediaKeyId === 'string' ? attachment.encryption.mediaKeyId : '',
        keyWrapAlg: typeof attachment.encryption.keyWrapAlg === 'string' ? attachment.encryption.keyWrapAlg : '',
        wrappedMediaKey: typeof attachment.encryption.wrappedMediaKey === 'string' ? attachment.encryption.wrappedMediaKey : '',
        wrappedMediaKeyDigest: typeof attachment.encryption.wrappedMediaKeyDigest === 'string' ? attachment.encryption.wrappedMediaKeyDigest : '',
        envelopeKind: typeof attachment.encryption.envelopeKind === 'string' ? attachment.encryption.envelopeKind : '',
        originalMimeType: typeof attachment.encryption.originalMimeType === 'string' ? attachment.encryption.originalMimeType : '',
      }
    : null;
  const accessVerification = attachment.accessVerification && typeof attachment.accessVerification === 'object'
    ? {
        strategyKey: typeof attachment.accessVerification.strategyKey === 'string'
          ? attachment.accessVerification.strategyKey
          : '',
        integrityVerified: Boolean(attachment.accessVerification.integrityVerified),
        wrappedKeyVerified: Boolean(attachment.accessVerification.wrappedKeyVerified),
        unwrapKind: typeof attachment.accessVerification.unwrapKind === 'string'
          ? attachment.accessVerification.unwrapKind
          : '',
      }
    : null;

  return {
    name: typeof attachment.name === 'string' && attachment.name.trim()
      ? attachment.name.trim()
      : 'Bestand',
    url,
    downloadUrl,
    thumbnailUrl,
    storageKey,
    transfer: attachment.transfer === 'remote' || (!attachment.transfer && (!url.startsWith('data:') && (downloadUrl || storageKey)))
      ? 'remote'
      : 'inline',
    mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : '',
    originalMimeType,
    contentEncoding,
    envelopeKind,
    expectedPayloadSha256,
    size: normalizedSize,
    caption: typeof attachment.caption === 'string' ? attachment.caption.trim() : '',
    encryption,
    accessVerification,
  };
}

export function validateAttachmentPayload(attachment) {
  if (!attachment) return 'Geen bijlage beschikbaar.';
  if (!resolveAttachmentUrl(attachment) && !attachment.storageKey) {
    return 'Bijlage bevat geen bruikbare bestandslink.';
  }
  if (attachment.size && attachment.size > MAX_E2EE_ATTACHMENT_BYTES) {
    return 'Bijlagen mogen lokaal maximaal 2 MB zijn in deze testfase.';
  }
  return null;
}

export function isImageAttachment(attachment) {
  const resolvedUrl = resolveAttachmentUrl(attachment);
  if (!resolvedUrl) return false;
  return (
    attachment?.originalMimeType?.startsWith('image/')
    || attachment?.mimeType?.startsWith('image/')
    || resolvedUrl?.startsWith('data:image/')
  );
}

export function resolveAttachmentUrl(attachment) {
  if (!attachment) return '';
  return attachment.downloadUrl || attachment.url || attachment.thumbnailUrl || '';
}
