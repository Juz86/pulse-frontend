export const E2EE_MODE = process.env.REACT_APP_E2EE_MODE || 'mock';
export const E2EE_TRANSPORT = process.env.REACT_APP_E2EE_TRANSPORT || 'socket';
export const E2EE_ATTACHMENT_TRANSPORT = process.env.REACT_APP_E2EE_ATTACHMENT_TRANSPORT || 'inline';

export const isE2EEServiceTransportEnabled = E2EE_TRANSPORT === 'service';
export const isRemoteMockAttachmentTransportEnabled = E2EE_ATTACHMENT_TRANSPORT === 'remote_mock';
export const shouldBootstrapE2EEDevice = isE2EEServiceTransportEnabled || E2EE_MODE === 'signal';

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
