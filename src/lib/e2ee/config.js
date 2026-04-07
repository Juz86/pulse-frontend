export const E2EE_MODE = process.env.REACT_APP_E2EE_MODE || 'mock';
export const E2EE_TRANSPORT = process.env.REACT_APP_E2EE_TRANSPORT || 'socket';

export const isE2EEServiceTransportEnabled = E2EE_TRANSPORT === 'service';
export const shouldBootstrapE2EEDevice = isE2EEServiceTransportEnabled || E2EE_MODE === 'signal';

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
