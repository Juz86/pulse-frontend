/* global globalThis */
import { assertBrowserE2eeV2QaConfiguration } from '../config';

const DEFAULT_TIMEOUT_MS = 15000;

export class BrowserE2eeWorkerClientError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BrowserE2eeWorkerClientError';
    this.code = code;
  }
}
function requireWorkerFactory(workerFactory) {
  if (typeof workerFactory !== 'function') {
    throw new BrowserE2eeWorkerClientError('e2ee_browser_worker_factory_missing');
  }
}

export function createBrowserE2eeWorkerClient({
  workerFactory,
  configuration,
  cryptoImpl = globalThis.crypto,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!assertBrowserE2eeV2QaConfiguration(configuration)) {
    throw new BrowserE2eeWorkerClientError('e2ee_browser_qa_disabled');
  }
  requireWorkerFactory(workerFactory);
  if (typeof cryptoImpl?.randomUUID !== 'function') {
    throw new BrowserE2eeWorkerClientError('e2ee_browser_random_unavailable');
  }

  let worker = null;
  let generationId = null;
  let binding = null;
  let requestCounter = 0;
  let blocked = false;
  const pending = new Map();

  function rejectPending(code) {
    for (const { reject, timeout } of pending.values()) {
      clearTimeout(timeout);
      reject(new BrowserE2eeWorkerClientError(code));
    }
    pending.clear();
  }

  function terminate(code = 'e2ee_browser_worker_closed') {
    if (worker) worker.terminate();
    worker = null;
    generationId = null;
    rejectPending(code);
  }

  function spawnWorker() {
    if (blocked) throw new BrowserE2eeWorkerClientError('e2ee_browser_worker_blocked');
    const nextWorker = workerFactory();
    if (!nextWorker || typeof nextWorker.postMessage !== 'function') {
      throw new BrowserE2eeWorkerClientError('e2ee_browser_worker_invalid');
    }
    worker = nextWorker;
    generationId = cryptoImpl.randomUUID();
    worker.onmessage = ({ data }) => {
      const entry = pending.get(data?.requestId);
      if (!entry) return;
      pending.delete(data.requestId);
      clearTimeout(entry.timeout);
      if (data.ok) entry.resolve(data.result);
      else entry.reject(new BrowserE2eeWorkerClientError(
        String(data.error || 'e2ee_browser_worker_failed'),
      ));
    };
    worker.onerror = () => terminate('e2ee_browser_worker_crashed');
    worker.onmessageerror = () => terminate('e2ee_browser_worker_message_invalid');
  }

  function send(command, payload = {}) {
    if (!worker || !generationId) {
      return Promise.reject(new BrowserE2eeWorkerClientError('e2ee_browser_worker_not_started'));
    }
    const requestId = `${generationId}:${++requestCounter}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        terminate('e2ee_browser_worker_timeout');
        reject(new BrowserE2eeWorkerClientError('e2ee_browser_worker_timeout'));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timeout });
      worker.postMessage({ ...payload, command, generationId, requestId });
    });
  }

  async function start() {
    spawnWorker();
    return send('initialize', { binding });
  }

  async function runWithSingleRecovery(command, payload) {
    try {
      return await send(command, payload);
    } catch (error) {
      if (![
        'e2ee_browser_worker_crashed',
        'e2ee_browser_worker_message_invalid',
        'e2ee_browser_worker_timeout',
        'e2ee_browser_persistence_failed',
      ].includes(error?.code)) {
        throw error;
      }
    }

    try {
      terminate('e2ee_browser_worker_restarting');
      await start();
      return await send(command, payload);
    } catch (error) {
      blocked = true;
      terminate('e2ee_browser_worker_blocked');
      throw new BrowserE2eeWorkerClientError('e2ee_browser_worker_blocked');
    }
  }

  return {
    async initialize(nextBinding) {
      if (binding || worker) {
        throw new BrowserE2eeWorkerClientError('e2ee_browser_worker_already_initialized');
      }
      binding = nextBinding;
      try {
        return await start();
      } catch (error) {
        if (error?.code !== 'e2ee_browser_worker_crashed') throw error;
        return runWithSingleRecovery('status');
      }
    },

    status() {
      return runWithSingleRecovery('status');
    },

    bootstrap(preKeyCount = 20) {
      return runWithSingleRecovery('bootstrap', { preKeyCount });
    },

    listSessionDevices(payload) {
      return runWithSingleRecovery('listSessionDevices', { payload });
    },

    invalidateRemoteDevice(payload) {
      return runWithSingleRecovery('invalidateRemoteDevice', { payload });
    },

    saveOutbox(payload) {
      return runWithSingleRecovery('saveOutbox', { payload });
    },

    listOutbox() {
      return runWithSingleRecovery('listOutbox');
    },

    removeOutbox(payload) {
      return runWithSingleRecovery('removeOutbox', { payload });
    },

    storeReceivedMessage(payload) {
      return runWithSingleRecovery('storeReceivedMessage', { payload });
    },

    listReceivedMessages(payload) {
      return runWithSingleRecovery('listReceivedMessages', { payload });
    },

    clearReceivedMessages(payload) {
      return runWithSingleRecovery('clearReceivedMessages', { payload });
    },

    encrypt(payload) {
      return runWithSingleRecovery('encrypt', { payload });
    },

    decrypt(payload) {
      return runWithSingleRecovery('decrypt', { payload });
    },

    async revoke() {
      const result = await send('revoke');
      binding = null;
      terminate();
      return result;
    },

    close() {
      binding = null;
      terminate();
    },

    isBlocked() {
      return blocked;
    },
  };
}
