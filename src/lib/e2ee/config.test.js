import { assertE2eeV2QaConfiguration } from './config';

describe('E2EE v2 QA configuration', () => {
  const valid = {
    enabled: true,
    mode: 'signal',
    transport: 'v2',
    backendUrl: 'https://e2ee-qa.example.test',
    runtimeBackendUrl: 'https://e2ee-qa.example.test',
  };

  test('accepts an explicitly isolated v2 backend', () => {
    expect(assertE2eeV2QaConfiguration(valid)).toBe(true);
  });

  test('rejects production and mismatched backends', () => {
    expect(() => assertE2eeV2QaConfiguration({
      ...valid,
      backendUrl: 'https://api.pulse-messenger.com',
      runtimeBackendUrl: 'https://api.pulse-messenger.com',
    })).toThrow('v2_qa_backend_not_isolated');
    expect(() => assertE2eeV2QaConfiguration({
      ...valid,
      runtimeBackendUrl: 'https://other-qa.example.test',
    })).toThrow('v2_qa_backend_mismatch');
  });

  test('rejects legacy transports while QA is enabled', () => {
    expect(() => assertE2eeV2QaConfiguration({
      ...valid,
      transport: 'socket',
    })).toThrow('v2_qa_transport_config_invalid');
  });
});
