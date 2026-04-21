// src/services/socket.js
// Verbinding met de backend via Socket.IO + WebRTC bellen

import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { RTC_CONFIG_URL, SIGNALING_URL } from '../config/appConfig';
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

// ── Socket verbinden ──────────────────────────────────────────────────────────
export function connectSocket(uid, token) {
  if (socket?.connected) {
    setTimeout(() => socket.emit('user:online'), 0);
    return socket;
  }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
    timeout: 10000,
  });
  socket.on('connect', () => {
    socket.emit('user:online');
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
  const onCallAnswer = ({ answer }) => {
    clearTimeout(callTimeout);
    callActive = true;
    peer?.signal(answer);
  };
  socket.once('call:answer', onCallAnswer);

  const callTimeout = setTimeout(() => {
    socket.off('call:answer', onCallAnswer); // cleanup stale once-listener
    socket.emit('call:end', { to: toUid });
    fireOnEnd('timeout');
    cleanupCall(stream);
  }, 30000);

  socket.once('call:ended',      () => { clearTimeout(callTimeout); fireOnEnd(); cleanupCall(stream); });
  socket.once('call:declined',   () => { clearTimeout(callTimeout); fireOnEnd('declined'); cleanupCall(stream); });
  socket.once('call:unavailable',() => { clearTimeout(callTimeout); fireOnEnd('unavailable'); cleanupCall(stream); });
  socket.once('call:busy',       () => { clearTimeout(callTimeout); fireOnEnd('busy'); cleanupCall(stream); });

  return stream;
}

export async function answerCall({ fromUid, offer, isVideo, onStream, onEnd, onVideoUpgrade, onVideoUpgradeRequest, onConnectionFallback }) {
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

  socket.once('call:ended', () => { onEnd?.(); cleanupCall(stream); });

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
  peer?.destroy();
  peer = null;
  callPeer = null;
  stream?.getTracks().forEach(t => t.stop());
  if (iceHandler)         { socket?.off('call:ice-candidate', iceHandler);   iceHandler = null; }
  if (renegotiateHandler) { socket?.off('call:renegotiate',   renegotiateHandler); renegotiateHandler = null; }
  if (videoUpgradeHandler){ socket?.off('call:video-upgrade', videoUpgradeHandler); videoUpgradeHandler = null; }
}
