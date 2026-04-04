import { isImageAttachment, resolveAttachmentUrl } from './attachmentPayload';

export function getAttachmentAccessInfo(attachment) {
  const resolvedUrl = resolveAttachmentUrl(attachment);

  return {
    url: resolvedUrl,
    canOpen: !!resolvedUrl,
    canDownload: !!resolvedUrl,
    isImage: isImageAttachment(attachment),
    needsRemoteFetch: attachment?.transfer === 'remote' && !!attachment?.encryption,
  };
}

export function openAttachmentInNewTab(attachment, opener = window.open) {
  const { url } = getAttachmentAccessInfo(attachment);
  if (!url) return false;
  opener(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function triggerAttachmentDownload(attachment, doc = document) {
  const { url } = getAttachmentAccessInfo(attachment);
  if (!url) return false;

  const link = doc.createElement('a');
  link.href = url;
  link.download = attachment?.name || 'bijlage';
  link.rel = 'noopener noreferrer';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}
