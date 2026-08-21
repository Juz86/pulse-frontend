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
      const { iceServers, hasTurn, source } = await res.json();
      if (!Array.isArray(iceServers) || iceServers.length === 0) {
        throw new Error('Geen TURN-servers ontvangen');
      }
      const turnDetected = iceServers.some((server) => {
        const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
        return urls.some((url) => typeof url === 'string' && url.toLowerCase().startsWith('turn:'));
      });
      if (!turnDetected) {
        console.warn('[Pulse][Call] TURN ontbreekt in backend ICE-config; STUN-only fallback actief', {
          source: source || 'unknown',
          hasTurn: Boolean(hasTurn),
        });
      } else {
        console.info('[Pulse][Call] ICE-config met TURN geladen', {
          source: source || 'unknown',
          serverCount: iceServers.length,
        });
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
let activeLocalStream = null;
let activeRemoteStream = null;
let pendingRemoteIceCandidates = [];
let remoteDescriptionReady = false;

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

function describeSession(sessionId = null) {
  return sessionId || currentCallSessionId || null;
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

function bindPeerConnectionDebugHandlers(peerInstance, sessionId) {
  const pc = peerInstance?._pc;
  if (!pc) return () => {};

  const onConnectionStateChange = () => {
    console.info('[Pulse][Call] connectionState', {
      sessionId: describeSession(sessionId),
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
    });
    if (pc.connectionState === 'connected') {
      setCallState('connected', { source: 'pc_connectionstate_connected' });
    } else if (pc.connectionState === 'failed') {
      setCallState('failed', { source: 'pc_connectionstate_failed' });
    } else if (pc.connectionState === 'disconnected') {
      setCallState('reconnecting', { source: 'pc_connectionstate_disconnected' });
    } else if (pc.connectionState === 'connecting') {
      setCallState('connecting', { source: 'pc_connectionstate_connecting' });
    }
  };

  const onIceConnectionStateChange = () => {
    console.info('[Pulse][Call] iceConnectionState', {
      sessionId: describeSession(sessionId),
      iceConnectionState: pc.iceConnectionState,
      connectionState: pc.connectionState,
    });
    if (pc.iceConnectionState === 'failed') {
      setCallState('failed', { source: 'pc_ice_failed' });
    } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'checking') {
      setCallState('reconnecting', { source: 'pc_ice_reconnecting' });
    } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      setCallState('connected', { source: 'pc_ice_connected' });
    }
  };

  pc.addEventListener('connectionstatechange', onConnectionStateChange);
  pc.addEventListener('iceconnectionstatechange', onIceConnectionStateChange);

  return () => {
    pc.removeEventListener('connectionstatechange', onConnectionStateChange);
    pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange);
  };
}

function queueRemoteIceCandidate(candidate, sessionId, source = 'unknown') {
  pendingRemoteIceCandidates.push(candidate);
  console.info('[Pulse][Call] ice buffered', {
    sessionId: describeSession(sessionId),
    source,
    bufferedCount: pendingRemoteIceCandidates.length,
  });
}

function flushRemoteIceCandidates(sessionId) {
  if (!peer || pendingRemoteIceCandidates.length === 0) return;
  const flushCount = pendingRemoteIceCandidates.length;
  pendingRemoteIceCandidates.forEach((candidate) => {
    try {
      peer.signal(candidate);
    } catch (error) {
      console.warn('[Pulse][Call] ICE flush mislukt:', error?.message || error);
    }
  });
  pendingRemoteIceCandidates = [];
  console.info('[Pulse][Call] ice flushed', {
    sessionId: describeSession(sessionId),
    flushedCount: flushCount,
  });
}

function markRemoteDescriptionReady(sessionId, source = 'unknown') {
  remoteDescriptionReady = true;
  console.info('[Pulse][Call] remoteDescription set', {
    sessionId: describeSession(sessionId),
    source,
  });
  flushRemoteIceCandidates(sessionId);
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
  if (peer) {
    const previousSessionId = currentCallSessionId;
    cleanupCall(null, previousSessionId);
  }
  currentCallSessionId = buildCallSessionId();
  setCallState('connecting', { source: 'start_call', toUid, isVideo: !!isVideo });
  pendingRemoteIceCandidates = [];
  remoteDescriptionReady = false;
  activeRemoteStream = null;
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
  activeLocalStream = stream;
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
  const detachPeerDebug = bindPeerConnectionDebugHandlers(peer, sessionId);

  peer.on('signal', (data) => {
    if (data.type === 'offer' && !callActive) {
      console.info('[Pulse][Call] offer created', { sessionId });
      socket.emit('call:offer', { to: toUid, from: fromUid, offer: data, isVideo, callerName, sessionId });
    } else if (data.type === 'offer' && callActive) {
      // Renegotiatie (bijv. video upgraden)
      socket.emit('call:renegotiate', { to: toUid, signal: data, sessionId });
    } else if (data.type === 'answer') {
      console.info('[Pulse][Call] answer created (renegotiate)', { sessionId });
      socket.emit('call:renegotiate', { to: toUid, signal: data, sessionId });
    } else {
      console.info('[Pulse][Call] ice sent', { sessionId });
      socket.emit('call:ice-candidate', { to: toUid, candidate: data, sessionId });
    }
  });

  peer.on('stream', (remoteStream) => {
    if (!isSessionEventCurrent(sessionId)) return;
    callActive = true;
    activeRemoteStream = remoteStream;
    setCallState('connected', { source: 'remote_stream' });
    onStream?.(remoteStream, stream);
  });

  // Nieuwe tracks na renegotiatie (video upgrade)
  peer.on('track', (track, streams) => {
    if (!isSessionEventCurrent(sessionId)) return;
    if (streams?.[0]) {
      callActive = true;
      activeRemoteStream = streams[0];
      setCallState('connected', { source: 'remote_track' });
      onStream?.(streams[0], stream);
    }
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

  peer.on('close', () => {
    detachPeerDebug();
    fireOnEnd();
    setCallState('ended', { source: 'peer_close' });
    cleanupCall(stream, sessionId);
  });
  peer.on('error', (e) => {
    detachPeerDebug();
    console.warn('[Pulse] Fout: WebRTC error:', e.message);
    setCallState('failed', { source: 'peer_error', message: e.message });
    fireOnEnd();
    cleanupCall(stream, sessionId);
  });

  // ICE candidates ontvangen — oude handler eerst verwijderen
  if (iceHandler) { socket.off('call:ice-candidate', iceHandler); }
  iceHandler = ({ candidate, fromUid, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:ice-candidate', incomingSessionId);
      return;
    }
    if (fromUid && callPeer && fromUid !== callPeer) {
      console.info('[Pulse][Call] ignore candidate from unexpected peer', {
        sessionId: describeSession(incomingSessionId),
        fromUid,
        expectedFromUid: callPeer,
      });
      return;
    }
    if (!remoteDescriptionReady) {
      queueRemoteIceCandidate(candidate, incomingSessionId, 'start_call');
      return;
    }
    console.info('[Pulse][Call] ice received', { sessionId: describeSession(incomingSessionId), source: 'start_call' });
    try {
      peer?.signal(candidate);
    } catch (error) {
      console.warn('[Pulse][Call] ICE signal toepassen mislukt:', error?.message || error);
    }
  };
  socket.on('call:ice-candidate', iceHandler);

  // Renegotiatie ontvangen — opgeslagen referentie zodat cleanup specifiek kan verwijderen
  if (renegotiateHandler) { socket.off('call:renegotiate', renegotiateHandler); }
  renegotiateHandler = ({ signal, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:renegotiate', incomingSessionId);
      return;
    }
    try {
      peer?.signal(signal);
    } catch (error) {
      console.warn('[Pulse][Call] Renegotiate signal toepassen mislukt:', error?.message || error);
    }
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
    try {
      peer?.signal(answer);
      markRemoteDescriptionReady(incomingSessionId, 'answer_received');
    } catch (error) {
      console.warn('[Pulse][Call] Answer signal toepassen mislukt:', error?.message || error);
      setCallState('failed', { source: 'answer_apply_failed' });
      fireOnEnd('failed');
      cleanupCall(stream, sessionId);
    }
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
    detachPeerDebug();
    clearCallLifecycleHandlers();
    setCallState('ended', { source: 'remote_end' });
    fireOnEnd();
    cleanupCall(stream, sessionId);
  };
  callDeclinedHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:declined', incomingSessionId); return; }
    detachPeerDebug();
    clearCallLifecycleHandlers();
    setCallState('ended', { source: 'remote_declined' });
    fireOnEnd('declined');
    cleanupCall(stream, sessionId);
  };
  callUnavailableHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:unavailable', incomingSessionId); return; }
    detachPeerDebug();
    clearCallLifecycleHandlers();
    setCallState('failed', { source: 'remote_unavailable' });
    fireOnEnd('unavailable');
    cleanupCall(stream, sessionId);
  };
  callBusyHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:busy', incomingSessionId); return; }
    detachPeerDebug();
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
  if (peer) {
    const previousSessionId = currentCallSessionId;
    cleanupCall(null, previousSessionId);
  }
  const sessionId = incomingSessionId || currentCallSessionId || buildCallSessionId();
  currentCallSessionId = sessionId;
  setCallState('connecting', { source: 'answer_call', fromUid, isVideo: !!isVideo });
  pendingRemoteIceCandidates = [];
  remoteDescriptionReady = false;
  activeRemoteStream = null;
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
  activeLocalStream = stream;
  const iceServers = await getIceServers(undefined, onConnectionFallback);
  clearCallLifecycleHandlers();

  peer = new SimplePeer({
    initiator: false,
    trickle: true,
    stream,
    config: { iceServers }
  });
  const detachPeerDebug = bindPeerConnectionDebugHandlers(peer, sessionId);
  try {
    peer.signal(offer);
    markRemoteDescriptionReady(sessionId, 'incoming_offer_applied');
  } catch (error) {
    detachPeerDebug();
    console.warn('[Pulse][Call] Offer signal toepassen mislukt:', error?.message || error);
    setCallState('failed', { source: 'offer_apply_failed' });
    onEnd?.('failed');
    cleanupCall(stream, sessionId);
    throw new Error('Oproep kon niet worden geaccepteerd.');
  }

  peer.on('signal', (data) => {
    if (data.type === 'answer') {
      console.info('[Pulse][Call] answer created', { sessionId });
      socket.emit('call:answer', { to: fromUid, answer: data, sessionId });
    } else if (data.type === 'offer') {
      socket.emit('call:renegotiate', { to: fromUid, signal: data, sessionId });
    } else {
      console.info('[Pulse][Call] ice sent', { sessionId });
      socket.emit('call:ice-candidate', { to: fromUid, candidate: data, sessionId });
    }
  });

  peer.on('stream', (remoteStream) => {
    if (!isSessionEventCurrent(sessionId)) return;
    activeRemoteStream = remoteStream;
    setCallState('connected', { source: 'remote_stream' });
    onStream?.(remoteStream, stream);
  });

  // Nieuwe tracks na renegotiatie (video upgrade)
  peer.on('track', (track, streams) => {
    if (!isSessionEventCurrent(sessionId)) return;
    if (streams?.[0]) {
      activeRemoteStream = streams[0];
      setCallState('connected', { source: 'remote_track' });
      onStream?.(streams[0], stream);
    }
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

  peer.on('close', () => {
    detachPeerDebug();
    setCallState('ended', { source: 'peer_close' });
    onEnd?.();
    cleanupCall(stream, sessionId);
  });
  peer.on('error', (e) => {
    detachPeerDebug();
    console.warn('[Pulse] Fout: WebRTC error:', e.message);
    setCallState('failed', { source: 'peer_error', message: e.message });
    onEnd?.();
    cleanupCall(stream, sessionId);
  });

  // ICE candidates ontvangen — oude handler eerst verwijderen
  if (iceHandler) { socket.off('call:ice-candidate', iceHandler); }
  iceHandler = ({ candidate, fromUid, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:ice-candidate', incomingSessionId);
      return;
    }
    if (fromUid && callPeer && fromUid !== callPeer) {
      console.info('[Pulse][Call] ignore candidate from unexpected peer', {
        sessionId: describeSession(incomingSessionId),
        fromUid,
        expectedFromUid: callPeer,
      });
      return;
    }
    if (!remoteDescriptionReady) {
      queueRemoteIceCandidate(candidate, incomingSessionId, 'answer_call');
      return;
    }
    console.info('[Pulse][Call] ice received', { sessionId: describeSession(incomingSessionId), source: 'answer_call' });
    try {
      peer?.signal(candidate);
    } catch (error) {
      console.warn('[Pulse][Call] ICE signal toepassen mislukt:', error?.message || error);
    }
  };
  socket.on('call:ice-candidate', iceHandler);

  // Renegotiatie ontvangen — opgeslagen referentie
  if (renegotiateHandler) { socket.off('call:renegotiate', renegotiateHandler); }
  renegotiateHandler = ({ signal, sessionId: incomingSessionId }) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) {
      logIgnoredSessionEvent('call:renegotiate', incomingSessionId);
      return;
    }
    try {
      peer?.signal(signal);
    } catch (error) {
      console.warn('[Pulse][Call] Renegotiate signal toepassen mislukt:', error?.message || error);
    }
  };
  socket.on('call:renegotiate', renegotiateHandler);

  callEndedHandler = ({ sessionId: incomingSessionId } = {}) => {
    if (incomingSessionId && !isSessionEventCurrent(incomingSessionId)) { logIgnoredSessionEvent('call:ended', incomingSessionId); return; }
    detachPeerDebug();
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

export async function switchCameraTrack(localStream, nextFacingMode = 'environment') {
  if (!peer || !localStream) return { ok: false, reason: 'call_not_active' };
  const oldTrack = localStream.getVideoTracks?.()[0];
  if (!oldTrack) return { ok: false, reason: 'no_video_track' };

  const oldSettings = oldTrack.getSettings?.() || {};
  const oldDeviceId = oldSettings.deviceId || '';
  const oldFacingMode = oldSettings.facingMode || '';
  const isEnvironmentCamera = (device) => /back|rear|environment|world/i.test(device?.label || '');
  const isUserCamera = (device) => /front|user|face/i.test(device?.label || '');

  try {
    // `facingMode: { ideal: ... }` mag dezelfde camera teruggeven. Kies daarom,
    // zodra Android de camera's kan benoemen, expliciet een andere videoinput.
    // Zo blijft de WebRTC-sessie actief terwijl alleen de videotrack wisselt.
    let alternativeCamera = null;
    if (typeof navigator.mediaDevices?.enumerateDevices === 'function') {
      const cameras = (await navigator.mediaDevices.enumerateDevices())
        .filter((device) => device.kind === 'videoinput' && device.deviceId && device.deviceId !== oldDeviceId);

      if (cameras.length) {
        alternativeCamera = nextFacingMode === 'environment'
          ? cameras.find(isEnvironmentCamera)
          : cameras.find(isUserCamera);
        alternativeCamera = alternativeCamera || cameras[0];
      } else if (oldDeviceId) {
        return { ok: false, reason: 'no_alternative_camera' };
      }
    }

    const videoConstraints = alternativeCamera
      ? {
        deviceId: { exact: alternativeCamera.deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      }
      : {
        // Wanneer de browser geen apparaatlijst beschikbaar stelt, is exact de
        // veiligste fallback: de oproep blijft ongewijzigd als die camera niet
        // bestaat, in plaats van stilletjes dezelfde camera te houden.
        facingMode: { exact: nextFacingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      };
    const replacementStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
    const newTrack = replacementStream.getVideoTracks?.()[0];
    if (!newTrack) {
      replacementStream.getTracks?.().forEach((track) => track.stop());
      return { ok: false, reason: 'replacement_track_missing' };
    }

    const newSettings = newTrack.getSettings?.() || {};
    const isSameDevice = Boolean(oldDeviceId && newSettings.deviceId && oldDeviceId === newSettings.deviceId);
    const isSameFacing = Boolean(
      oldFacingMode && newSettings.facingMode && oldFacingMode === newSettings.facingMode
    );
    if (isSameDevice || (!alternativeCamera && isSameFacing)) {
      newTrack.stop();
      replacementStream.getTracks?.().forEach((track) => track.stop());
      return { ok: false, reason: 'same_camera' };
    }

    if (typeof peer.replaceTrack !== 'function') {
      replacementStream.getTracks?.().forEach((track) => track.stop());
      return { ok: false, reason: 'replace_track_unsupported' };
    }

    const nextEnabled = oldTrack.enabled;
    // simple-peer koppelt dit aan de bestaande RTCRtpSender. Daardoor blijven
    // audio, timer en de peerverbinding doorlopen zonder heronderhandeling.
    peer.replaceTrack(oldTrack, newTrack, localStream);
    localStream.removeTrack(oldTrack);
    localStream.addTrack(newTrack);
    newTrack.enabled = nextEnabled;
    oldTrack.stop();
    activeLocalStream = localStream;

    replacementStream.getAudioTracks?.().forEach((track) => track.stop());
    return {
      ok: true,
      facingMode: newSettings.facingMode || nextFacingMode,
      deviceId: newSettings.deviceId || alternativeCamera?.deviceId || '',
    };
  } catch (error) {
    console.warn('[Pulse][Call] Camera wisselen mislukt:', error?.message || error);
    return { ok: false, reason: error?.name || 'switch_failed' };
  }
}

function cleanupCall(stream, sessionId = null) {
  if (sessionId && currentCallSessionId && sessionId !== currentCallSessionId) return;
  clearCallLifecycleHandlers();
  try {
    peer?._pc?.close?.();
  } catch (error) {
    console.warn('[Pulse][Call] peer.close mislukt:', error?.message || error);
  }
  peer?.destroy();
  peer = null;
  callPeer = null;
  remoteDescriptionReady = false;
  pendingRemoteIceCandidates = [];
  currentCallSessionId = null;
  setCallState('idle', { source: 'cleanup' });
  (stream || activeLocalStream)?.getTracks?.().forEach((track) => track.stop());
  activeLocalStream = null;
  activeRemoteStream?.getTracks?.().forEach((track) => track.stop());
  activeRemoteStream = null;
  if (iceHandler)         { socket?.off('call:ice-candidate', iceHandler);   iceHandler = null; }
  if (renegotiateHandler) { socket?.off('call:renegotiate',   renegotiateHandler); renegotiateHandler = null; }
  if (videoUpgradeHandler){ socket?.off('call:video-upgrade', videoUpgradeHandler); videoUpgradeHandler = null; }
  console.info('[Pulse][Call] cleanup completed');
}
