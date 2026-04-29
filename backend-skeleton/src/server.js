import express from 'express';
import http from 'http';
import { devicesRouter } from './routes/devices.js';
import { apiMessagesRouter } from './routes/apiMessages.js';
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
import {
  appOnlyCors,
  requireAppOrigin,
  securityHeaders,
} from './services/httpSecurity.js';

const app = express();
const server = http.createServer(app);
const { io, emitToUser } = createSocketServer(server);
const startedAt = new Date().toISOString();

app.use(securityHeaders);
app.use(express.json());
app.use(requestContext);

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    requestId: _req.requestId,
  });
});

app.get('/health', appOnlyCors, (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    requestId: _req.requestId,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt,
    firebaseCredentialMode: getFirebaseCredentialMode(),
  });
});

app.get('/configz', appOnlyCors, (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    requestId: _req.requestId,
    firebase: getFirebaseConfigDiagnostics(),
  });
});

app.get('/runtimez', appOnlyCors, (_req, res) => {
  res.json({
    ok: true,
    service: 'pulse-e2ee-backend-skeleton',
    requestId: _req.requestId,
    nodeEnv: process.env.NODE_ENV || 'development',
    firebaseCredentialMode: getFirebaseCredentialMode(),
    firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST || null,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || null,
  });
});

app.get('/readyz', appOnlyCors, async (_req, res) => {
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
  });
});

app.options(/^\/(api|devices|users|messages|calls)(\/.*)?$/, appOnlyCors);

app.options('/api/fcm-token', appOnlyCors);
app.post('/api/fcm-token', appOnlyCors, requireAppOrigin, (_req, res) => {
  return res.json({
    ok: true,
    stored: false,
    reason: 'not_implemented_in_backend_skeleton',
    requestId: _req.requestId,
  });
});

app.options('/api/turn-credentials', appOnlyCors);
app.get('/api/turn-credentials', appOnlyCors, requireAppOrigin, (_req, res) => {
  return res.json({
    ok: true,
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
    source: 'backend_fallback',
    requestId: _req.requestId,
  });
});

app.use('/api', appOnlyCors, requireAppOrigin, requireFirebaseReady, authRouter);
app.use('/api/conversations', appOnlyCors, requireAppOrigin, requireFirebaseReady, conversationsRouter);
app.use('/devices', appOnlyCors, requireAppOrigin, requireFirebaseReady, devicesRouter);
app.use('/api/contacts', appOnlyCors, requireAppOrigin, requireFirebaseReady, contactsRouter);
app.use('/api/friend-requests', appOnlyCors, requireAppOrigin, requireFirebaseReady, friendRequestsRouter({ io, emitToUser }));
app.use('/api/messages', appOnlyCors, requireAppOrigin, requireFirebaseReady, apiMessagesRouter({ io, emitToUser }));
app.use('/api/users', appOnlyCors, requireAppOrigin, requireFirebaseReady, usersRouter);
app.use('/users', appOnlyCors, requireAppOrigin, requireFirebaseReady, keysRouter);
app.use('/messages', appOnlyCors, requireAppOrigin, requireFirebaseReady, messagesRouter({ io, emitToUser }));
app.use('/calls', appOnlyCors, requireAppOrigin, requireFirebaseReady, callsRouter);
app.use('/api/parent', appOnlyCors, requireAppOrigin, requireFirebaseReady, parentRouter);
app.use(errorHandler);

const port = Number(process.env.PORT || 3001);
server.listen(port, () => {
  console.log(`Pulse backend skeleton listening on ${port}`);
});
