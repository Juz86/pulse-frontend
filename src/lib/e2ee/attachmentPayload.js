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
  const encryption = attachment.encryption && typeof attachment.encryption === 'object'
    ? {
        alg: typeof attachment.encryption.alg === 'string' ? attachment.encryption.alg : '',
        keyId: typeof attachment.encryption.keyId === 'string' ? attachment.encryption.keyId : '',
        iv: typeof attachment.encryption.iv === 'string' ? attachment.encryption.iv : '',
        sha256: typeof attachment.encryption.sha256 === 'string' ? attachment.encryption.sha256 : '',
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
    size: normalizedSize,
    caption: typeof attachment.caption === 'string' ? attachment.caption.trim() : '',
    encryption,
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
  return attachment?.mimeType?.startsWith('image/') || resolvedUrl?.startsWith('data:image/');
}

export function resolveAttachmentUrl(attachment) {
  if (!attachment) return '';
  return attachment.downloadUrl || attachment.url || attachment.thumbnailUrl || '';
}
