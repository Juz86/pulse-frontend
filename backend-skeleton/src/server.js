import cors from 'cors';
import express from 'express';
import http from 'http';
import { devicesRouter } from './routes/devices.js';
import { keysRouter } from './routes/keys.js';
import { messagesRouter } from './routes/messages.js';
import { parentRouter } from './routes/parent.js';
import { callsRouter } from './routes/calls.js';
import { createSocketServer } from './socket/index.js';
import {
  checkFirestoreReady,
  getFirebaseConfigDiagnostics,
  getFirebaseCredentialMode,
} from './services/firestore.js';

const app = express();
const server = http.createServer(app);
const { io, emitToUser } = createSocketServer(server);
const startedAt = new Date().toISOString();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    uptimeSeconds: Math.round(process.uptime()),
    startedAt,
    firebaseCredentialMode: getFirebaseCredentialMode(),
  });
});

app.get('/configz', (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    firebase: getFirebaseConfigDiagnostics(),
  });
});

app.get('/readyz', async (_req, res) => {
  const firestore = await checkFirestoreReady();

  if (!firestore.ok) {
    return res.status(503).json({
      ok: false,
      service: 'pulse-e2ee-backend-skeleton',
      firestore,
      firebaseCredentialMode: getFirebaseCredentialMode(),
      firebase: getFirebaseConfigDiagnostics(),
    });
  }

  return res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    firestore,
    firebaseCredentialMode: getFirebaseCredentialMode(),
    firebase: getFirebaseConfigDiagnostics(),
  });
});

app.use('/devices', devicesRouter);
app.use('/users', keysRouter);
app.use('/messages', messagesRouter({ io, emitToUser }));
app.use('/calls', callsRouter);
app.use('/api/parent', parentRouter);

const port = Number(process.env.PORT || 3001);
server.listen(port, () => {
  console.log(`Pulse backend skeleton listening on ${port}`);
});
