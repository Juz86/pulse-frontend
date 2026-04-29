const DEFAULT_MARKETING_ORIGINS = [
  'https://pulse-messenger.com',
  'https://www.pulse-messenger.com',
];

const DEFAULT_APP_ORIGINS = [
  'https://web.pulse-messenger.com',
  'https://pulse-frontend-elt.pages.dev',
];
const DEFAULT_APP_HOST_SUFFIXES = [
  '.pulse-frontend-elt.pages.dev',
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

function parseHostSuffixList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => item.startsWith('.') ? item : `.${item}`);
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

export function getAppHostSuffixes() {
  return new Set([
    ...DEFAULT_APP_HOST_SUFFIXES,
    ...parseHostSuffixList(process.env.CORS_ORIGIN_SUFFIXES),
  ]);
}

function matchesAllowedOrigin(url, allowedOrigins, allowedHostSuffixes = new Set()) {
  if (allowedOrigins.has(url.origin)) return true;
  const hostname = String(url.hostname || '').toLowerCase();
  for (const suffix of allowedHostSuffixes) {
    if (hostname.endsWith(suffix)) return true;
  }
  return false;
}

export function getAllowedOrigins() {
  return new Set([
    ...getMarketingOrigins(),
    ...getAppOrigins(),
  ]);
}

function appendVaryHeader(res, value) {
  const current = String(res.getHeader('Vary') || '').trim();
  if (!current) {
    res.setHeader('Vary', value);
    return;
  }

  const parts = current.split(',').map((item) => item.trim().toLowerCase());
  if (!parts.includes(String(value).toLowerCase())) {
    res.setHeader('Vary', `${current}, ${value}`);
  }
}

export function isAllowedOrigin(origin) {
  if (origin === 'null') return true;
  if (!origin) return true;

  try {
    const url = new URL(origin);
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return true;
    return matchesAllowedOrigin(url, getAllowedOrigins(), getAppHostSuffixes());
  } catch {
    return false;
  }
}

export function isAllowedAppOrigin(origin) {
  if (origin === 'null') return true;
  if (!origin) return true;

  try {
    const url = new URL(origin);
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return true;
    if (getMarketingOrigins().has(url.origin)) return false;
    return matchesAllowedOrigin(url, getAppOrigins(), getAppHostSuffixes());
  } catch {
    return false;
  }
}

export function getAllowedRequestOrigin(req, { appOnly = false } = {}) {
  const requestOrigin = normalizeOrigin(req?.headers?.origin);
  if (!requestOrigin) return '';

  const checker = appOnly ? isAllowedAppOrigin : isAllowedOrigin;
  return checker(requestOrigin) ? requestOrigin : '';
}

export function applyCorsHeaders(res, origin) {
  if (!origin) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  appendVaryHeader(res, 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-dev-uid,x-request-id');
  res.setHeader('Access-Control-Expose-Headers', 'x-request-id');
  res.setHeader('Access-Control-Max-Age', '86400');
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

export function buildCorsOptions({ appOnly = false } = {}) {
  const originChecker = appOnly ? isAllowedAppOrigin : isAllowedOrigin;
  return {
    origin(origin, callback) {
      callback(null, originChecker(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-dev-uid', 'x-request-id'],
    maxAge: 86400,
  };
}

export function appOnlyCors(req, res, next) {
  const requestOrigin = normalizeOrigin(req.headers.origin);

  if (!requestOrigin || requestOrigin === 'null') {
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  }

  if (!isAllowedAppOrigin(requestOrigin)) {
    return res.status(403).json({
      error: 'origin_not_allowed',
      detail: 'Deze endpoint is alleen beschikbaar voor de Pulse webapp.',
    });
  }

  applyCorsHeaders(res, requestOrigin);

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
}
