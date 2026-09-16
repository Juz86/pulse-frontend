import { normalizeFeatureFlags } from './featureFlags';

describe('normalizeFeatureFlags', () => {
  test('accepts only valid boolean feature flags', () => {
    expect(normalizeFeatureFlags({ enabled_feature: true, disabled_feature: false, bad: 'true', 'bad-name': true }))
      .toEqual({ realtimekit_calls_v2: false, enabled_feature: true, disabled_feature: false });
  });
});
