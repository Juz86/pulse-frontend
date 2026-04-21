import {
  API_URL,
  shouldUseLocalRuntimeFallback,
} from '../config/appConfig';

const LOCAL_BACKEND_URL = 'http://localhost:3001';
const PRODUCTION_BACKEND_URL = API_URL;

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isLocalUrl(value) {
  try {
    return isLocalHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function resolveBackendUrl(explicitUrl = process.env.REACT_APP_BACKEND_URL) {
  const configuredUrl = explicitUrl?.trim();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const runningLocally = shouldUseLocalRuntimeFallback(hostname);

  if (configuredUrl) {
    if (!runningLocally && isLocalUrl(configuredUrl)) {
      console.warn(
        `[Pulse] Ignoring local backend URL "${configuredUrl}" on non-local host; using production API instead.`
      );
      return PRODUCTION_BACKEND_URL;
    }
    return configuredUrl;
  }

  return runningLocally ? LOCAL_BACKEND_URL : PRODUCTION_BACKEND_URL;
}

export { LOCAL_BACKEND_URL, PRODUCTION_BACKEND_URL };
