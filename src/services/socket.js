// src/services/socket.js
// Verbinding met de backend via Socket.IO + WebRTC bellen

import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { RTC_CONFIG_URL, SIGNALING_URL } from '../config/runtimeConfig';
import { resolveBackendUrl } from '../lib/backendUrl';

export const BACKEND_URL = resolveBackendUrl();
export const SOCKET_URL = SIGNALING_URL || BACKEND_URL;

// ICE servers worden opgehaald van de backend (credentials nooit in de bundle)
let _iceServers = null;
let _iceServersExpiry = 0;
const TURN_REQUEST_TIMEOUT_MS = 5000;
const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

async function getIceServers(authToken, onFallback) {
  if (_iceServers && Date.now() < _iceServersExpiry) return _iceServers;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TURN_REQUEST_TIMEOUT_MS);
  try {
    const token = authToken || socket?.auth?.token;
    const res = await fetch(`${RTC_CONFIG_URL}/api/turn-credentials`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    if (res.ok) {
      const { iceServers } = await res.json();
      if (!Array.isArray(iceServers) || iceServers.length === 0) {
        throw new Error('Geen TURN-servers ontvangen');
      }
      _iceServers = iceServers;
      _iceServersExpiry = Date.now() + 3600_000; // 1 uur cache
      return iceServers;
    }
  } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  finally { clearTimeout(timeoutId); }
  // Fallback: alleen STUN als backend niet bereikbaar
  onFallback?.('Verbinding is beperkt. Bellen kan op mobiel netwerk minder stabiel zijn.');
  return FALLBACK_ICE_SERVERS;
}

let socket            = null;
let peer              = null;
let iceHandler        = null;
let renegotiateHandler = null;
let videoUpgradeHandler = null;
let callPeer          = null; // bewaar de remote uid voor renegotiatie
let callAnswerHandler = null;
let callEndedHandler = null;
let callDeclinedHandler = null;
let callUnavailableHandler = null;
let callBusyHandler = null;
let activeCallTimeoutId = null;
let currentCallSessionId = null;
let currentCallState = 'idle';

const ACTIVE_CALL_STATES = new Set(['ringing', 'connecting', 'connected', 'reconnecting']);

function buildCallSessionId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function setCallState(nextState, context = {}) {
  if (currentCallState === nextState) return;
  const prevState = currentCallState;
  currentCallState = nextState;
  console.info('[Pulse][Call] state', {
    from: prevState,
    to: nextState,
    sessionId: currentCallSessionId,
    ...context,
  });
}

function isSessionEventCurrent(sessionId) {
  return !!sessionId && !!currentCallSessionId && sessionId === currentCallSessionId;
}

function logIgnoredSessionEvent(eventName, sessionId) {
  console.info('[Pulse][Call] ignore stale event', {
    event: eventName,
    sessionId,
    activeSessionId: currentCallSessionId,
    state: currentCallState,
  });
}

export function getCurrentCallSessionId() {
  return currentCallSessionId;
}

export function isCallInProgress() {
  return ACTIVE_CALL_STATES.has(currentCallState);
}

export function registerIncomingRingingSession(sessionId, fromUid) {
  if (!sessionId) return false;
  if (isCallInProgress() && currentCallSessionId && currentCallSessionId !== sessionId) return false;
  currentCallSessionId = sessionId;
  callPeer = fromUid || callPeer;
  setCallState('ringing', { source: 'incoming_offer', fromUid: fromUid || null });
  return true;
}

export function rejectCallAsBusy(toUid, sessionId) {
  if (!toUid) return;
  socket?.emit('call:busy', { to: toUid, sessionId: sessionId || currentCallSessionId || null });
}

export function clearIncomingRingingSession(sessionId = null, reason = 'incoming_cancelled') {
  if (currentCallState !== 'ringing') return;
  if (sessionId && currentCallSessionId && sessionId !== currentCallSessionId) return;
  currentCallSessionId = null;
  callPeer = null;
  setCallState('idle', { source: reason });
}

function buildPreferredAudioConstraints() {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

function buildPreferredVideoConstraints() {
  return {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: 'user',
  };
}

async function requestCallMedia({ isVideo = false } = {}) {
  const attempts = [
    {
      audio: buildPreferredAudioConstraints(),
      video: isVideo ? buildPreferredVideoConstraints() : false,
    },
    {
      audio: true,
      video: isVideo ? { facingMode: 'user' } : false,
    },
    {
      audio: true,
      video: !!isVideo,
    },
  ];

  let lastError = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Kan microfoon/camera niet starten.');
}

function clearCallLifecycleHandlers() {
  if (activeCallTimeoutId) {
    clearTimeout(activeCallTimeoutId);
    activeCallTimeoutId = null;
  }
  if (callAnswerHandler) {
    socket?.off('call:answer', callAnswerHandler);
    callAnswerHandler = null;
  }
  if (callEndedHandler) {
    socket?.off('call:ended', callEndedHandler);
    callEndedHandler = null;
  }
  if (callDeclinedHandler) {
    socket?.off('call:declined', callDeclinedHandler);
    callDeclinedHandler = null;
  }
  if (callUnavailableHandler) {
    socket?.off('call:unavailable', callUnavailableHandler);
    callUnavailableHandler = null;
  }
  if (callBusyHandler) {
    socket?.off('call:busy', callBusyHandler);
    callBusyHandler = null;
  }
}

async function ensureSocketConnection() {
  if (!socket) {
    throw new Error('Signaleringsverbinding niet beschikbaar. Vernieuw de pagina en probeer opnieuw.');
  }
  if (socket.connected) return socket;

  socket.connect();

  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Signaleringsverbinding kon niet worden hersteld. Probeer het opnieuw.'));
    }, 5000);

    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onConnectError = () => {
      cleanup();
      reject(new Error('Signalering verbinden mislukt. Controleer je verbinding en probeer opnieuw.'));
    };
    const cleanup = () => {
      clearTimeout(timeoutId);
      socket?.off('connect', onConnect);
      socket?.off('connect_error', onConnectError);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
  });

  return socket;
}

// ── Socket verbinden ──────────────────────────────────────────────────────────
export function connectSocket(uid, token) {
  if (socket) {
    if (token) socket.auth = { ...(socket.auth || {}), token };
    if (socket.connected) {
      setTimeout(() => socket.emit('user:online'), 0);
      return socket;
    }
    socket.connect();
    return socket;
  }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
    timeout: 10000,
  });
  socket.on('connect', () => {
    if (isCallInProgress()) setCallState('connecting', { source: 'socket_reconnect_success' });
    socket.emit('user:online');
  });
  socket.on('connect_error', (error) => {
    console.warn('[Pulse] Socket connect_error:', error?.message || error);
  });
  socket.on('reconnect_attempt', (attempt) => {
    if (isCallInProgress()) setCallState('reconnecting', { source: 'socket_reconnect_attempt', attempt });
    console.warn('[Pulse] Socket reconnect_attempt:', attempt);
  });
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// ── WebRTC Bellen ─────────────────────────────────────────────────────────────
export async function startCall({ toUid, fromUid, callerName, isVideo, onStream, onEnd, onVideoUpgrade, onVideoUpgradeRequest, onConnectionFallback }) {
  if (isCallInProgress()) {
    throw new Error('Er is al een actief gesprek. Rond het huidige gesprek eerst af.');
  }
  await ensureSocketConnection();
  currentCallSessionId = buildCallSessionId();
  setCallState('connecting', { source: 'start_call', toUid, isVideo: !!isVideo });
  let stream;
  try {
    stream = await requestCallMedia({ isVideo });
  } catch (e) {
    const msg = e.name === 'NotAllowedError'
      ? 'Toegang tot microfoon/camera geweigerd. Geef toestemming in je browser.'
      : 'Kan microfoon/camera niet starten: ' + e.message;
    setCallState('failed', { source: 'media_access_failed', message: e.message });
    currentCallSessionId = null;
    onEnd?.();
    throw new Error(msg);
  }

  callPeer = toUid;
  const iceServers = await getIceServers(undefined, onConnectionFallback);
  clearCallLifecycleHandlers();

  peer = new SimplePeer({
    initiator: true,
    trickle: true,
    stream,
    config: { iceServers }
  });

  let callActive = false;
  const sessionId = currentCallSessionId;

  peer.on('signal', (data) => {
    if (data.type === 'offer' && !callActive) {
      socket.emit('call:offer', { to: toUid, from: fromUid, offer: data, isVideo, callerName, sessionId });
    } else if (data.type === 'offer' && callActive) {
      // Renegotiatie (bijv. video upgraden)
      socket.emit('call:renegotiate', { to: toUid, signal: data, sessionId });
    } else if (data.type === 'answer') {
      socket.emit('call:renegotiate', { to: toUid, signal: data, sessionId });
    } else {
      socket.emit('call:ice-candidate', { to: toUid, candidate: data, sessionId });
    }
  });

  peer.on('stream', (remoteStream) => {
    if (!isSessionEventCurrent(sessionId)) return;
    callActive = true;
    setCallState('connected', { source: 'remote_stream' });
    onStream?.(remoteStream, stream);
  });

  // Nieuwe tracks na renegotiatie (video upgrade)
  peer.on('track', (track, streams) => {
    if (!isSessionEventCurrent(sessionId)) return;
    if (streams?.[0]) { callActive = true; setCallState('connected', { source: 'remote_track' }); onStream?.(streams[0], stream); }
  });

  // Remote vraagt video upgrade: laat de gebruiker zelf beslissen
  if (videoUpgradeHandler) { socket.off('call:video-upgrade', videoUpgradeHandler); }
  videoUpgradeHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:video-upgrade', incomingSessionId);
      return;
    }
    onVideoUpgradeRequest?.();
  };
  socket.on('call:video-upgrade', videoUpgradeHandler);

  let callEnded = false;
  function fireOnEnd(reason) {
    if (callEnded) return;
    callEnded = true;
    onEnd?.(reason);
  }

  peer.on('close', () => { fireOnEnd(); setCallState('ended', { source: 'peer_close' }); cleanupCall(stream, sessionId); });
  peer.on('error', (e) => { console.warn('[Pulse] Fout: WebRTC error:', e.message); setCallState('failed', { source: 'peer_error', message: e.message }); fireOnEnd(); cleanupCall(stream, sessionId); });

  // ICE candidates ontvangen — oude handler eerst verwijderen
  if (iceHandler) { socket.off('call:ice-candidate', iceHandler); }
  iceHandler = ({ candidate, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:ice-candidate', incomingSessionId);
      return;
    }
    peer?.signal(candidate);
  };
  socket.on('call:ice-candidate', iceHandler);

  // Renegotiatie ontvangen — opgeslagen referentie zodat cleanup specifiek kan verwijderen
  if (renegotiateHandler) { socket.off('call:renegotiate', renegotiateHandler); }
  renegotiateHandler = ({ signal, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:renegotiate', incomingSessionId);
      return;
    }
    peer?.signal(signal);
  };
  socket.on('call:renegotiate', renegotiateHandler);

  // Time-out: als na 30s geen antwoord, gesprek beëindigen
  // onCallAnswer bewaren zodat we de once-listener kunnen verwijderen bij timeout
  callAnswerHandler = ({ answer, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:answer', incomingSessionId);
      return;
    }
    clearTimeout(callTimeout);
    callActive = true;
    setCallState('connected', { source: 'answer_received' });
    peer?.signal(answer);
  };
  socket.on('call:answer', callAnswerHandler);

  const callTimeout = setTimeout(() => {
    clearCallLifecycleHandlers();
    socket.emit('call:end', { to: toUid, sessionId });
    setCallState('failed', { source: 'answer_timeout' });
    fireOnEnd('timeout');
    cleanupCall(stream, sessionId);
  }, 30000);
  activeCallTimeoutId = callTimeout;

  callEndedHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:ended', incomingSessionId); return; }
    clearCallLifecycleHandlers();
    setCallState('ended', { source: 'remote_end' });
    fireOnEnd();
    cleanupCall(stream, sessionId);
  };
  callDeclinedHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:declined', incomingSessionId); return; }
    clearCallLifecycleHandlers();
    setCallState('ended', { source: 'remote_declined' });
    fireOnEnd('declined');
    cleanupCall(stream, sessionId);
  };
  callUnavailableHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:unavailable', incomingSessionId); return; }
    clearCallLifecycleHandlers();
    setCallState('failed', { source: 'remote_unavailable' });
    fireOnEnd('unavailable');
    cleanupCall(stream, sessionId);
  };
  callBusyHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:busy', incomingSessionId); return; }
    clearCallLifecycleHandlers();
    setCallState('failed', { source: 'remote_busy' });
    fireOnEnd('busy');
    cleanupCall(stream, sessionId);
  };

  socket.on('call:ended', callEndedHandler);
  socket.on('call:declined', callDeclinedHandler);
  socket.on('call:unavailable', callUnavailableHandler);
  socket.on('call:busy', callBusyHandler);

  return stream;
}

export async function answerCall({ fromUid, offer, sessionId: incomingSessionId = null, isVideo, onStream, onEnd, onVideoUpgrade, onVideoUpgradeRequest, onConnectionFallback }) {
  if (isCallInProgress() && currentCallSessionId && incomingSessionId && currentCallSessionId !== incomingSessionId) {
    throw new Error('Er is al een actief gesprek. Weiger eerst het huidige gesprek.');
  }
  await ensureSocketConnection();
  const sessionId = incomingSessionId || currentCallSessionId || buildCallSessionId();
  currentCallSessionId = sessionId;
  setCallState('connecting', { source: 'answer_call', fromUid, isVideo: !!isVideo });
  let stream;
  try {
    stream = await requestCallMedia({ isVideo });
  } catch (e) {
    const msg = e.name === 'NotAllowedError'
      ? 'Toegang tot microfoon/camera geweigerd. Geef toestemming in je browser.'
      : 'Kan microfoon/camera niet starten: ' + e.message;
    setCallState('failed', { source: 'media_access_failed', message: e.message });
    currentCallSessionId = null;
    onEnd?.();
    throw new Error(msg);
  }

  callPeer = fromUid;
  const iceServers = await getIceServers(undefined, onConnectionFallback);
  clearCallLifecycleHandlers();

  peer = new SimplePeer({
    initiator: false,
    trickle: true,
    stream,
    config: { iceServers }
  });
  peer.signal(offer);

  peer.on('signal', (data) => {
    if (data.type === 'answer') {
      socket.emit('call:answer', { to: fromUid, answer: data, sessionId });
    } else if (data.type === 'offer') {
      socket.emit('call:renegotiate', { to: fromUid, signal: data, sessionId });
    } else {
      socket.emit('call:ice-candidate', { to: fromUid, candidate: data, sessionId });
    }
  });

  peer.on('stream', (remoteStream) => {
    if (!isSessionEventCurrent(sessionId)) return;
    setCallState('connected', { source: 'remote_stream' });
    onStream?.(remoteStream, stream);
  });

  // Nieuwe tracks na renegotiatie (video upgrade)
  peer.on('track', (track, streams) => {
    if (!isSessionEventCurrent(sessionId)) return;
    if (streams?.[0]) { setCallState('connected', { source: 'remote_track' }); onStream?.(streams[0], stream); }
  });

  // Remote vraagt video upgrade: laat de gebruiker zelf beslissen
  if (videoUpgradeHandler) { socket.off('call:video-upgrade', videoUpgradeHandler); }
  videoUpgradeHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:video-upgrade', incomingSessionId);
      return;
    }
    onVideoUpgradeRequest?.();
  };
  socket.on('call:video-upgrade', videoUpgradeHandler);

  peer.on('close', () => { setCallState('ended', { source: 'peer_close' }); onEnd?.(); cleanupCall(stream, sessionId); });
  peer.on('error', (e) => { console.warn('[Pulse] Fout: WebRTC error:', e.message); setCallState('failed', { source: 'peer_error', message: e.message }); onEnd?.(); cleanupCall(stream, sessionId); });

  // ICE candidates ontvangen — oude handler eerst verwijderen
  if (iceHandler) { socket.off('call:ice-candidate', iceHandler); }
  iceHandler = ({ candidate, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:ice-candidate', incomingSessionId);
      return;
    }
    peer?.signal(candidate);
  };
  socket.on('call:ice-candidate', iceHandler);

  // Renegotiatie ontvangen — opgeslagen referentie
  if (renegotiateHandler) { socket.off('call:renegotiate', renegotiateHandler); }
  renegotiateHandler = ({ signal, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:renegotiate', incomingSessionId);
      return;
    }
    peer?.signal(signal);
  };
  socket.on('call:renegotiate', renegotiateHandler);

  callEndedHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:ended', incomingSessionId); return; }
    clearCallLifecycleHandlers();
    setCallState('ended', { source: 'remote_end' });
    onEnd?.();
    cleanupCall(stream, sessionId);
  };
  socket.on('call:ended', callEndedHandler);

  return stream;
}

export function endCall(toUid, sessionId = null) {
  socket?.emit('call:end', { to: toUid, sessionId: sessionId || currentCallSessionId || null });
  setCallState('ended', { source: 'local_end' });
  cleanupCall();
}

export function declineCall(fromUid, sessionId = null) {
  const outgoingSessionId = sessionId || currentCallSessionId || null;
  socket?.emit('call:decline', { to: fromUid, sessionId: outgoingSessionId });
  setCallState('ended', { source: 'local_decline' });
  cleanupCall();
}

// ── Video upgraden tijdens actief gesprek ─────────────────────────────────────
export async function acceptVideoUpgrade() {
  if (!peer) return null;
  try {
    const vs = await navigator.mediaDevices.getUserMedia({
      video: buildPreferredVideoConstraints(),
    }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }))
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
    peer.addTrack(vs.getVideoTracks()[0], vs);
    return vs;
  } catch (e) {
    console.warn('[Pulse] Fout: Video upgrade accepteren mislukt:', e.message);
    return null;
  }
}

export async function upgradeToVideo() {
  if (!peer) return null;
  try {
    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: buildPreferredVideoConstraints(),
    }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }))
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
    const videoTrack = videoStream.getVideoTracks()[0];
    peer.addTrack(videoTrack, videoStream);
    // Vertel remote kant ook camera te starten
    if (callPeer) socket.emit('call:video-upgrade', { to: callPeer, sessionId: currentCallSessionId || null });
    return videoStream;
  } catch (e) {
    console.warn('[Pulse] Fout: Video upgraden mislukt:', e.message);
    return null;
  }
}

function cleanupCall(stream, sessionId = null) {
  if (sessionId && currentCallSessionId && sessionId !== currentCallSessionId) return;
  clearCallLifecycleHandlers();
  peer?.destroy();
  peer = null;
  callPeer = null;
  currentCallSessionId = null;
  setCallState('idle', { source: 'cleanup' });
  stream?.getTracks().forEach(t => t.stop());
  if (iceHandler)         { socket?.off('call:ice-candidate', iceHandler);   iceHandler = null; }
  if (renegotiateHandler) { socket?.off('call:renegotiate',   renegotiateHandler); renegotiateHandler = null; }
  if (videoUpgradeHandler){ socket?.off('call:video-upgrade', videoUpgradeHandler); videoUpgradeHandler = null; }
}
