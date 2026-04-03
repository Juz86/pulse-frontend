import crypto from 'crypto';

export function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      `[${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
    );
  });

  next();
}
