/* eslint-env worker */
/* global globalThis */
import {
  BrowserE2eeStoreError,
  createBrowserE2eeSecureStore,
  normalizeBrowserE2eeBinding,
} from './browserSecureStore';
import { createBrowserSignalStoreRuntime } from './browserSignalStoreRuntime';

const ALLOWED_COMMANDS = new Set([
  'initialize',
  'status',
  'bootstrap',
  'listSessionDevices',
  'invalidateRemoteDevice',
  'saveOutbox',
  'listOutbox',
  'removeOutbox',
  'storeReceivedMessage',
  'listReceivedMessages',
  'clearReceivedMessages',
  'encrypt',
  'decrypt',
  'revoke',
]);

async function defaultWasmLoader() {
  const { loadBrowserSignalWasmProvider } = await import('./browserSignalWasmProvider');
  return loadBrowserSignalWasmProvider();
}
function workerErrorCode(error) {
  if (error instanceof BrowserE2eeStoreError) return error.code;
  return 'e2ee_browser_worker_failed';
}

export function createBrowserE2eeWorkerHandler({
  storeFactory = createBrowserE2eeSecureStore,
  wasmLoader = defaultWasmLoader,
  runtimeFactory = createBrowserSignalStoreRuntime,
} = {}) {
  let state = null;

  return async function handleMessage(message = {}) {
    const command = String(message.command || '');
    if (!ALLOWED_COMMANDS.has(command)) {
      throw new BrowserE2eeStoreError('e2ee_browser_worker_command_invalid');
    }

    if (command === 'initialize') {
      if (state) throw new BrowserE2eeStoreError('e2ee_browser_worker_already_initialized');
      const generationId = String(message.generationId || '').trim();
      if (!generationId) throw new BrowserE2eeStoreError('e2ee_browser_generation_invalid');
      const binding = normalizeBrowserE2eeBinding(message.binding);
      const wasmProvider = await wasmLoader();
      if (!wasmProvider?.api || wasmProvider.privateMaterialExportable !== false) {
        throw new BrowserE2eeStoreError('e2ee_browser_wasm_provider_invalid');
      }
      const store = storeFactory();
      const storage = await store.initialize();
      const runtime = runtimeFactory({ api: wasmProvider.api, secureStore: store, binding });
      const bootstrapped = await runtime.hydrateIfPresent();
      state = { generationId, binding, store, storage, wasmProvider, runtime, bootstrapped };
    } else {
      if (!state || message.generationId !== state.generationId) {
        throw new BrowserE2eeStoreError('e2ee_browser_worker_generation_stale');
      }
      if (command === 'bootstrap') {
        const result = await state.runtime.bootstrap({ preKeyCount: message.preKeyCount });
        state.bootstrapped = true;
        return result;
      }
      if (['encrypt', 'decrypt', 'invalidateRemoteDevice'].includes(command)) {
        try {
          return await state.runtime[command](message.payload);
        } catch (error) {
          if (error?.code === 'e2ee_browser_persistence_failed') {
            state.runtime.close();
            await state.store.close();
            state = null;
          }
          throw error;
        }
      }
      if (command === 'listSessionDevices') {
        return state.runtime.listSessionDevices(message.payload);
      }
      if (['saveOutbox', 'listOutbox', 'removeOutbox', 'storeReceivedMessage',
        'listReceivedMessages', 'clearReceivedMessages'].includes(command)) {
        return state.runtime[command](message.payload);
      }
      if (command === 'revoke') {
        state.runtime.close();
        await state.store.clearDevice(state.binding);
        await state.store.close();
        state = null;
        return { revoked: true };
      }
    }

    return {
      initialized: Boolean(state),
      providerAvailable: false,
      wasmReady: Boolean(state?.wasmProvider),
      bootstrapped: Boolean(state?.bootstrapped),
      provider: state?.wasmProvider?.provider || 'browser_qa_unavailable',
      privateMaterialExportable: false,
      storage: state?.storage || null,
    };
  };
}

const isDedicatedWorker = typeof WorkerGlobalScope !== 'undefined'
  && globalThis instanceof WorkerGlobalScope;

if (isDedicatedWorker) {
  const handleMessage = createBrowserE2eeWorkerHandler();
  let commandQueue = Promise.resolve();
  globalThis.onmessage = ({ data }) => {
    const requestId = data?.requestId;
    const command = commandQueue.then(() => handleMessage(data));
    commandQueue = command.catch(() => undefined);
    command.then(
      (result) => globalThis.postMessage({ requestId, ok: true, result }),
      (error) => globalThis.postMessage({ requestId, ok: false, error: workerErrorCode(error) }),
    );
  };
}
