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
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createSocketServer } from './socket/index.js';
import { upsertPushToken } from './services/pushNotifications.js';
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
const DEFAULT_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

function normalizeIceServer(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const urls = Array.isArray(entry.urls)
    ? entry.urls.map((url) => String(url || '').trim()).filter(Boolean)
    : [String(entry.urls || '').trim()].filter(Boolean);
  if (urls.length === 0) return null;

  const normalized = { urls: urls.length === 1 ? urls[0] : urls };
  if (typeof entry.username === 'string' && entry.username.trim()) {
    normalized.username = entry.username.trim();
  }
  if (typeof entry.credential === 'string' && entry.credential.trim()) {
    normalized.credential = entry.credential.trim();
  }
  if (typeof entry.credentialType === 'string' && entry.credentialType.trim()) {
    normalized.credentialType = entry.credentialType.trim();
  }
  return normalized;
}

function parseIceServersJson(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeIceServer).filter(Boolean);
  } catch (error) {
    console.warn('[Pulse][TURN] Ongeldige ICE_SERVERS_JSON, fallback naar STUN:', error?.message || error);
    return [];
  }
}

function parseTurnUrls(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

function buildTurnServerFromEnv() {
  const urls = parseTurnUrls(process.env.TURN_URLS || process.env.WEBRTC_TURN_URLS || '');
  const username = String(process.env.TURN_USERNAME || process.env.WEBRTC_TURN_USERNAME || '').trim();
  const credential = String(process.env.TURN_PASSWORD || process.env.TURN_CREDENTIAL || process.env.WEBRTC_TURN_CREDENTIAL || '').trim();
  if (urls.length === 0 || !username || !credential) return null;
  return {
    urls: urls.length === 1 ? urls[0] : urls,
    username,
    credential,
    credentialType: 'password',
  };
}

function buildIceServersConfig() {
  const configuredIceServers = parseIceServersJson(process.env.ICE_SERVERS_JSON || process.env.WEBRTC_ICE_SERVERS_JSON || '');
  const turnServer = buildTurnServerFromEnv();
  const fromEnv = turnServer ? [...configuredIceServers, turnServer] : configuredIceServers;
  const unique = [];
  const seen = new Set();
  for (const server of fromEnv) {
    const key = JSON.stringify(server);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(server);
  }
  const iceServers = [...unique, ...DEFAULT_STUN_SERVERS];
  const hasTurn = iceServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => typeof url === 'string' && url.toLowerCase().startsWith('turn:'));
  });
  return {
    iceServers,
    hasTurn,
    source: unique.length > 0 ? 'env_configured' : 'backend_fallback',
  };
}

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
app.post('/api/fcm-token', appOnlyCors, requireAppOrigin, requireAuth, async (req, res) => {
  const uid = req.auth?.uid;
  const bodyUid = req.body?.uid;
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const transport = typeof req.body?.transport === 'string' ? req.body.transport : 'fcm_web';
  const platform = typeof req.body?.platform === 'string' ? req.body.platform : 'web';

  if (!uid || uid !== bodyUid) {
    return res.status(403).json({
      ok: false,
      error: 'uid_mismatch',
      requestId: req.requestId,
    });
  }

  if (!token) {
    return res.status(400).json({
      ok: false,
      error: 'missing_token',
      requestId: req.requestId,
    });
  }

  const stored = await upsertPushToken({ uid, token, transport, platform });

  console.info('[Pulse][Push] Token registratie', {
    uid,
    transport,
    platform,
    requestId: req.requestId,
    ok: stored.ok,
  });

  return res.json({
    ok: true,
    stored: !!stored.ok,
    requestId: req.requestId,
  });
});

app.options('/api/turn-credentials', appOnlyCors);
app.get('/api/turn-credentials', appOnlyCors, requireAppOrigin, (_req, res) => {
  const { iceServers, hasTurn, source } = buildIceServersConfig();
  return res.json({
    ok: true,
    iceServers,
    hasTurn,
    source,
    requestId: _req.requestId,
  });
});

app.get('/api/app-update', appOnlyCors, requireAppOrigin, (req, res) => {
  const minimumSupportedVersion = Number.parseInt(String(process.env.MINIMUM_SUPPORTED_ANDROID_VERSION || '').trim(), 10);
  const latestVersion = Number.parseInt(String(process.env.LATEST_ANDROID_VERSION || '').trim(), 10);
  const clientVersionCode = Number.parseInt(String(req.query?.clientVersionCode || '').trim(), 10);

  const hasMin = Number.isFinite(minimumSupportedVersion);
  const hasLatest = Number.isFinite(latestVersion);
  const hasClient = Number.isFinite(clientVersionCode);

  const updateRequired = hasMin && hasClient ? clientVersionCode < minimumSupportedVersion : false;
  const updateAvailable = hasLatest && hasClient ? clientVersionCode < latestVersion : false;

  return res.json({
    ok: true,
    minimumSupportedVersion: hasMin ? minimumSupportedVersion : null,
    latestVersion: hasLatest ? latestVersion : null,
    clientVersionCode: hasClient ? clientVersionCode : null,
    updateRequired,
    updateAvailable,
    requestId: req.requestId,
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
