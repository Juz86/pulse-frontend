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

function base64ToBytes(base64 = '') {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function computeDigestHex(bytes) {
  const cryptoApi =
    (typeof window !== 'undefined' && window.crypto?.subtle && window.crypto)
    || null;

  if (cryptoApi?.subtle) {
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    return bytesToHex(new Uint8Array(digest));
  }

  let hash = 2166136261;
  bytes.forEach((byte) => {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  });
  return `fallback-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export async function createMockEncryptedAttachmentEnvelope(attachment) {
  const sourceUrl = attachment?.downloadUrl || attachment?.url || '';
  const parsed = parseDataUrl(sourceUrl);
  if (!parsed) {
    throw new Error('Geen bruikbare data-url beschikbaar voor mock media-encryptie.');
  }

  const originalMimeType = attachment?.mimeType || parsed.mimeType || 'application/octet-stream';
  const payloadSha256 = await computeDigestHex(base64ToBytes(parsed.base64));
  const envelope = {
    version: 1,
    kind: 'pulse_mock_media_envelope',
    mimeType: originalMimeType,
    name: attachment?.name || 'Bestand',
    size: Number.isFinite(attachment?.size) ? Number(attachment.size) : null,
    payloadBase64: parsed.base64,
    payloadSha256,
  };

  return {
    envelope,
    dataUrl: `data:application/pulse-e2ee-envelope+json;base64,${toBase64Utf8(JSON.stringify(envelope))}`,
  };
}

export async function verifyMockAttachmentEnvelope(envelope, expectedSha256 = '') {
  if (envelope?.kind !== 'pulse_mock_media_envelope' || typeof envelope?.payloadBase64 !== 'string') {
    throw new Error('Ongeldige mock media-envelope.');
  }

  const computedSha256 = await computeDigestHex(base64ToBytes(envelope.payloadBase64));
  if (envelope.payloadSha256 && envelope.payloadSha256 !== computedSha256) {
    throw new Error('Mock media-envelope integriteit mislukt.');
  }
  if (expectedSha256 && expectedSha256 !== computedSha256) {
    throw new Error('Attachment integriteit komt niet overeen met metadata.');
  }

  return {
    ...envelope,
    payloadSha256: envelope.payloadSha256 || computedSha256,
  };
}

export async function decryptMockAttachmentEnvelopeBlob(blob, expectedSha256 = '') {
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
  const verifiedEnvelope = await verifyMockAttachmentEnvelope(envelope, expectedSha256);

  const binary = base64ToBytes(verifiedEnvelope.payloadBase64);
  const mimeType = verifiedEnvelope.mimeType || 'application/octet-stream';

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
