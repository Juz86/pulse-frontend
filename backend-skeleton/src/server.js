import cors from 'cors';
import express from 'express';
import http from 'http';
import { devicesRouter } from './routes/devices.js';
import { apiMessagesRouter } from './routes/apiMessages.js';
import { attachmentsRouter } from './routes/attachments.js';
import { authRouter } from './routes/auth.js';
import { conversationsRouter } from './routes/conversations.js';
import { contactsRouter } from './routes/contacts.js';
import { friendRequestsRouter } from './routes/friendRequests.js';
import { keysRouter } from './routes/keys.js';
import { messagesRouter } from './routes/messages.js';
import { parentRouter } from './routes/parent.js';
import { callsRouter } from './routes/calls.js';
import { usersRouter } from './routes/users.js';
import { requestContext } from './middleware/requestContext.js';
import { requireFirebaseReady } from './middleware/requireFirebaseReady.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createSocketServer } from './socket/index.js';
import {
  getFirebaseConfigDiagnostics,
  getFirebaseCredentialMode,
} from './services/firebaseConfig.js';
import {
  checkFirestoreReady,
} from './services/firestore.js';

const app = express();
const server = http.createServer(app);
const { io, emitToUser } = createSocketServer(server);
const startedAt = new Date().toISOString();
const e2eeCapabilities = {
  attachmentTransport: 'remote_mock',
  attachmentStrategies: ['mock_media_v1', 'pulse_media_v1'],
  defaultAttachmentStrategy: 'mock_media_v1',
  draftAttachmentStrategy: 'pulse_media_v1',
};

app.use(cors());
app.use(express.json());
app.use(requestContext);

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    requestId: _req.requestId,
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    requestId: _req.requestId,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt,
    firebaseCredentialMode: getFirebaseCredentialMode(),
  });
});

app.get('/configz', (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    requestId: _req.requestId,
    firebase: getFirebaseConfigDiagnostics(),
    e2ee: e2eeCapabilities,
  });
});

app.get('/readyz', async (_req, res) => {
  const firestore = await checkFirestoreReady();

  if (!firestore.ok) {
    return res.status(503).json({
      ok: false,
      service: 'pulse-e2ee-backend-skeleton',
      requestId: _req.requestId,
      firestore,
      firebaseCredentialMode: getFirebaseCredentialMode(),
      firebase: getFirebaseConfigDiagnostics(),
    });
  }

  return res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    requestId: _req.requestId,
    firestore,
    firebaseCredentialMode: getFirebaseCredentialMode(),
    firebase: getFirebaseConfigDiagnostics(),
    e2ee: e2eeCapabilities,
  });
});

app.post('/api/fcm-token', (_req, res) => {
  return res.json({
    ok: true,
    stored: false,
    reason: 'not_implemented_in_backend_skeleton',
    requestId: _req.requestId,
  });
});

app.use('/api/attachments', attachmentsRouter);
app.use('/attachments', attachmentsRouter);
app.use('/api', requireFirebaseReady, authRouter);
app.use('/api/conversations', requireFirebaseReady, conversationsRouter);
app.use('/devices', requireFirebaseReady, devicesRouter);
app.use('/api/contacts', requireFirebaseReady, contactsRouter);
app.use('/api/friend-requests', requireFirebaseReady, friendRequestsRouter({ io, emitToUser }));
app.use('/api/messages', requireFirebaseReady, apiMessagesRouter({ io, emitToUser }));
app.use('/api/users', requireFirebaseReady, usersRouter);
app.use('/users', requireFirebaseReady, keysRouter);
app.use('/messages', requireFirebaseReady, messagesRouter({ io, emitToUser }));
app.use('/calls', requireFirebaseReady, callsRouter);
app.use('/api/parent', requireFirebaseReady, parentRouter);
app.use(errorHandler);

const port = Number(process.env.PORT || 3001);
server.listen(port, () => {
  console.log(`Pulse backend skeleton listening on ${port}`);
});
