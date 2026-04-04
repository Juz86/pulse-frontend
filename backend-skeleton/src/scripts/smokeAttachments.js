const baseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3001';
const devUid = process.env.SMOKE_ATTACHMENT_UID || 'uid_child_1';

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
        url: 'data:text/plain;base64,SGVsbG8gYXR0YWNobWVudCBzbW9rZQ==',
        mimeType: 'text/plain',
        size: 21,
        caption: 'Smoke attachment',
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

  const downloadResponse = await fetch(attachmentUrl);
  const textBody = await downloadResponse.text();

  if (!downloadResponse.ok) {
    throw new Error(`download_failed:${downloadResponse.status}:${textBody}`);
  }

  console.log(JSON.stringify({
    ok: true,
    uploadStatus: uploadResponse.status,
    downloadStatus: downloadResponse.status,
    attachment: uploadData.attachment,
    body: textBody,
  }));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
