import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  E2EE_MODE,
  E2EE_TRANSPORT,
  E2EE_V2_BROWSER_QA_ENABLED,
  E2EE_V2_QA_BACKEND_URL,
  E2EE_V2_QA_ENABLED,
} from '../lib/e2ee/config';
import { startAndroidE2eeV2QaRuntime } from '../lib/e2ee/v2/androidQaRuntime';
import { startBrowserE2eeV2QaRuntime } from '../lib/e2ee/v2/browserQaRuntime';
import { createBrowserE2eeWorkerClient } from '../lib/e2ee/v2/browserE2eeWorkerClient';
import { isNativePulseEnvironment } from '../lib/platform/runtime';
import { BACKEND_URL, setSocketE2EEDeviceId } from '../services/socket';

const DISABLED_STATE = Object.freeze({
  enabled: false,
  status: 'disabled',
  binding: null,
  error: null,
});

export default function useAndroidE2eeV2QaRuntime({ user } = {}) {
  const [state, setState] = useState(DISABLED_STATE);
  const startupPromiseRef = useRef(null);
  const nativeRuntime = isNativePulseEnvironment();
  const browserRuntime = !nativeRuntime && E2EE_V2_BROWSER_QA_ENABLED;
  const runtimeEnabled = E2EE_V2_QA_ENABLED && (nativeRuntime || browserRuntime);

  useEffect(() => {
    if (!runtimeEnabled) {
      setState(DISABLED_STATE);
      return undefined;
    }

    let active = true;
    let activeBinding = null;
    const browserClient = browserRuntime
      ? createBrowserE2eeWorkerClient({
        workerFactory: () => new Worker(
          new URL('../lib/e2ee/v2/browserE2eeWorker.js', import.meta.url),
          { type: 'module' },
        ),
        configuration: {
          enabled: E2EE_V2_QA_ENABLED,
          browserEnabled: E2EE_V2_BROWSER_QA_ENABLED,
          mode: E2EE_MODE,
          transport: E2EE_TRANSPORT,
          backendUrl: E2EE_V2_QA_BACKEND_URL,
          runtimeBackendUrl: BACKEND_URL,
        },
      })
      : null;
    setState({ enabled: true, status: 'starting', binding: null, error: null });
    const startupPromise = browserRuntime
      ? startBrowserE2eeV2QaRuntime({
        user,
        client: browserClient,
      })
      : startAndroidE2eeV2QaRuntime({ user });
    startupPromiseRef.current = startupPromise;
    startupPromise
      .then((binding) => {
        activeBinding = binding;
        if (active) {
          setState({ enabled: true, status: 'ready', binding, error: null });
        } else {
          binding.close?.();
        }
      })
      .catch((error) => {
        browserClient?.close();
        if (active) setState({ enabled: true, status: 'failed', binding: null, error });
      });

    return () => {
      active = false;
      activeBinding?.close?.();
      if (startupPromiseRef.current === startupPromise) startupPromiseRef.current = null;
      setSocketE2EEDeviceId(null);
    };
  // Runtime ownership follows the authenticated user and build target.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserRuntime, nativeRuntime, runtimeEnabled, user]);

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
    enabled: runtimeEnabled,
    status: state.status,
    ready: state.status === 'ready',
    error: state.error,
    localDeviceId: state.binding?.deviceId || null,
    localSignalDeviceId: state.binding?.signalDeviceId || null,
    handleSecurityEvent: state.binding?.handleSecurityEvent || null,
    clearTextMessages,
    fetchTextMessages,
    invalidateLocalDevice,
    receiveTextMessage,
    sendText,
  }), [
    clearTextMessages,
    fetchTextMessages,
    invalidateLocalDevice,
    receiveTextMessage,
    runtimeEnabled,
    sendText,
    state,
  ]);
}
