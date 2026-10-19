import { useCallback, useEffect, useMemo, useState } from 'react';
import { E2EE_V2_QA_ENABLED } from '../lib/e2ee/config';
import { startAndroidE2eeV2QaRuntime } from '../lib/e2ee/v2/androidQaRuntime';
import { setSocketE2EEDeviceId } from '../services/socket';

const DISABLED_STATE = Object.freeze({
  enabled: false,
  status: 'disabled',
  binding: null,
  error: null,
});

export default function useAndroidE2eeV2QaRuntime({ user } = {}) {
  const [state, setState] = useState(DISABLED_STATE);

  useEffect(() => {
    if (!E2EE_V2_QA_ENABLED) {
      setState(DISABLED_STATE);
      return undefined;
    }

    let active = true;
    setState({ enabled: true, status: 'starting', binding: null, error: null });
    startAndroidE2eeV2QaRuntime({ user })
      .then((binding) => {
        if (active) setState({ enabled: true, status: 'ready', binding, error: null });
      })
      .catch((error) => {
        if (active) setState({ enabled: true, status: 'failed', binding: null, error });
      });

    return () => {
      active = false;
      setSocketE2EEDeviceId(null);
    };
  }, [user]);

  const sendText = useCallback((payload) => {
    if (state.status !== 'ready' || !state.binding?.sendText) {
      throw state.error || new Error('v2_qa_runtime_not_ready');
    }
    return state.binding.sendText(payload);
  }, [state]);

  return useMemo(() => ({
    enabled: state.enabled,
    status: state.status,
    ready: state.status === 'ready',
    error: state.error,
    localDeviceId: state.binding?.deviceId || null,
    localSignalDeviceId: state.binding?.signalDeviceId || null,
    sendText,
  }), [sendText, state]);
}
