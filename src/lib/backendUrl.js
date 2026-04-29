import {
  API_URL,
  shouldUseLocalRuntimeFallback,
} from '../config/runtimeConfig';
import { isNativePulseEnvironment } from './platform/runtime';

const LOCAL_BACKEND_URL = 'http://localhost:3001';
const PRODUCTION_BACKEND_URL = API_URL;
const NATIVE_BACKEND_URL = (process.env.REACT_APP_NATIVE_API_URL || '').trim();

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

export function resolveBackendUrl(explicitUrl) {
  const configuredUrl = explicitUrl?.trim();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const runningNative = isNativePulseEnvironment();
  const runningLocally = !runningNative && shouldUseLocalRuntimeFallback(hostname);

  if (runningNative && NATIVE_BACKEND_URL) {
    return NATIVE_BACKEND_URL;
  }

  if (configuredUrl) {
    if ((runningNative || !runningLocally) && isLocalUrl(configuredUrl)) {
      console.warn(
        `[Pulse] Ignoring local backend URL "${configuredUrl}" in native/non-local runtime; using production API instead.`
      );
      return PRODUCTION_BACKEND_URL;
    }
    return configuredUrl;
  }

  return runningLocally ? LOCAL_BACKEND_URL : PRODUCTION_BACKEND_URL;
}

export { LOCAL_BACKEND_URL, PRODUCTION_BACKEND_URL };
