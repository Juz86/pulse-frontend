const DEFAULT_PRODUCTION_MARKETING_URL = 'https://pulse-messenger.com';
const DEFAULT_PRODUCTION_WEB_APP_URL = 'https://web.pulse-messenger.com';
const DEFAULT_PRODUCTION_API_URL = 'https://api.pulse-messenger.com';
const DEFAULT_LOCAL_WEB_ORIGIN = 'http://localhost:3000';
const DEFAULT_LOCAL_API_URL = 'http://localhost:3001';
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC91LqqIw8z8NH7e1ChCKD3zUo_VXQeyRY',
  authDomain: 'pulse-messenger-3cb9d.firebaseapp.com',
  projectId: 'pulse-messenger-3cb9d',
  storageBucket: 'pulse-messenger-3cb9d.firebasestorage.app',
  messagingSenderId: '764605255111',
  appId: '1:764605255111:web:7cecff60d89c64f08e5de2',
};

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getWindowLocation() {
  if (typeof window === 'undefined') return null;
  return window.location;
}

function getWindowOrigin() {
  return trimTrailingSlash(getWindowLocation()?.origin || '');
}

function isNativeRuntime() {
  if (typeof window === 'undefined') return false;

  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    if (window.Capacitor?.platform && window.Capacitor.platform !== 'web') return true;
    if (window.ReactNativeWebView) return true;
    if (window.webkit?.messageHandlers?.capacitor) return true;
  } catch {
    return false;
  }

  return false;
}

export function isLocalHost(hostname = '') {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

export function shouldUseLocalRuntimeFallback(hostname = getWindowLocation()?.hostname || '') {
  if (isNativeRuntime()) return false;
  if (hostname) return isLocalHost(hostname);
  return process.env.NODE_ENV !== 'production';
}

function getDefaultWebOrigin() {
  return shouldUseLocalRuntimeFallback() ? (getWindowOrigin() || DEFAULT_LOCAL_WEB_ORIGIN) : DEFAULT_PRODUCTION_WEB_APP_URL;
}

function getDefaultMarketingUrl() {
  return shouldUseLocalRuntimeFallback() ? getDefaultWebOrigin() : DEFAULT_PRODUCTION_MARKETING_URL;
}

function getDefaultApiUrl() {
  return shouldUseLocalRuntimeFallback() ? DEFAULT_LOCAL_API_URL : DEFAULT_PRODUCTION_API_URL;
}

function hostnameFromUrl(value, fallback = '') {
  try {
    return new URL(value).hostname;
  } catch {
    return fallback;
  }
}

export const SITE_TARGET = process.env.REACT_APP_SITE_TARGET === 'landing' ? 'landing' : 'webapp';
export const IS_LANDING_BUILD = SITE_TARGET === 'landing';
export const IS_WEBAPP_BUILD = !IS_LANDING_BUILD;

export const MARKETING_URL = trimTrailingSlash(
  process.env.REACT_APP_MARKETING_URL || getDefaultMarketingUrl()
);

export const WEB_APP_URL = trimTrailingSlash(
  process.env.REACT_APP_WEB_APP_URL ||
  process.env.REACT_APP_APP_URL ||
  getDefaultWebOrigin()
);

export const APP_URL = WEB_APP_URL;

export const API_URL = trimTrailingSlash(
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  getDefaultApiUrl()
);

export const WS_URL = trimTrailingSlash(process.env.REACT_APP_WS_URL || API_URL);
export const SIGNALING_URL = trimTrailingSlash(process.env.REACT_APP_SIGNALING_URL || WS_URL);
export const RTC_CONFIG_URL = trimTrailingSlash(process.env.REACT_APP_RTC_CONFIG_URL || API_URL);

export const FIREBASE_AUTH_DOMAIN =
  process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain;

export const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: process.env.REACT_APP_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
};

export const VAPID_KEY = process.env.REACT_APP_VAPID_KEY || '';
export const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN || '';
export const WEB_APP_HOSTNAME = hostnameFromUrl(WEB_APP_URL, 'localhost');
export const MARKETING_HOSTNAME = hostnameFromUrl(MARKETING_URL, 'localhost');

export const RUNTIME_CONFIG = {
  MARKETING_URL,
  WEB_APP_URL,
  API_URL,
  WS_URL,
  SIGNALING_URL,
  RTC_CONFIG_URL,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_CONFIG,
  SITE_TARGET,
};

export function getRuntimeOrigin() {
  return getWindowOrigin() || (IS_LANDING_BUILD ? MARKETING_URL : WEB_APP_URL);
}
