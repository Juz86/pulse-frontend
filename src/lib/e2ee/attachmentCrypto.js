function toBase64Utf8(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function fromBase64Utf8(value) {
  return decodeURIComponent(escape(atob(value)));
}

function parseDataUrl(dataUrl = '') {
  const match = String(dataUrl).match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1] || 'application/octet-stream',
    base64: match[2],
  };
}

export function createMockEncryptedAttachmentEnvelope(attachment) {
  const sourceUrl = attachment?.downloadUrl || attachment?.url || '';
  const parsed = parseDataUrl(sourceUrl);
  if (!parsed) {
    throw new Error('Geen bruikbare data-url beschikbaar voor mock media-encryptie.');
  }

  const originalMimeType = attachment?.mimeType || parsed.mimeType || 'application/octet-stream';
  const envelope = {
    version: 1,
    kind: 'pulse_mock_media_envelope',
    mimeType: originalMimeType,
    name: attachment?.name || 'Bestand',
    size: Number.isFinite(attachment?.size) ? Number(attachment.size) : null,
    payloadBase64: parsed.base64,
  };

  return {
    envelope,
    dataUrl: `data:application/pulse-e2ee-envelope+json;base64,${toBase64Utf8(JSON.stringify(envelope))}`,
  };
}

export async function decryptMockAttachmentEnvelopeBlob(blob) {
  let envelopeText = '';

  if (typeof blob?.text === 'function') {
    envelopeText = await blob.text();
  } else if (typeof blob?.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();
    envelopeText = new TextDecoder().decode(buffer);
  } else {
    envelopeText = await new Response(blob).text();
  }

  const envelope = JSON.parse(envelopeText || '{}');

  if (envelope?.kind !== 'pulse_mock_media_envelope' || typeof envelope?.payloadBase64 !== 'string') {
    throw new Error('Ongeldige mock media-envelope.');
  }

  const binary = Uint8Array.from(atob(envelope.payloadBase64), (char) => char.charCodeAt(0));
  const mimeType = envelope.mimeType || 'application/octet-stream';

  return new Blob([binary], { type: mimeType });
}

export function decodeMockAttachmentEnvelopeDataUrl(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  try {
    return JSON.parse(fromBase64Utf8(parsed.base64));
  } catch {
    return null;
  }
}
