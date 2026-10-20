import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const startupPromiseRef = useRef(null);

  useEffect(() => {
    if (!E2EE_V2_QA_ENABLED) {
      setState(DISABLED_STATE);
      return undefined;
    }

    let active = true;
    setState({ enabled: true, status: 'starting', binding: null, error: null });
    const startupPromise = startAndroidE2eeV2QaRuntime({ user });
    startupPromiseRef.current = startupPromise;
    startupPromise
      .then((binding) => {
        if (active) setState({ enabled: true, status: 'ready', binding, error: null });
      })
      .catch((error) => {
        if (active) setState({ enabled: true, status: 'failed', binding: null, error });
      });

    return () => {
      active = false;
      if (startupPromiseRef.current === startupPromise) startupPromiseRef.current = null;
      setSocketE2EEDeviceId(null);
    };
  }, [user]);

  const sendText = useCallback((payload) => {
    if (state.status !== 'ready' || !state.binding?.sendText) {
      throw state.error || new Error('v2_qa_runtime_not_ready');
    }
    return state.binding.sendText(payload);
  }, [state]);

  const fetchTextMessages = useCallback(async (payload) => {
    let binding = state.binding;
    if (!binding?.fetchTextMessages && startupPromiseRef.current) {
      binding = await startupPromiseRef.current;
    }
    if (!binding?.fetchTextMessages) throw state.error || new Error('v2_qa_runtime_not_ready');
    return binding.fetchTextMessages(payload);
  }, [state]);

  const receiveTextMessage = useCallback((payload) => {
    if (state.status !== 'ready' || !state.binding?.receiveTextMessage) {
      throw state.error || new Error('v2_qa_runtime_not_ready');
    }
    return state.binding.receiveTextMessage(payload);
  }, [state]);

  const clearTextMessages = useCallback((payload) => {
    if (state.status !== 'ready' || !state.binding?.clearTextMessages) {
      throw state.error || new Error('v2_qa_runtime_not_ready');
    }
    return state.binding.clearTextMessages(payload);
  }, [state]);

  const invalidateLocalDevice = useCallback((payload = {}) => {
    if (state.status !== 'ready' || !state.binding?.invalidateLocalDevice) {
      throw state.error || new Error('v2_qa_runtime_not_ready');
    }
    const result = state.binding.invalidateLocalDevice(payload);
    startupPromiseRef.current = null;
    const error = new Error(
      payload?.revoked ? 'v2_local_device_revoked' : 'v2_local_identity_invalidated'
    );
    error.code = error.message;
    setState({ enabled: true, status: 'invalidated', binding: null, error });
    return result;
  }, [state]);

  return useMemo(() => ({
    enabled: E2EE_V2_QA_ENABLED,
    status: state.status,
    ready: state.status === 'ready',
    error: state.error,
    localDeviceId: state.binding?.deviceId || null,
    localSignalDeviceId: state.binding?.signalDeviceId || null,
    clearTextMessages,
    fetchTextMessages,
    invalidateLocalDevice,
    receiveTextMessage,
    sendText,
  }), [clearTextMessages, fetchTextMessages, invalidateLocalDevice, receiveTextMessage, sendText, state]);
}
