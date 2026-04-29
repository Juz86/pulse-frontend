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
    socket.emit('user:online');
  });
  socket.on('connect_error', (error) => {
    console.warn('[Pulse] Socket connect_error:', error?.message || error);
  });
  socket.on('reconnect_attempt', (attempt) => {
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
  await ensureSocketConnection();
  let stream;
  try {
    stream = await requestCallMedia({ isVideo });
  } catch (e) {
    const msg = e.name === 'NotAllowedError'
      ? 'Toegang tot microfoon/camera geweigerd. Geef toestemming in je browser.'
      : 'Kan microfoon/camera niet starten: ' + e.message;
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

  peer.on('signal', (data) => {
    if (data.type === 'offer' && !callActive) {
      socket.emit('call:offer', { to: toUid, from: fromUid, offer: data, isVideo, callerName });
    } else if (data.type === 'offer' && callActive) {
      // Renegotiatie (bijv. video upgraden)
      socket.emit('call:renegotiate', { to: toUid, signal: data });
    } else if (data.type === 'answer') {
      socket.emit('call:renegotiate', { to: toUid, signal: data });
    } else {
      socket.emit('call:ice-candidate', { to: toUid, candidate: data });
    }
  });

  peer.on('stream', (remoteStream) => {
    callActive = true;
    onStream?.(remoteStream, stream);
  });

  // Nieuwe tracks na renegotiatie (video upgrade)
  peer.on('track', (track, streams) => {
    if (streams?.[0]) { callActive = true; onStream?.(streams[0], stream); }
  });

  // Remote vraagt video upgrade: laat de gebruiker zelf beslissen
  if (videoUpgradeHandler) { socket.off('call:video-upgrade', videoUpgradeHandler); }
  videoUpgradeHandler = () => { onVideoUpgradeRequest?.(); };
  socket.on('call:video-upgrade', videoUpgradeHandler);

  let callEnded = false;
  function fireOnEnd(reason) {
    if (callEnded) return;
    callEnded = true;
    onEnd?.(reason);
  }

  peer.on('close', () => { fireOnEnd(); cleanupCall(stream); });
  peer.on('error', (e) => { console.warn('[Pulse] Fout: WebRTC error:', e.message); fireOnEnd(); cleanupCall(stream); });

  // ICE candidates ontvangen — oude handler eerst verwijderen
  if (iceHandler) { socket.off('call:ice-candidate', iceHandler); }
  iceHandler = ({ candidate }) => { peer?.signal(candidate); };
  socket.on('call:ice-candidate', iceHandler);

  // Renegotiatie ontvangen — opgeslagen referentie zodat cleanup specifiek kan verwijderen
  if (renegotiateHandler) { socket.off('call:renegotiate', renegotiateHandler); }
  renegotiateHandler = ({ signal }) => { peer?.signal(signal); };
  socket.on('call:renegotiate', renegotiateHandler);

  // Time-out: als na 30s geen antwoord, gesprek beëindigen
  // onCallAnswer bewaren zodat we de once-listener kunnen verwijderen bij timeout
  callAnswerHandler = ({ answer }) => {
    clearTimeout(callTimeout);
    callActive = true;
    peer?.signal(answer);
  };
  socket.on('call:answer', callAnswerHandler);

  const callTimeout = setTimeout(() => {
    clearCallLifecycleHandlers();
    socket.emit('call:end', { to: toUid });
    fireOnEnd('timeout');
    cleanupCall(stream);
  }, 30000);
  activeCallTimeoutId = callTimeout;

  callEndedHandler = () => { clearCallLifecycleHandlers(); fireOnEnd(); cleanupCall(stream); };
  callDeclinedHandler = () => { clearCallLifecycleHandlers(); fireOnEnd('declined'); cleanupCall(stream); };
  callUnavailableHandler = () => { clearCallLifecycleHandlers(); fireOnEnd('unavailable'); cleanupCall(stream); };
  callBusyHandler = () => { clearCallLifecycleHandlers(); fireOnEnd('busy'); cleanupCall(stream); };

  socket.on('call:ended', callEndedHandler);
  socket.on('call:declined', callDeclinedHandler);
  socket.on('call:unavailable', callUnavailableHandler);
  socket.on('call:busy', callBusyHandler);

  return stream;
}

export async function answerCall({ fromUid, offer, isVideo, onStream, onEnd, onVideoUpgrade, onVideoUpgradeRequest, onConnectionFallback }) {
  await ensureSocketConnection();
  let stream;
  try {
    stream = await requestCallMedia({ isVideo });
  } catch (e) {
    const msg = e.name === 'NotAllowedError'
      ? 'Toegang tot microfoon/camera geweigerd. Geef toestemming in je browser.'
      : 'Kan microfoon/camera niet starten: ' + e.message;
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
      socket.emit('call:answer', { to: fromUid, answer: data });
    } else if (data.type === 'offer') {
      socket.emit('call:renegotiate', { to: fromUid, signal: data });
    } else {
      socket.emit('call:ice-candidate', { to: fromUid, candidate: data });
    }
  });

  peer.on('stream', (remoteStream) => {
    onStream?.(remoteStream, stream);
  });

  // Nieuwe tracks na renegotiatie (video upgrade)
  peer.on('track', (track, streams) => {
    if (streams?.[0]) onStream?.(streams[0], stream);
  });

  // Remote vraagt video upgrade: laat de gebruiker zelf beslissen
  if (videoUpgradeHandler) { socket.off('call:video-upgrade', videoUpgradeHandler); }
  videoUpgradeHandler = () => { onVideoUpgradeRequest?.(); };
  socket.on('call:video-upgrade', videoUpgradeHandler);

  peer.on('close', () => { onEnd?.(); cleanupCall(stream); });
  peer.on('error', (e) => { console.warn('[Pulse] Fout: WebRTC error:', e.message); onEnd?.(); cleanupCall(stream); });

  // ICE candidates ontvangen — oude handler eerst verwijderen
  if (iceHandler) { socket.off('call:ice-candidate', iceHandler); }
  iceHandler = ({ candidate }) => { peer?.signal(candidate); };
  socket.on('call:ice-candidate', iceHandler);

  // Renegotiatie ontvangen — opgeslagen referentie
  if (renegotiateHandler) { socket.off('call:renegotiate', renegotiateHandler); }
  renegotiateHandler = ({ signal }) => { peer?.signal(signal); };
  socket.on('call:renegotiate', renegotiateHandler);

  callEndedHandler = () => { clearCallLifecycleHandlers(); onEnd?.(); cleanupCall(stream); };
  socket.on('call:ended', callEndedHandler);

  return stream;
}

export function endCall(toUid) {
  socket?.emit('call:end', { to: toUid });
  cleanupCall();
}

export function declineCall(fromUid) {
  socket?.emit('call:decline', { to: fromUid });
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
    if (callPeer) socket.emit('call:video-upgrade', { to: callPeer });
    return videoStream;
  } catch (e) {
    console.warn('[Pulse] Fout: Video upgraden mislukt:', e.message);
    return null;
  }
}

function cleanupCall(stream) {
  clearCallLifecycleHandlers();
  peer?.destroy();
  peer = null;
  callPeer = null;
  stream?.getTracks().forEach(t => t.stop());
  if (iceHandler)         { socket?.off('call:ice-candidate', iceHandler);   iceHandler = null; }
  if (renegotiateHandler) { socket?.off('call:renegotiate',   renegotiateHandler); renegotiateHandler = null; }
  if (videoUpgradeHandler){ socket?.off('call:video-upgrade', videoUpgradeHandler); videoUpgradeHandler = null; }
}
