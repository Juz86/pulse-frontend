const baseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3001';
const devUid = process.env.SMOKE_ATTACHMENT_UID || 'uid_child_1';
const envelopePayloadBase64 = Buffer.from('Hello attachment smoke', 'utf8').toString('base64');
const envelopeJsonBase64 = Buffer.from(JSON.stringify({
  version: 1,
  kind: 'pulse_mock_media_envelope',
  mimeType: 'text/plain',
  name: 'smoke-note.txt',
  size: 21,
  payloadBase64: envelopePayloadBase64,
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

  const downloadResponse = await fetch(attachmentUrl);
  const textBody = await downloadResponse.text();

  if (!downloadResponse.ok) {
    throw new Error(`download_failed:${downloadResponse.status}:${textBody}`);
  }

  console.log(JSON.stringify({
    ok: true,
    uploadStatus: uploadResponse.status,
    metadataStatus: metadataResponse.status,
    downloadStatus: downloadResponse.status,
    attachment: uploadData.attachment,
    metadata: metadataData.attachment,
    responseHeaders: {
      contentType: downloadResponse.headers.get('content-type'),
      originalMimeType: downloadResponse.headers.get('x-pulse-original-mimetype'),
      contentEncoding: downloadResponse.headers.get('x-pulse-content-encoding'),
      envelopeKind: downloadResponse.headers.get('x-pulse-envelope-kind'),
    },
    body: textBody,
  }));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
