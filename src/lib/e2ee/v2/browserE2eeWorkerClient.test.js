import { createBrowserE2eeWorkerClient } from './browserE2eeWorkerClient';

const CONFIGURATION = {
  enabled: true,
  browserEnabled: true,
  mode: 'signal',
  transport: 'v2',
  backendUrl: 'https://e2ee-qa.example.test',
  runtimeBackendUrl: 'https://e2ee-qa.example.test',
};
const BINDING = { uid: 'user-a', deviceId: 'device-a1', signalDeviceId: 7 };

class MockWorker {
  constructor() {
    this.messages = [];
    this.terminated = false;
    this.onPostMessage = null;
  }

  postMessage(message) {
    this.messages.push(message);
    this.onPostMessage?.(message);
  }

  respond(message, result) {
    this.onmessage?.({ data: { requestId: message.requestId, ok: true, result } });
  }

  crash() {
    this.onerror?.(new Error('private details must not cross the boundary'));
  }

  terminate() {
    this.terminated = true;
  }
}

function setup() {
  const workers = [];
  const workerFactory = jest.fn(() => {
    const worker = new MockWorker();
    workers.push(worker);
    return worker;
  });
  let uuid = 0;
  const client = createBrowserE2eeWorkerClient({
    workerFactory,
    configuration: CONFIGURATION,
    cryptoImpl: { randomUUID: () => `generation-${++uuid}` },
    timeoutMs: 1000,
  });
  return { client, workers };
}

function flushAsyncWork() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('browser E2EE worker client', () => {
  test('uses a fresh generation and never sends configuration secrets', async () => {
    const { client, workers } = setup();
    const initializing = client.initialize(BINDING);
    const [message] = workers[0].messages;
    workers[0].respond(message, { initialized: true, providerAvailable: false });

    await expect(initializing).resolves.toMatchObject({ initialized: true });
    expect(message).toMatchObject({
      command: 'initialize',
      generationId: 'generation-1',
      binding: BINDING,
    });
    expect(message).not.toHaveProperty('backendUrl');
  });

  test('restarts once after a crash and ignores the old generation', async () => {
    const { client, workers } = setup();
    const initializing = client.initialize(BINDING);
    workers[0].respond(workers[0].messages[0], { initialized: true });
    await initializing;

    const status = client.status();
    workers[0].crash();
    await flushAsyncWork();
    expect(workers[0].terminated).toBe(true);
    const reinitialize = workers[1].messages[0];
    expect(reinitialize.generationId).toBe('generation-2');
    workers[1].respond(reinitialize, { initialized: true });
    await flushAsyncWork();
    const retriedStatus = workers[1].messages[1];
    workers[1].respond(retriedStatus, { initialized: true });
    await expect(status).resolves.toMatchObject({ initialized: true });
  });

  test('keeps private bootstrap material inside the worker boundary', async () => {
    const { client, workers } = setup();
    const initializing = client.initialize(BINDING);
    workers[0].respond(workers[0].messages[0], { initialized: true });
    await initializing;

    const bootstrapping = client.bootstrap(20);
    const message = workers[0].messages[1];
    expect(message).toMatchObject({ command: 'bootstrap', preKeyCount: 20 });
    expect(message).not.toHaveProperty('identityKeyPair');
    workers[0].respond(message, { identityKey: 'public-key', privateMaterialExportable: false });
    await expect(bootstrapping).resolves.toEqual({
      identityKey: 'public-key',
      privateMaterialExportable: false,
    });
  });

  test('exposes only ciphertext and plaintext operations through the worker client', async () => {
    const { client, workers } = setup();
    const initializing = client.initialize(BINDING);
    workers[0].respond(workers[0].messages[0], { initialized: true });
    await initializing;

    const encryptPayload = { operationId: 'send-1', plaintext: 'hello' };
    const encrypting = client.encrypt(encryptPayload);
    const encryptMessage = workers[0].messages[1];
    expect(encryptMessage).toMatchObject({ command: 'encrypt', payload: encryptPayload });
    workers[0].respond(encryptMessage, { envelopeType: 'prekey', ciphertext: 'encrypted' });
    await expect(encrypting).resolves.toMatchObject({ ciphertext: 'encrypted' });

    const decryptPayload = { operationId: 'receive-1', ciphertext: 'encrypted' };
    const decrypting = client.decrypt(decryptPayload);
    const decryptMessage = workers[0].messages[2];
    expect(decryptMessage).toMatchObject({ command: 'decrypt', payload: decryptPayload });
    workers[0].respond(decryptMessage, { plaintext: 'hello' });
    await expect(decrypting).resolves.toEqual({ plaintext: 'hello' });

    const listing = client.listSessionDevices({ remoteUserId: 'user-b' });
    const listMessage = workers[0].messages[3];
    expect(listMessage).toMatchObject({
      command: 'listSessionDevices',
      payload: { remoteUserId: 'user-b' },
    });
    workers[0].respond(listMessage, {
      devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
    });
    await expect(listing).resolves.toEqual({
      devices: [{ deviceId: 'device-b1', signalDeviceId: 2, identityVersion: 1 }],
    });
  });

  test('blocks after the single recovery also crashes', async () => {
    const { client, workers } = setup();
    const initializing = client.initialize(BINDING);
    workers[0].respond(workers[0].messages[0], { initialized: true });
    await initializing;

    const status = client.status();
    workers[0].crash();
    await flushAsyncWork();
    workers[1].respond(workers[1].messages[0], { initialized: true });
    await flushAsyncWork();
    workers[1].crash();
    await expect(status).rejects.toMatchObject({ code: 'e2ee_browser_worker_blocked' });
    expect(client.isBlocked()).toBe(true);
  });

  test('refuses to start unless the browser QA gate is enabled', () => {
    expect(() => createBrowserE2eeWorkerClient({
      workerFactory: () => new MockWorker(),
      configuration: { ...CONFIGURATION, browserEnabled: false },
      cryptoImpl: { randomUUID: () => 'generation-1' },
    })).toThrow('e2ee_browser_qa_disabled');
  });
});
