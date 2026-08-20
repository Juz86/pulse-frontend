import { createContext, useContext, useMemo } from 'react';
import { FEATURE_FLAG_DEFAULTS, normalizeFeatureFlags } from '../services/featureFlags';

const FeatureFlagsContext = createContext(FEATURE_FLAG_DEFAULTS);

export function FeatureFlagsProvider({ flags, children }) {
  const value = useMemo(() => normalizeFeatureFlags(flags), [flags]);
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlag(name) {
  return useContext(FeatureFlagsContext)[name] === true;
}
