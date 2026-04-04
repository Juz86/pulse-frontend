import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getStoredAttachment,
  getStoredAttachmentMetadata,
  storeMockAttachment,
} from '../services/attachmentStorage.js';

export const attachmentsRouter = Router();

attachmentsRouter.post('/upload', requireAuth, asyncRoute(async (req, res) => {
  const { attachment } = req.body || {};

  if (!attachment || typeof attachment !== 'object') {
    return res.status(400).json({ error: 'invalid_attachment_payload' });
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const storedAttachment = await storeMockAttachment({
    attachment,
    baseUrl,
  });

  return res.json({
    ok: true,
    attachment: storedAttachment,
  });
}));

attachmentsRouter.get('/:attachmentId/meta', requireAuth, asyncRoute(async (req, res) => {
  const metadata = await getStoredAttachmentMetadata(req.params.attachmentId);

  if (!metadata) {
    return res.status(404).json({ error: 'attachment_not_found' });
  }

  return res.json({
    ok: true,
    attachment: metadata,
  });
}));

attachmentsRouter.get('/:attachmentId', asyncRoute(async (req, res) => {
  const storedAttachment = await getStoredAttachment(req.params.attachmentId);

  if (!storedAttachment) {
    return res.status(404).json({ error: 'attachment_not_found' });
  }

  res.setHeader('Content-Type', storedAttachment.mimeType || 'application/octet-stream');
  if (storedAttachment.originalMimeType) {
    res.setHeader('X-Pulse-Original-MimeType', storedAttachment.originalMimeType);
  }
  if (storedAttachment.contentEncoding && storedAttachment.contentEncoding !== 'identity') {
    res.setHeader('X-Pulse-Content-Encoding', storedAttachment.contentEncoding);
  }
  if (storedAttachment.envelopeKind) {
    res.setHeader('X-Pulse-Envelope-Kind', storedAttachment.envelopeKind);
  }
  if (storedAttachment.expectedPayloadSha256) {
    res.setHeader('X-Pulse-Expected-Sha256', storedAttachment.expectedPayloadSha256);
  }
  res.setHeader('Content-Length', String(storedAttachment.size || storedAttachment.buffer.length || 0));
  res.setHeader(
    'Content-Disposition',
    `${storedAttachment.contentDisposition || 'attachment'}; filename="${storedAttachment.name || 'bestand'}"`
  );
  res.setHeader('Cache-Control', 'public, max-age=300');

  return res.send(storedAttachment.buffer);
}));
