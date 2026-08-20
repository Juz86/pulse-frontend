const FEATURE_FLAG_POLL_INTERVAL_MS = 60_000;

export const FEATURE_FLAG_DEFAULTS = Object.freeze({});

export function normalizeFeatureFlags(flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return { ...FEATURE_FLAG_DEFAULTS };
  return Object.entries(flags).reduce((normalized, [name, enabled]) => {
    if (/^[a-z][a-z0-9_]{1,79}$/.test(name) && typeof enabled === 'boolean') {
      normalized[name] = enabled;
    }
    return normalized;
  }, { ...FEATURE_FLAG_DEFAULTS });
}

export async function fetchFeatureFlags(backendUrl) {
  if (!backendUrl) return { ...FEATURE_FLAG_DEFAULTS };
  try {
    const response = await fetch(`${String(backendUrl).replace(/\/+$/, '')}/api/feature-flags`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) return { ...FEATURE_FLAG_DEFAULTS };
    const payload = await response.json();
    return normalizeFeatureFlags(payload?.flags);
  } catch (error) {
    console.warn('[Pulse][FeatureFlags] Config ophalen mislukt:', error?.message || error);
    return { ...FEATURE_FLAG_DEFAULTS };
  }
}

export function subscribeToFeatureFlags(backendUrl, onFlags) {
  if (typeof onFlags !== 'function') return () => {};
  let disposed = false;
  const refresh = async () => {
    const flags = await fetchFeatureFlags(backendUrl);
    if (!disposed) onFlags(flags);
  };

  refresh();
  const intervalId = window.setInterval(refresh, FEATURE_FLAG_POLL_INTERVAL_MS);
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    disposed = true;
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
