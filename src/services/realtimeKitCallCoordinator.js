import { getSocket } from './socket';
import {
  fetchRealtimeKitCallCredentials,
  REALTIMEKIT_CALL_ENGINE,
  startRealtimeKitCall,
} from './realtimeKitCalling';

export const REALTIMEKIT_CALL_STATES = Object.freeze({
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  RINGING: 'RINGING',
  CONNECTING: 'CONNECTING',
  ACTIVE: 'ACTIVE',
  ENDING: 'ENDING',
  ENDED: 'ENDED',
  FAILED: 'FAILED',
});

const SIGNAL_ACK_TIMEOUT_MS = 8_000;
const RING_TIMEOUT_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const LIVE_STATES = new Set([
  REALTIMEKIT_CALL_STATES.PREPARING,
  REALTIMEKIT_CALL_STATES.RINGING,
  REALTIMEKIT_CALL_STATES.CONNECTING,
  REALTIMEKIT_CALL_STATES.ACTIVE,
  REALTIMEKIT_CALL_STATES.ENDING,
]);

let activeCoordinator = null;

function buildSessionId() {
  const random = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
  return `call_${Date.now()}_${random}`;
}

function isMatchingSession(payload, sessionId) {
  return !payload?.sessionId || payload.sessionId === sessionId;
}

function waitForConnectedSocket(socket) {
  if (!socket) return Promise.reject(new Error('Signaleringsverbinding is niet beschikbaar.'));
  if (socket.connected) return Promise.resolve(socket);
  socket.connect?.();
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Signaleringsverbinding kon niet worden hersteld.'));
    }, 5_000);
    const onConnect = () => { cleanup(); resolve(socket); };
    const onError = () => { cleanup(); reject(new Error('Signaleringsverbinding is mislukt.')); };
    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off?.('connect', onConnect);
      socket.off?.('connect_error', onError);
    };
    socket.on?.('connect', onConnect);
    socket.on?.('connect_error', onError);
  });
}

function emitWithAcknowledgement(socket, event, payload, timeoutMs = SIGNAL_ACK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error('De oproepserver reageerde niet op tijd.')),
      timeoutMs,
    );
    socket.emit(event, payload, (acknowledgement = {}) => {
      clearTimeout(timeoutId);
      if (!acknowledgement.ok) {
        const error = new Error(
          acknowledgement.error === 'busy'
            ? 'Contactpersoon is in gesprek.'
            : 'De oproep kon niet worden gestart.',
        );
        error.code = acknowledgement.error || 'signaling_rejected';
        reject(error);
        return;
      }
      resolve(acknowledgement);
    });
  });
}

export function createRealtimeKitCallCoordinator({
  socket,
  fetchCredentials = fetchRealtimeKitCallCredentials,
  startMedia = startRealtimeKitCall,
  onStateChange,
  onRemoteStream,
  onEnd,
  onReleased,
}) {
  let state = REALTIMEKIT_CALL_STATES.IDLE;
  let sessionId = null;
  let peerUid = null;
  let mediaCall = null;
  let ringTimeoutId = null;
  let heartbeatIntervalId = null;
  let released = false;
  const listeners = [];

  const transition = (nextState, context = {}) => {
    state = nextState;
    onStateChange?.(nextState, { sessionId, peerUid, ...context });
  };

  const listen = (event, handler) => {
    socket.on(event, handler);
    listeners.push([event, handler]);
  };

  const clearTimers = () => {
    clearTimeout(ringTimeoutId);
    clearInterval(heartbeatIntervalId);
    ringTimeoutId = null;
    heartbeatIntervalId = null;
  };

  const release = async (reason, finalState = REALTIMEKIT_CALL_STATES.ENDED) => {
    if (released) return;
    released = true;
    clearTimers();
    listeners.splice(0).forEach(([event, handler]) => socket.off?.(event, handler));
    try { await mediaCall?.leave?.(); } catch (error) {
      console.warn('[Pulse][CallV2] Media afsluiten mislukt:', error?.message || error);
    }
    mediaCall = null;
    transition(finalState, { reason });
    onEnd?.(reason);
    onReleased?.();
  };

  const startHeartbeat = () => {
    clearInterval(heartbeatIntervalId);
    const send = () => socket.emit('call:heartbeat', { sessionId, to: peerUid });
    send();
    heartbeatIntervalId = setInterval(send, HEARTBEAT_INTERVAL_MS);
  };

  const bindLifecycle = () => {
    listen('call:ended', (payload = {}) => {
      if (isMatchingSession(payload, sessionId)) release(payload.reason || 'remote_end');
    });
    listen('call:declined', (payload = {}) => {
      if (isMatchingSession(payload, sessionId)) release('declined');
    });
    listen('call:busy', (payload = {}) => {
      if (isMatchingSession(payload, sessionId)) release('busy', REALTIMEKIT_CALL_STATES.FAILED);
    });
    listen('call:unavailable', (payload = {}) => {
      if (isMatchingSession(payload, sessionId)) release(payload.reason || 'unavailable', REALTIMEKIT_CALL_STATES.FAILED);
    });
    listen('call:heartbeat:ack', (payload = {}) => {
      if (payload.active === false && isMatchingSession(payload, sessionId)) {
        release('expired', REALTIMEKIT_CALL_STATES.FAILED);
      }
    });
    listen('connect', () => {
      if (state === REALTIMEKIT_CALL_STATES.ACTIVE) {
        socket.emit('call:resume', { sessionId, to: peerUid, needsAnswer: false });
      }
    });
  };

  const joinMedia = async ({ idToken, name, picture, isVideo }) => {
    const credentials = await fetchCredentials({ sessionId, idToken, name, picture });
    mediaCall = await startMedia({
      authToken: credentials.authToken,
      isVideo: Boolean(isVideo),
      onRemoteStream: (stream, participant) => {
        transition(REALTIMEKIT_CALL_STATES.ACTIVE, { source: 'remote_media' });
        startHeartbeat();
        onRemoteStream?.(stream, mediaCall?.getLocalStream?.(), participant);
      },
      onError: (error) => {
        console.warn('[Pulse][CallV2] RealtimeKit-fout:', error?.message || error);
      },
    });
    return mediaCall;
  };

  const coordinator = {
    get state() { return state; },
    get sessionId() { return sessionId; },
    get peerUid() { return peerUid; },
    isLive() { return LIVE_STATES.has(state); },
    getLocalStream() { return mediaCall?.getLocalStream?.() || null; },
    getRemoteStreams() { return mediaCall?.getRemoteStreams?.() || new Map(); },
    setMicrophoneEnabled(enabled) { return mediaCall?.setMicrophoneEnabled?.(enabled); },
    setCameraEnabled(enabled) { return mediaCall?.setCameraEnabled?.(enabled); },

    async startOutgoing({ toUid, callerName, isVideo, idToken, picture }) {
      if (state !== REALTIMEKIT_CALL_STATES.IDLE) throw new Error('Er is al een actief gesprek.');
      await waitForConnectedSocket(socket);
      sessionId = buildSessionId();
      peerUid = toUid;
      transition(REALTIMEKIT_CALL_STATES.PREPARING);
      bindLifecycle();
      listen('call:answer', (payload = {}) => {
        if (!isMatchingSession(payload, sessionId) || payload.answer?.engine !== REALTIMEKIT_CALL_ENGINE) return;
        clearTimeout(ringTimeoutId);
        transition(REALTIMEKIT_CALL_STATES.CONNECTING, { source: 'answer_received' });
        startHeartbeat();
      });
      try {
        await emitWithAcknowledgement(socket, 'call:offer', {
          to: toUid,
          callerName,
          isVideo: Boolean(isVideo),
          sessionId,
          offer: { engine: REALTIMEKIT_CALL_ENGINE },
        });
        await joinMedia({ idToken, name: callerName, picture, isVideo });
        transition(REALTIMEKIT_CALL_STATES.RINGING);
        ringTimeoutId = setTimeout(() => coordinator.end('timeout'), RING_TIMEOUT_MS);
        return coordinator;
      } catch (error) {
        await release(error.code || 'start_failed', REALTIMEKIT_CALL_STATES.FAILED);
        throw error;
      }
    },

    async answerIncoming({ incoming, idToken, name, picture }) {
      if (state !== REALTIMEKIT_CALL_STATES.IDLE) throw new Error('Er is al een actief gesprek.');
      await waitForConnectedSocket(socket);
      sessionId = incoming.sessionId;
      peerUid = incoming.from || incoming.fromUid;
      transition(REALTIMEKIT_CALL_STATES.PREPARING);
      bindLifecycle();
      try {
        await joinMedia({ idToken, name, picture, isVideo: incoming.isVideo });
        await emitWithAcknowledgement(socket, 'call:answer', {
          to: peerUid,
          sessionId,
          answer: { engine: REALTIMEKIT_CALL_ENGINE },
        });
        transition(REALTIMEKIT_CALL_STATES.ACTIVE, { source: 'local_answer' });
        startHeartbeat();
        return coordinator;
      } catch (error) {
        await release(error.code || 'answer_failed', REALTIMEKIT_CALL_STATES.FAILED);
        throw error;
      }
    },

    decline() {
      if (peerUid) socket.emit('call:decline', { to: peerUid, sessionId });
      return release('declined');
    },

    async end(reason = 'local_end') {
      if (!LIVE_STATES.has(state)) return;
      transition(REALTIMEKIT_CALL_STATES.ENDING, { reason });
      if (peerUid) socket.emit('call:end', { to: peerUid, sessionId });
      await release(reason);
    },
  };
  return coordinator;
}

function claimCoordinator(options) {
  if (activeCoordinator?.isLive()) throw new Error('Er is al een actief gesprek.');
  const coordinator = createRealtimeKitCallCoordinator({
    ...options,
    socket: options.socket || getSocket(),
    onReleased: () => {
      if (activeCoordinator === coordinator) activeCoordinator = null;
      options.onReleased?.();
    },
  });
  activeCoordinator = coordinator;
  return coordinator;
}

export function isRealtimeKitV2Offer(call = {}) {
  return call.callEngine === REALTIMEKIT_CALL_ENGINE || call.offer?.engine === REALTIMEKIT_CALL_ENGINE;
}

export function isRealtimeKitCallInProgress() {
  return Boolean(activeCoordinator?.isLive());
}

export async function startOutgoingRealtimeKitCall(options) {
  const coordinator = claimCoordinator(options);
  return coordinator.startOutgoing(options);
}

export async function answerIncomingRealtimeKitCall(options) {
  const coordinator = claimCoordinator(options);
  return coordinator.answerIncoming(options);
}
