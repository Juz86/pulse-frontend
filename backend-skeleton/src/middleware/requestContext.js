import crypto from 'crypto';

function safeLogPath(req) {
  return req.path || String(req.originalUrl || '').split('?')[0] || '/';
}

export function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const logPath = safeLogPath(req);

  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      `[${requestId}] ${req.method} ${logPath} -> ${res.statusCode} (${durationMs}ms)`
    );
  });

  next();
}
