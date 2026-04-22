import { applyCorsHeaders, getAllowedRequestOrigin } from '../services/httpSecurity.js';

export function errorHandler(err, _req, res, _next) {
  const isProduction = process.env.NODE_ENV === 'production';
  console.error('[Pulse backend skeleton] Unhandled error:', {
    requestId: _req?.requestId || null,
    message: err?.message || 'Onbekende fout',
    stack: isProduction ? null : (err?.stack || null),
  });

  if (res.headersSent) return;

  const allowedOrigin = getAllowedRequestOrigin(_req, { appOnly: true });
  applyCorsHeaders(res, allowedOrigin);

  res.status(500).json({
    error: 'internal_error',
    requestId: _req?.requestId || null,
    message: isProduction ? 'Er ging iets mis. Probeer het later opnieuw.' : (err?.message || 'Onbekende fout'),
  });
}
