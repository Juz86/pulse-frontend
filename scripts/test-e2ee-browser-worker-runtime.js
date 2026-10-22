const { existsSync, readFileSync, statSync } = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const chromeDriverCandidates = [
  process.env.CHROMEDRIVER_BIN,
  '/usr/bin/chromedriver',
].filter(Boolean);
const chromeDriver = chromeDriverCandidates.find(existsSync);

if (!chromeDriver) throw new Error('ChromeDriver is vereist voor de browserworker-smoketest.');

const testPage = `<!doctype html>
<html><body data-result="pending">pending<script type="module">
const timeout = setTimeout(() => finish('timeout'), 60000);
const bindingA = { uid: 'browser-user-a', deviceId: 'browser-device-a', signalDeviceId: 1 };
const bindingB = { uid: 'browser-user-b', deviceId: 'browser-device-b', signalDeviceId: 2 };
const devices = {};

function finish(value) {
  clearTimeout(timeout);
  document.body.dataset.result = value;
  document.body.textContent = value;
  Object.values(devices).forEach(({ worker }) => worker?.terminate());
}

function spawn(name, binding, generation) {
  const worker = new Worker('/src/lib/e2ee/v2/browserE2eeWorker.js', { type: 'module' });
  const pending = new Map();
  worker.onerror = () => finish('worker-error-' + name);
  worker.onmessage = ({ data }) => {
    const request = pending.get(data?.requestId);
    if (!request) return;
    pending.delete(data.requestId);
    if (data.ok) request.resolve(data.result);
    else request.reject(new Error(data.error || 'worker-failed'));
  };
  let requestNumber = 0;
  const device = {
    worker,
    binding,
    generation,
    request(command, payload = {}) {
      const requestId = name + '-' + (++requestNumber);
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        worker.postMessage({ command, generationId: generation, requestId, ...payload });
      });
    },
  };
  devices[name] = device;
  return device;
}

function claimedBundle(bundle) {
  return { ...bundle, oneTimePreKey: bundle.oneTimePreKeys[0] };
}

async function run() {
  let deviceA = spawn('a1', bindingA, 'generation-a1');
  let deviceB = spawn('b1', bindingB, 'generation-b1');
  const [statusA, statusB] = await Promise.all([
    deviceA.request('initialize', { binding: bindingA }),
    deviceB.request('initialize', { binding: bindingB }),
  ]);
  if (!statusA.wasmReady || !statusB.wasmReady
    || statusA.storage?.wrappingKeyExtractable !== false
    || statusB.storage?.wrappingKeyExtractable !== false) throw new Error('invalid-status');

  const [bundleA, bundleB] = await Promise.all([
    deviceA.request('bootstrap', { preKeyCount: 3 }),
    deviceB.request('bootstrap', { preKeyCount: 3 }),
  ]);
  const sendA = {
    operationId: 'send-a-1',
    remoteUserId: bindingB.uid,
    remoteDeviceId: bindingB.deviceId,
    remoteSignalDeviceId: bindingB.signalDeviceId,
    remoteIdentityVersion: 1,
    plaintext: 'hello from browser A',
    remoteBundle: claimedBundle(bundleB),
  };
  const envelopeA = await deviceA.request('encrypt', { payload: sendA });
  const retriedEnvelopeA = await deviceA.request('encrypt', { payload: sendA });
  if (envelopeA.envelopeType !== 'prekey'
    || JSON.stringify(envelopeA) !== JSON.stringify(retriedEnvelopeA)) {
    throw new Error('encrypt-idempotency-failed');
  }
  const receiveB = await deviceB.request('decrypt', { payload: {
    operationId: 'receive-b-1',
    remoteUserId: bindingA.uid,
    remoteDeviceId: bindingA.deviceId,
    remoteSignalDeviceId: bindingA.signalDeviceId,
    remoteIdentityVersion: 1,
    envelopeType: envelopeA.envelopeType,
    ciphertext: envelopeA.ciphertext,
  } });
  if (receiveB.plaintext !== sendA.plaintext) throw new Error('first-decrypt-failed');
  await deviceA.request('saveOutbox', { payload: {
    clientMessageId: 'browser-outbox-1',
    message: {
      conversationId: 'browser-conversation-1',
      clientMessageId: 'browser-outbox-1',
      senderDeviceId: bindingA.deviceId,
      messageType: 'text',
      recipientEnvelopes: [{
        recipientUserId: bindingB.uid,
        recipientDeviceId: bindingB.deviceId,
        envelopeType: envelopeA.envelopeType,
        ciphertext: envelopeA.ciphertext,
      }],
    },
    expectedRecipientDevices: [{ userId: bindingB.uid, deviceId: bindingB.deviceId }],
  } });
  await deviceB.request('storeReceivedMessage', { payload: {
    conversationId: 'browser-conversation-1',
    messageId: 'browser-inbox-1',
    senderUserId: bindingA.uid,
    senderDeviceId: bindingA.deviceId,
    plaintext: 'browser-inbox-secret-marker',
  } });

  deviceA.worker.terminate();
  deviceB.worker.terminate();
  deviceA = spawn('a2', bindingA, 'generation-a2');
  deviceB = spawn('b2', bindingB, 'generation-b2');
  const [restoredA, restoredB] = await Promise.all([
    deviceA.request('initialize', { binding: bindingA }),
    deviceB.request('initialize', { binding: bindingB }),
  ]);
  if (!restoredA.bootstrapped || !restoredB.bootstrapped) {
    throw new Error('session-rehydrate-failed');
  }
  const [sessionsA, sessionsB] = await Promise.all([
    deviceA.request('listSessionDevices', { payload: { remoteUserId: bindingB.uid } }),
    deviceB.request('listSessionDevices', { payload: { remoteUserId: bindingA.uid } }),
  ]);
  if (sessionsA.devices?.[0]?.deviceId !== bindingB.deviceId
    || sessionsB.devices?.[0]?.deviceId !== bindingA.deviceId) {
    throw new Error('session-routing-metadata-failed');
  }
  const [outboxA, inboxB] = await Promise.all([
    deviceA.request('listOutbox'),
    deviceB.request('listReceivedMessages', {
      payload: { conversationId: 'browser-conversation-1' },
    }),
  ]);
  if (outboxA.messages?.[0]?.message?.clientMessageId !== 'browser-outbox-1'
    || inboxB.messages?.[0]?.plaintext !== 'browser-inbox-secret-marker') {
    throw new Error('offline-storage-rehydrate-failed');
  }
  await deviceA.request('removeOutbox', {
    payload: { clientMessageId: 'browser-outbox-1' },
  });
  const emptiedOutbox = await deviceA.request('listOutbox');
  if (emptiedOutbox.messages?.length !== 0) throw new Error('outbox-remove-failed');

  const sendB = {
    operationId: 'send-b-2',
    remoteUserId: bindingA.uid,
    remoteDeviceId: bindingA.deviceId,
    remoteSignalDeviceId: bindingA.signalDeviceId,
    remoteIdentityVersion: 1,
    plaintext: 'reply after worker restart',
  };
  const envelopeB = await deviceB.request('encrypt', { payload: sendB });
  if (envelopeB.envelopeType !== 'message') throw new Error('restored-session-not-used');
  const receiveA = await deviceA.request('decrypt', { payload: {
    operationId: 'receive-a-2',
    remoteUserId: bindingB.uid,
    remoteDeviceId: bindingB.deviceId,
    remoteSignalDeviceId: bindingB.signalDeviceId,
    remoteIdentityVersion: 1,
    envelopeType: envelopeB.envelopeType,
    ciphertext: envelopeB.ciphertext,
  } });
  if (receiveA.plaintext !== sendB.plaintext) throw new Error('restored-decrypt-failed');
  const invalidated = await deviceA.request('invalidateRemoteDevice', { payload: {
    remoteUserId: bindingB.uid,
    remoteDeviceId: bindingB.deviceId,
    remoteSignalDeviceId: bindingB.signalDeviceId,
    remoteIdentityVersion: 2,
    revoked: false,
  } });
  if (invalidated.invalidated !== true) throw new Error('session-invalidation-failed');
  deviceA.worker.terminate();
  deviceA = spawn('a3', bindingA, 'generation-a3');
  const restoredAfterInvalidation = await deviceA.request('initialize', { binding: bindingA });
  if (!restoredAfterInvalidation.bootstrapped) throw new Error('invalidation-restart-failed');
  const invalidatedSessions = await deviceA.request('listSessionDevices', {
    payload: { remoteUserId: bindingB.uid },
  });
  if (invalidatedSessions.devices?.length !== 0) {
    throw new Error('invalidated-session-rehydrated');
  }
  finish('ok');
}

run().catch((error) => finish('failed-' + error.message));
</script></body></html>`;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
};

function resolveRequestPath(requestPath) {
  const cleanPath = decodeURIComponent(requestPath.split('?')[0]);
  const relativePath = cleanPath.replace(/^\/+/, '');
  const candidate = path.resolve(projectRoot, relativePath);
  if (!candidate.startsWith(`${projectRoot}${path.sep}`)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (existsSync(`${candidate}.js`) && statSync(`${candidate}.js`).isFile()) return `${candidate}.js`;
  return null;
}

const requestedPaths = [];
const server = http.createServer((request, response) => {
  requestedPaths.push(request.url);
  if (request.url === '/__pulse_e2ee_worker_test__') {
    response.writeHead(200, { 'Content-Type': mimeTypes['.html'] });
    response.end(testPage);
    return;
  }
  const filePath = resolveRequestPath(request.url || '');
  if (!filePath) {
    response.writeHead(404);
    response.end('not found');
    return;
  }
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
  });
  response.end(readFileSync(filePath));
});
function driverRequest(port, method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: payload ? {
        'Content-Length': Buffer.byteLength(payload),
        'Content-Type': 'application/json',
      } : {},
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.end(payload);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForDriver(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const status = await driverRequest(port, 'GET', '/status');
      if (status?.value?.ready) return;
    } catch {
      // ChromeDriver may still be binding its local port.
    }
    await delay(100);
  }
  throw new Error('ChromeDriver startte niet op tijd.');
}

server.listen(0, '127.0.0.1', async () => {
  const serverPort = server.address().port;
  const driverPort = 9516;
  const driver = spawn(chromeDriver, [`--port=${driverPort}`, '--allowed-ips=127.0.0.1'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let driverErrors = '';
  driver.stderr.on('data', (chunk) => { driverErrors += chunk; });
  let sessionId = null;
  try {
    await waitForDriver(driverPort);
    const session = await driverRequest(driverPort, 'POST', '/session', {
      capabilities: {
        alwaysMatch: {
          browserName: 'chrome',
          'goog:chromeOptions': {
            args: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
          },
        },
      },
    });
    sessionId = session?.value?.sessionId || session?.sessionId;
    if (!sessionId) throw new Error(`ChromeDriver sessie mislukt: ${JSON.stringify(session)}`);
    await driverRequest(driverPort, 'POST', `/session/${sessionId}/url`, {
      url: `http://127.0.0.1:${serverPort}/__pulse_e2ee_worker_test__`,
    });

    let result = 'pending';
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && result === 'pending') {
      const response = await driverRequest(driverPort, 'POST', `/session/${sessionId}/execute/sync`, {
        script: 'return document.body && document.body.dataset.result;',
        args: [],
      });
      result = response?.value || 'pending';
      if (result === 'pending') await delay(100);
    }
    if (result !== 'ok') throw new Error(`Browserworker resultaat: ${result}`);
    console.log('E2EE browser module worker runtime: OK');
  } catch (error) {
    console.error(error.message);
    console.error(driverErrors.trim());
    console.error(`Requested paths: ${requestedPaths.join(', ')}`);
    process.exitCode = 1;
  } finally {
    if (sessionId) {
      try {
        await driverRequest(driverPort, 'DELETE', `/session/${sessionId}`);
      } catch {
        // The browser may already be gone after a fatal worker error.
      }
    }
    driver.kill();
    server.close();
  }
});
