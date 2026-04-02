import { pulseCryptoMock } from './pulseCryptoMock';

const mode = process.env.REACT_APP_E2EE_MODE || 'mock';

export const pulseCryptoAdapter = mode === 'signal'
  ? pulseCryptoMock
  : pulseCryptoMock;
