export const E2EE_MODE = process.env.REACT_APP_E2EE_MODE || 'mock';
export const E2EE_TRANSPORT = process.env.REACT_APP_E2EE_TRANSPORT || 'socket';
export const E2EE_V2_QA_ENABLED = process.env.REACT_APP_E2EE_V2_QA_ENABLED === 'true';
export const E2EE_V2_BROWSER_QA_ENABLED =
  process.env.REACT_APP_E2EE_V2_BROWSER_QA_ENABLED === 'true';
export const E2EE_V2_QA_BACKEND_URL = String(
  process.env.REACT_APP_E2EE_V2_QA_BACKEND_URL || ''
).replace(/\/+$/, '');

const PRODUCTION_BACKEND_HOST = 'api.pulse-messenger.com';

export const isE2EEServiceTransportEnabled = E2EE_TRANSPORT === 'service';
export const shouldBootstrapE2EEDevice = !E2EE_V2_QA_ENABLED
  && (isE2EEServiceTransportEnabled || E2EE_MODE === 'signal');

export function assertE2eeV2QaConfiguration({
  enabled = E2EE_V2_QA_ENABLED,
  browserEnabled = E2EE_V2_BROWSER_QA_ENABLED,
  mode = E2EE_MODE,
  transport = E2EE_TRANSPORT,
  backendUrl = E2EE_V2_QA_BACKEND_URL,
  runtimeBackendUrl = backendUrl,
} = {}) {
  if (browserEnabled && !enabled) {
    throw new Error('v2_browser_qa_requires_v2_qa');
  }
  if (!enabled) return false;
  if (mode !== 'signal' || transport !== 'v2') {
    throw new Error('v2_qa_transport_config_invalid');
  }

  let parsed;
  try {
    parsed = new URL(backendUrl);
  } catch {
    throw new Error('v2_qa_backend_url_invalid');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname === PRODUCTION_BACKEND_HOST) {
    throw new Error('v2_qa_backend_not_isolated');
  }
  if (String(runtimeBackendUrl || '').replace(/\/+$/, '') !== parsed.toString().replace(/\/+$/, '')) {
    throw new Error('v2_qa_backend_mismatch');
  }
  return true;
}

export function assertBrowserE2eeV2QaConfiguration(options = {}) {
  const browserEnabled = options.browserEnabled ?? E2EE_V2_BROWSER_QA_ENABLED;
  if (!browserEnabled) return false;
  const enabled = options.enabled ?? E2EE_V2_QA_ENABLED;
  assertE2eeV2QaConfiguration({ ...options, browserEnabled, enabled });
  return true;
}

export function getServiceTransportFallbackBannerState({
  transport = E2EE_TRANSPORT,
  serviceTransportReady = true,
} = {}) {
  const visible = Boolean(transport === 'service' && !serviceTransportReady);

  return {
    visible,
    tone: 'fallback',
    text: 'Serviceversleuteling is tijdelijk niet beschikbaar. Pulse gebruikt nu automatisch socketfallback.',
  };
}

export async function probeE2EEServiceReady(baseUrl) {
  if (!isE2EEServiceTransportEnabled || !baseUrl) return false;

  try {
    const response = await fetch(`${baseUrl}/readyz`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) return false;
    const data = await response.json();
    return !!data?.ok;
  } catch {
    return false;
  }
}
