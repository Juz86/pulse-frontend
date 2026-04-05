import crypto from 'crypto';
const baseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3001';
const devUid = process.env.SMOKE_ATTACHMENT_UID || 'uid_child_1';
const envelopePayloadBase64 = Buffer.from('Hello attachment smoke', 'utf8').toString('base64');
const envelopePayloadSha256 = crypto.createHash('sha256').update('Hello attachment smoke', 'utf8').digest('hex');
const envelopeJsonBase64 = Buffer.from(JSON.stringify({
  version: 1,
  kind: 'pulse_mock_media_envelope',
  mimeType: 'text/plain',
  name: 'smoke-note.txt',
  size: 21,
  payloadBase64: envelopePayloadBase64,
  payloadSha256: envelopePayloadSha256,
}), 'utf8').toString('base64');

async function main() {
  const uploadResponse = await fetch(`${baseUrl}/api/attachments/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dev-uid': devUid,
    },
    body: JSON.stringify({
      attachment: {
        name: 'smoke-note.txt',
        url: `data:application/pulse-e2ee-envelope+json;base64,${envelopeJsonBase64}`,
        mimeType: 'text/plain',
        size: 21,
        caption: 'Smoke attachment',
        encryption: {
          alg: 'mock-e2ee-envelope-v1',
          envelopeKind: 'pulse_mock_media_envelope',
          originalMimeType: 'text/plain',
          sha256: envelopePayloadSha256,
          mediaKeyId: 'mock-media-key-smoke',
          keyWrapAlg: 'pulse_mock_media_key_wrap_v1',
          wrappedMediaKey: 'eyJzbW9rZSI6dHJ1ZX0=',
          wrappedMediaKeyDigest: 'wrapped-digest-smoke',
        },
      },
    }),
  });

  const uploadData = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(`upload_failed:${uploadResponse.status}:${JSON.stringify(uploadData)}`);
  }

  const attachmentUrl = uploadData?.attachment?.downloadUrl;
  if (!attachmentUrl) {
    throw new Error('missing_download_url');
  }

  const metadataResponse = await fetch(`${baseUrl}/api/attachments/${attachmentUrl.split('/').pop()}/meta`, {
    headers: {
      'x-dev-uid': devUid,
    },
  });
  const metadataData = await metadataResponse.json().catch(() => ({}));

  if (!metadataResponse.ok) {
    throw new Error(`metadata_failed:${metadataResponse.status}:${JSON.stringify(metadataData)}`);
  }

  const metadataHeaders = {
    strategyKey: metadataResponse.headers.get('x-pulse-encryption-strategy'),
    originalMimeType: metadataResponse.headers.get('x-pulse-original-mimetype'),
    contentEncoding: metadataResponse.headers.get('x-pulse-content-encoding'),
    envelopeKind: metadataResponse.headers.get('x-pulse-envelope-kind'),
    expectedSha256: metadataResponse.headers.get('x-pulse-expected-sha256'),
    mediaKeyId: metadataResponse.headers.get('x-pulse-media-key-id'),
    keyWrapAlg: metadataResponse.headers.get('x-pulse-key-wrap-alg'),
    wrappedMediaKeyDigest: metadataResponse.headers.get('x-pulse-wrapped-media-key-digest'),
  };

  if (metadataHeaders.strategyKey !== 'mock_media_v1') {
    throw new Error(`metadata_header_strategy_mismatch:${metadataHeaders.strategyKey || ''}`);
  }
  if (metadataHeaders.originalMimeType !== 'text/plain') {
    throw new Error(`metadata_header_original_mimetype_mismatch:${metadataHeaders.originalMimeType || ''}`);
  }
  if (metadataHeaders.contentEncoding !== 'mock-e2ee-envelope-v1') {
    throw new Error(`metadata_header_content_encoding_mismatch:${metadataHeaders.contentEncoding || ''}`);
  }
  if (metadataHeaders.envelopeKind !== 'pulse_mock_media_envelope') {
    throw new Error(`metadata_header_envelope_kind_mismatch:${metadataHeaders.envelopeKind || ''}`);
  }
  if (metadataHeaders.expectedSha256 !== envelopePayloadSha256) {
    throw new Error(`metadata_header_sha_mismatch:${metadataHeaders.expectedSha256 || ''}`);
  }
  if (metadataHeaders.mediaKeyId !== 'mock-media-key-smoke') {
    throw new Error(`metadata_header_media_key_id_mismatch:${metadataHeaders.mediaKeyId || ''}`);
  }
  if (metadataHeaders.keyWrapAlg !== 'pulse_mock_media_key_wrap_v1') {
    throw new Error(`metadata_header_key_wrap_alg_mismatch:${metadataHeaders.keyWrapAlg || ''}`);
  }
  if (metadataHeaders.wrappedMediaKeyDigest !== 'wrapped-digest-smoke') {
    throw new Error(`metadata_header_wrapped_key_digest_mismatch:${metadataHeaders.wrappedMediaKeyDigest || ''}`);
  }

  const downloadResponse = await fetch(attachmentUrl);
  const textBody = await downloadResponse.text();

  if (!downloadResponse.ok) {
    throw new Error(`download_failed:${downloadResponse.status}:${textBody}`);
  }

  const responseHeaders = {
    strategyKey: downloadResponse.headers.get('x-pulse-encryption-strategy'),
    contentType: downloadResponse.headers.get('content-type'),
    originalMimeType: downloadResponse.headers.get('x-pulse-original-mimetype'),
    contentEncoding: downloadResponse.headers.get('x-pulse-content-encoding'),
    envelopeKind: downloadResponse.headers.get('x-pulse-envelope-kind'),
    expectedSha256: downloadResponse.headers.get('x-pulse-expected-sha256'),
    mediaKeyId: downloadResponse.headers.get('x-pulse-media-key-id'),
    keyWrapAlg: downloadResponse.headers.get('x-pulse-key-wrap-alg'),
    wrappedMediaKeyDigest: downloadResponse.headers.get('x-pulse-wrapped-media-key-digest'),
  };

  if (responseHeaders.strategyKey !== 'mock_media_v1') {
    throw new Error(`download_header_strategy_mismatch:${responseHeaders.strategyKey || ''}`);
  }
  if (responseHeaders.mediaKeyId !== 'mock-media-key-smoke') {
    throw new Error(`download_header_media_key_id_mismatch:${responseHeaders.mediaKeyId || ''}`);
  }
  if (responseHeaders.keyWrapAlg !== 'pulse_mock_media_key_wrap_v1') {
    throw new Error(`download_header_key_wrap_alg_mismatch:${responseHeaders.keyWrapAlg || ''}`);
  }
  if (responseHeaders.wrappedMediaKeyDigest !== 'wrapped-digest-smoke') {
    throw new Error(`download_header_wrapped_key_digest_mismatch:${responseHeaders.wrappedMediaKeyDigest || ''}`);
  }

  console.log(JSON.stringify({
    ok: true,
    uploadStatus: uploadResponse.status,
    metadataStatus: metadataResponse.status,
    downloadStatus: downloadResponse.status,
    attachment: uploadData.attachment,
    metadata: metadataData.attachment,
    metadataHeaders,
    responseHeaders,
    body: textBody,
  }));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
