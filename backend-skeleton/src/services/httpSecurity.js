const DEFAULT_MARKETING_ORIGINS = [
  'https://pulse-messenger.com',
  'https://www.pulse-messenger.com',
];

const DEFAULT_APP_ORIGINS = [
  'https://web.pulse-messenger.com',
  'https://pulse-frontend-elt.pages.dev',
];

function parseOriginList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getRequestOrigin(req) {
  const directOrigin = normalizeOrigin(req.headers.origin);
  if (directOrigin) return directOrigin;

  const referer = String(req.headers.referer || req.headers.referrer || '').trim();
  if (!referer) return '';

  try {
    return normalizeOrigin(new URL(referer).origin);
  } catch {
    return '';
  }
}

export function getMarketingOrigins() {
  return new Set([
    ...DEFAULT_MARKETING_ORIGINS,
    ...parseOriginList(process.env.APP_URL),
  ]);
}

export function getAppOrigins() {
  return new Set([
    ...DEFAULT_APP_ORIGINS,
    ...parseOriginList(process.env.WEB_APP_URL),
    ...parseOriginList(process.env.CORS_ORIGINS),
  ]);
}

export function getAllowedOrigins() {
  return new Set([
    ...getMarketingOrigins(),
    ...getAppOrigins(),
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

export function isAllowedAppOrigin(origin) {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return true;
    return getAppOrigins().has(url.origin);
  } catch {
    return false;
  }
}

export function requireAppOrigin(req, res, next) {
  const requestOrigin = getRequestOrigin(req);
  if (isAllowedAppOrigin(requestOrigin)) {
    return next();
  }

  return res.status(403).json({
    error: 'origin_not_allowed',
    detail: 'Deze endpoint is alleen beschikbaar voor de Pulse webapp.',
  });
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
