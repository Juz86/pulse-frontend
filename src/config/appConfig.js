import {
  API_URL,
  APP_URL,
  IS_LANDING_BUILD,
  IS_WEBAPP_BUILD,
  MARKETING_URL,
  RTC_CONFIG_URL,
  SIGNALING_URL,
  SITE_TARGET,
  WEB_APP_URL,
  WS_URL,
  getRuntimeOrigin,
  isLocalHost,
  shouldUseLocalRuntimeFallback,
} from './runtimeConfig';

export {
  API_URL,
  APP_URL,
  IS_LANDING_BUILD,
  IS_WEBAPP_BUILD,
  MARKETING_URL,
  RTC_CONFIG_URL,
  SIGNALING_URL,
  SITE_TARGET,
  WEB_APP_URL,
  WS_URL,
  getRuntimeOrigin,
  isLocalHost,
  shouldUseLocalRuntimeFallback,
};

export function getAppLoginUrl({ role = 'parent', mode = 'login' } = {}) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (mode) params.set('mode', mode);
  return `${WEB_APP_URL}/?${params.toString()}`;
}

export function getCanonicalUrl(path = '/') {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = IS_LANDING_BUILD ? MARKETING_URL : WEB_APP_URL;
  return `${baseUrl}${safePath === '/' ? '/' : safePath}`;
}
