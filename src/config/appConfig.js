const DEFAULT_MARKETING_URL = 'https://pulse-messenger.com';
const DEFAULT_WEB_APP_URL = 'https://web.pulse-messenger.com';
const DEFAULT_API_URL = 'https://api.pulse-messenger.com';

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getWindowOrigin() {
  if (typeof window === 'undefined') return '';
  return trimTrailingSlash(window.location.origin);
}

export const SITE_TARGET = process.env.REACT_APP_SITE_TARGET || 'webapp';
export const IS_LANDING_BUILD = SITE_TARGET === 'landing';
export const IS_WEBAPP_BUILD = !IS_LANDING_BUILD;

export const MARKETING_URL = trimTrailingSlash(
  process.env.REACT_APP_MARKETING_URL || DEFAULT_MARKETING_URL
);

export const APP_URL = trimTrailingSlash(
  process.env.REACT_APP_APP_URL ||
  process.env.REACT_APP_WEB_APP_URL ||
  DEFAULT_WEB_APP_URL
);

const localApiUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || DEFAULT_API_URL;

export const API_URL = trimTrailingSlash(localApiUrl);
export const WS_URL = trimTrailingSlash(process.env.REACT_APP_WS_URL || API_URL);
export const SIGNALING_URL = trimTrailingSlash(process.env.REACT_APP_SIGNALING_URL || WS_URL);
export const RTC_CONFIG_URL = trimTrailingSlash(process.env.REACT_APP_RTC_CONFIG_URL || API_URL);

export function getAppLoginUrl({ role = 'parent', mode = 'login' } = {}) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (mode) params.set('mode', mode);
  return `${APP_URL}/?${params.toString()}`;
}

export function getCanonicalUrl(path = '/') {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = IS_LANDING_BUILD ? MARKETING_URL : APP_URL;
  return `${baseUrl}${safePath === '/' ? '/' : safePath}`;
}

export function isLocalHost(hostname = '') {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

export function shouldUseLocalRuntimeFallback(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  if (hostname) return isLocalHost(hostname);
  return process.env.NODE_ENV !== 'production';
}

export function getRuntimeOrigin() {
  return getWindowOrigin() || (IS_LANDING_BUILD ? MARKETING_URL : APP_URL);
}
