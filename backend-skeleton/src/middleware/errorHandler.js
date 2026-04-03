export function errorHandler(err, _req, res, _next) {
  console.error('[Pulse backend skeleton] Unhandled error:', err);

  if (res.headersSent) return;

  res.status(500).json({
    error: 'internal_error',
    message: err?.message || 'Onbekende fout',
  });
}
