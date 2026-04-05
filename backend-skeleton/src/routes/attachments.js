import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getStoredAttachment,
  getStoredAttachmentMetadata,
  storeMockAttachment,
} from '../services/attachmentStorage.js';

export const attachmentsRouter = Router();

function setAttachmentContractHeaders(res, attachmentLike) {
  if (attachmentLike?.strategyKey) {
    res.setHeader('X-Pulse-Encryption-Strategy', attachmentLike.strategyKey);
  }
  if (attachmentLike?.originalMimeType) {
    res.setHeader('X-Pulse-Original-MimeType', attachmentLike.originalMimeType);
  }
  if (attachmentLike?.contentEncoding && attachmentLike.contentEncoding !== 'identity') {
    res.setHeader('X-Pulse-Content-Encoding', attachmentLike.contentEncoding);
  }
  if (attachmentLike?.envelopeKind) {
    res.setHeader('X-Pulse-Envelope-Kind', attachmentLike.envelopeKind);
  }
  if (attachmentLike?.expectedPayloadSha256) {
    res.setHeader('X-Pulse-Expected-Sha256', attachmentLike.expectedPayloadSha256);
  }
  if (attachmentLike?.mediaKeyId) {
    res.setHeader('X-Pulse-Media-Key-Id', attachmentLike.mediaKeyId);
  }
  if (attachmentLike?.keyWrapAlg) {
    res.setHeader('X-Pulse-Key-Wrap-Alg', attachmentLike.keyWrapAlg);
  }
  if (attachmentLike?.wrappedMediaKeyDigest) {
    res.setHeader('X-Pulse-Wrapped-Media-Key-Digest', attachmentLike.wrappedMediaKeyDigest);
  }
}

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

  setAttachmentContractHeaders(res, metadata);

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
  setAttachmentContractHeaders(res, storedAttachment);
  res.setHeader('Content-Length', String(storedAttachment.size || storedAttachment.buffer.length || 0));
  res.setHeader(
    'Content-Disposition',
    `${storedAttachment.contentDisposition || 'attachment'}; filename="${storedAttachment.name || 'bestand'}"`
  );
  res.setHeader('Cache-Control', 'public, max-age=300');

  return res.send(storedAttachment.buffer);
}));
