import { normalizeFeatureFlags } from './featureFlags';

describe('normalizeFeatureFlags', () => {
  test('accepts only valid boolean feature flags', () => {
    expect(normalizeFeatureFlags({ enabled_feature: true, disabled_feature: false, bad: 'true', 'bad-name': true }))
      .toEqual({ enabled_feature: true, disabled_feature: false });
  });
});
