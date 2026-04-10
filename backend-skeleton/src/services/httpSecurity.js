const DEFAULT_ALLOWED_ORIGINS = [
  'https://pulse-messenger.com',
  'https://www.pulse-messenger.com',
  'https://pulse-frontend-elt.pages.dev',
];

function parseOriginList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAllowedOrigins() {
  return new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...parseOriginList(process.env.APP_URL),
    ...parseOriginList(process.env.CORS_ORIGINS),
  ]);
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return true;
    return getAllowedOrigins().has(url.origin);
  } catch {
    return false;
  }
}

export function buildCorsOptions() {
  return {
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-dev-uid', 'x-request-id'],
    maxAge: 86400,
  };
}

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
}
