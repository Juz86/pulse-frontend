import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  E2EE_MODE,
  E2EE_TRANSPORT,
  E2EE_V2_BROWSER_PILOT_ENABLED,
  E2EE_V2_BROWSER_QA_ENABLED,
  E2EE_V2_GROUPS_ENABLED,
  E2EE_V2_PILOT_ENABLED,
  E2EE_V2_QA_BACKEND_URL,
  E2EE_V2_QA_ENABLED,
  assertBrowserE2eeV2PilotConfiguration,
  assertE2eeV2PilotConfiguration,
} from '../lib/e2ee/config';
import { startAndroidE2eeV2QaRuntime } from '../lib/e2ee/v2/androidQaRuntime';
import { startBrowserE2eeV2QaRuntime } from '../lib/e2ee/v2/browserQaRuntime';
import { createBrowserE2eeWorkerClient } from '../lib/e2ee/v2/browserE2eeWorkerClient';
import { checkE2eeV2PilotEnrollment } from '../lib/e2ee/v2/pilotEnrollment';
import { createV2ApiClient } from '../lib/e2ee/v2/v2ApiClient';
import { isNativePulseEnvironment } from '../lib/platform/runtime';
import { BACKEND_URL, setSocketE2EEDeviceId } from '../services/socket';

const DISABLED_STATE = Object.freeze({
  enabled: false,
  status: 'disabled',
  binding: null,
  error: null,
  sendingEnabled: false,
});

export default function useAndroidE2eeV2QaRuntime({ user } = {}) {
  const [state, setState] = useState(DISABLED_STATE);
  const startupPromiseRef = useRef(null);
  const nativeRuntime = isNativePulseEnvironment();
  const pilotRuntime = E2EE_V2_PILOT_ENABLED;
  const qaRuntime = E2EE_V2_QA_ENABLED;
  const browserRuntime = !nativeRuntime && (
    pilotRuntime ? E2EE_V2_BROWSER_PILOT_ENABLED : E2EE_V2_BROWSER_QA_ENABLED
  );
  const runtimeEnabled = (qaRuntime || pilotRuntime) && (nativeRuntime || browserRuntime);
  const groupsEnabled = runtimeEnabled && nativeRuntime && E2EE_V2_GROUPS_ENABLED;

  useEffect(() => {
    if (!runtimeEnabled) {
      setState(DISABLED_STATE);
      return undefined;
    }

    let active = true;
    let activeBinding = null;
    let browserClient = null;
    const backendUrl = pilotRuntime ? BACKEND_URL : E2EE_V2_QA_BACKEND_URL;
    const api = createV2ApiClient({ baseUrl: backendUrl });
    const assertConfiguration = pilotRuntime
      ? (browserRuntime
        ? assertBrowserE2eeV2PilotConfiguration
        : assertE2eeV2PilotConfiguration)
      : undefined;
    const configuration = {
      enabled: true,
      qaEnabled: qaRuntime,
      browserEnabled: browserRuntime,
      mode: E2EE_MODE,
      transport: E2EE_TRANSPORT,
      backendUrl,
      runtimeBackendUrl: BACKEND_URL,
    };
    setState({
      enabled: qaRuntime,
      status: pilotRuntime ? 'checking_enrollment' : 'starting',
      binding: null,
      error: null,
      sendingEnabled: qaRuntime,
    });
    const startupPromise = (async () => {
      let enrollment = null;
      if (pilotRuntime) {
        assertConfiguration(configuration);
        enrollment = await checkE2eeV2PilotEnrollment({ user, api });
        if (!enrollment.enrolled) return null;
        if (active) {
          setState({
            enabled: true,
            status: 'starting',
            binding: null,
            error: null,
            sendingEnabled: enrollment.sendingEnabled,
          });
        }
      }
      if (browserRuntime) {
        browserClient = createBrowserE2eeWorkerClient({
          workerFactory: () => new Worker(
            new URL('../lib/e2ee/v2/browserE2eeWorker.js', import.meta.url),
            { type: 'module' },
          ),
          configuration,
          ...(assertConfiguration ? { assertConfiguration } : {}),
          ...(pilotRuntime ? { disabledErrorCode: 'e2ee_browser_pilot_disabled' } : {}),
        });
        return startBrowserE2eeV2QaRuntime({
          user,
          client: browserClient,
          backendUrl,
          runtimeBackendUrl: BACKEND_URL,
          api,
          bindingNamespace: pilotRuntime ? 'pilot' : 'qa',
          ...(assertConfiguration ? { assertConfiguration } : {}),
        });
      }
      return startAndroidE2eeV2QaRuntime({
        user,
        backendUrl,
        runtimeBackendUrl: BACKEND_URL,
        api,
        bindingNamespace: pilotRuntime ? 'pilot' : 'qa',
        ...(assertConfiguration ? { assertConfiguration } : {}),
      });
    })();
    startupPromiseRef.current = startupPromise;
    startupPromise
      .then((binding) => {
        if (!binding) {
          if (active) setState({ ...DISABLED_STATE, status: 'not_enrolled' });
          return;
        }
        activeBinding = binding;
        if (active) {
          setState((current) => ({
            enabled: true,
            status: 'ready',
            binding,
            error: null,
            sendingEnabled: pilotRuntime ? current.sendingEnabled : true,
          }));
        } else {
          binding.close?.();
        }
      })
      .catch((error) => {
        browserClient?.close();
        if (active) {
          setState({
            enabled: false,
            status: 'failed',
            binding: null,
            error,
            sendingEnabled: false,
          });
        }
      });

    return () => {
      active = false;
      activeBinding?.close?.();
      if (startupPromiseRef.current === startupPromise) startupPromiseRef.current = null;
      setSocketE2EEDeviceId(null);
    };
  // Runtime ownership follows the authenticated user and build target.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserRuntime, nativeRuntime, pilotRuntime, qaRuntime, runtimeEnabled, user]);

  const sendText = useCallback((payload) => {
    if (state.status !== 'ready' || !state.binding?.sendText) {
      throw state.error || new Error('v2_qa_runtime_not_ready');
    }
    if (!state.sendingEnabled) throw new Error('v2_pilot_sends_paused');
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

  const callGroupRuntime = useCallback((method, payload) => {
    if (!groupsEnabled || state.status !== 'ready' || !state.binding?.[method]) {
      throw state.error || new Error('group_e2ee_runtime_not_ready');
    }
    return state.binding[method](payload);
  }, [groupsEnabled, state]);

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
    setState({
      enabled: true,
      status: 'invalidated',
      binding: null,
      error,
      sendingEnabled: false,
    });
    return result;
  }, [state]);

  return useMemo(() => ({
    enabled: state.enabled,
    status: state.status,
    ready: state.status === 'ready',
    error: state.error,
    localDeviceId: state.binding?.deviceId || null,
    localSignalDeviceId: state.binding?.signalDeviceId || null,
    sendingEnabled: state.sendingEnabled,
    groupsEnabled,
    handleSecurityEvent: state.binding?.handleSecurityEvent || null,
    clearTextMessages,
    fetchTextMessages,
    invalidateLocalDevice,
    receiveTextMessage,
    sendText,
    fetchGroupMessages: payload => callGroupRuntime('fetchGroupMessages', payload),
    prepareGroupEpoch: payload => callGroupRuntime('prepareGroupEpoch', payload),
    receiveGroupDistribution: payload => callGroupRuntime('receiveGroupDistribution', payload),
    receiveGroupMessage: payload => callGroupRuntime('receiveGroupMessage', payload),
    sendGroupText: payload => callGroupRuntime('sendGroupText', payload),
  }), [
    callGroupRuntime,
    clearTextMessages,
    fetchTextMessages,
    invalidateLocalDevice,
    receiveTextMessage,
    sendText,
    groupsEnabled,
    state,
  ]);
}
