export const E2EE_MODE = process.env.REACT_APP_E2EE_MODE || 'mock';
export const E2EE_TRANSPORT = process.env.REACT_APP_E2EE_TRANSPORT || 'socket';

export const isE2EEServiceTransportEnabled = E2EE_TRANSPORT === 'service';
export const shouldBootstrapE2EEDevice = isE2EEServiceTransportEnabled || E2EE_MODE === 'signal';
