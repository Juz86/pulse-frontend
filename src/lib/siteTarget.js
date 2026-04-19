export const SITE_TARGET = process.env.REACT_APP_SITE_TARGET || 'webapp';
export const PULSE_WEB_APP_URL = (process.env.REACT_APP_WEB_APP_URL || 'https://web.pulse-messenger.com').replace(/\/$/, '');

export const isLandingBuild = SITE_TARGET === 'landing';
export const isWebAppBuild = !isLandingBuild;

export function getWebAppLoginUrl({ role = 'parent', mode = 'login' } = {}) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (mode) params.set('mode', mode);
  return `${PULSE_WEB_APP_URL}/?${params.toString()}`;
}
