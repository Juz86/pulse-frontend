export function errorHandler(err, _req, res, _next) {
  console.error('[Pulse backend skeleton] Unhandled error:', {
    requestId: _req?.requestId || null,
    message: err?.message || 'Onbekende fout',
    stack: err?.stack || null,
  });

  if (res.headersSent) return;

  res.status(500).json({
    error: 'internal_error',
    requestId: _req?.requestId || null,
    message: err?.message || 'Onbekende fout',
  });
}
