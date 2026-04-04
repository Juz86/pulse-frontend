import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import { getStoredAttachment, storeMockAttachment } from '../services/attachmentStorage.js';

export const attachmentsRouter = Router();

attachmentsRouter.post('/upload', requireAuth, asyncRoute(async (req, res) => {
  const { attachment } = req.body || {};

  if (!attachment || typeof attachment !== 'object') {
    return res.status(400).json({ error: 'invalid_attachment_payload' });
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const storedAttachment = storeMockAttachment({
    attachment,
    baseUrl,
  });

  return res.json({
    ok: true,
    attachment: storedAttachment,
  });
}));

attachmentsRouter.get('/:attachmentId', asyncRoute(async (req, res) => {
  const storedAttachment = getStoredAttachment(req.params.attachmentId);

  if (!storedAttachment) {
    return res.status(404).json({ error: 'attachment_not_found' });
  }

  res.setHeader('Content-Type', storedAttachment.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', String(storedAttachment.size || storedAttachment.buffer.length || 0));
  res.setHeader(
    'Content-Disposition',
    `${storedAttachment.contentDisposition || 'attachment'}; filename="${storedAttachment.name || 'bestand'}"`
  );
  res.setHeader('Cache-Control', 'public, max-age=300');

  return res.send(storedAttachment.buffer);
}));
