import {
  assertBrowserE2eeV2QaConfiguration,
  assertBrowserE2eeV2PilotConfiguration,
  assertE2eeV2PilotConfiguration,
  assertE2eeV2QaConfiguration,
} from './config';

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

  test('requires the isolated v2 QA gate for browser crypto', () => {
    expect(() => assertE2eeV2QaConfiguration({
      ...valid,
      enabled: false,
      browserEnabled: true,
    })).toThrow('v2_browser_qa_requires_v2_qa');
    expect(assertBrowserE2eeV2QaConfiguration({
      ...valid,
      browserEnabled: false,
    })).toBe(false);
    expect(assertBrowserE2eeV2QaConfiguration({
      ...valid,
      browserEnabled: true,
    })).toBe(true);
  });
});

describe('E2EE v2 production pilot configuration', () => {
  const valid = {
    enabled: true,
    qaEnabled: false,
    mode: 'signal',
    transport: 'v2',
    backendUrl: 'https://api.pulse-messenger.com',
    runtimeBackendUrl: 'https://api.pulse-messenger.com',
  };

  test('accepts only the production API with the v2 transport', () => {
    expect(assertE2eeV2PilotConfiguration(valid)).toBe(true);
    expect(() => assertE2eeV2PilotConfiguration({
      ...valid,
      backendUrl: 'https://e2ee-qa.example.test',
      runtimeBackendUrl: 'https://e2ee-qa.example.test',
    })).toThrow('v2_pilot_backend_not_production');
    expect(() => assertE2eeV2PilotConfiguration({
      ...valid,
      transport: 'socket',
    })).toThrow('v2_pilot_transport_config_invalid');
  });

  test('rejects simultaneous QA and production pilot modes', () => {
    expect(() => assertE2eeV2PilotConfiguration({
      ...valid,
      qaEnabled: true,
    })).toThrow('v2_qa_and_pilot_conflict');
  });

  test('requires the pilot gate for the browser provider', () => {
    expect(assertBrowserE2eeV2PilotConfiguration({
      ...valid,
      browserEnabled: false,
    })).toBe(false);
    expect(assertBrowserE2eeV2PilotConfiguration({
      ...valid,
      browserEnabled: true,
    })).toBe(true);
  });
});
