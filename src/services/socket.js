// src/services/socket.js
// Verbinding met de backend via Socket.IO + WebRTC bellen

import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';

// ─── Pas dit aan naar jouw SiteGround domein / IP ───────────────────────────
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const METERED_KEY = process.env.REACT_APP_METERED_KEY;

const ICE_SERVERS = METERED_KEY ? [
  { urls: `stun:eu-turn1.xirsys.com` },
  { urls: `turn:eu-turn1.metered.ca:80`,           username: METERED_KEY, credential: METERED_KEY },
  { urls: `turn:eu-turn1.metered.ca:443`,          username: METERED_KEY, credential: METERED_KEY },
  { urls: `turn:eu-turn1.metered.ca:443?transport=tcp`, username: METERED_KEY, credential: METERED_KEY },
] : [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

let socket     = null;
let peer       = null;
let iceHandler = null;
let callPeer   = null; // bewaar de remote uid voor renegotiatie

// ── Socket verbinden ──────────────────────────────────────────────────────────
export function connectSocket(uid) {
  if (socket?.connected) {
    // setTimeout zodat App.js tijd heeft om listeners te registreren vóór het event aankomt
    setTimeout(() => socket.emit('user:online', { uid }), 0);
    return socket;
  }
  socket = io(BACKEND_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
    timeout: 10000,
  });
  socket.on('connect', () => {
    console.log('✅ Socket verbonden');
    socket.emit('user:online', { uid });
  });
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// ── WebRTC Bellen ─────────────────────────────────────────────────────────────
export async function startCall({ toUid, fromUid, callerName, isVideo, onStream, onEnd, onVideoUpgrade, onVideoUpgradeRequest }) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
    });
  } catch (e) {
    const msg = e.name === 'NotAllowedError'
      ? 'Toegang tot microfoon/camera geweigerd. Geef toestemming in je browser.'
      : 'Kan microfoon/camera niet starten: ' + e.message;
    alert(msg);
    onEnd?.();
    return null;
  }

  callPeer = toUid;

  peer = new SimplePeer({
    initiator: true,
    trickle: true,
    stream,
    config: { iceServers: ICE_SERVERS }
  });

  let callActive = false;

  peer.on('signal', (data) => {
    if (data.type === 'offer' && !callActive) {
      console.log('📞 call:offer → toUid:', toUid, '| fromUid:', fromUid);
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
  socket.on('call:video-upgrade', () => { onVideoUpgradeRequest?.(); });

  let callEnded = false;
  function fireOnEnd(reason) {
    if (callEnded) return;
    callEnded = true;
    onEnd?.(reason);
  }

  peer.on('close', () => { fireOnEnd(); cleanupCall(stream); });
  peer.on('error', (e) => { console.error('WebRTC error:', e); fireOnEnd(); cleanupCall(stream); });

  // Time-out: als na 30s geen antwoord, gesprek beëindigen
  const callTimeout = setTimeout(() => {
    socket.emit('call:end', { to: toUid });
    fireOnEnd('timeout');
    cleanupCall(stream);
  }, 30000);

  // Ontvang het antwoord
  socket.once('call:answer', ({ answer }) => {
    clearTimeout(callTimeout);
    callActive = true;
    peer?.signal(answer);
  });

  // ICE candidates ontvangen
  iceHandler = ({ candidate }) => { peer?.signal(candidate); };
  socket.on('call:ice-candidate', iceHandler);

  // Renegotiatie ontvangen
  socket.on('call:renegotiate', ({ signal }) => { peer?.signal(signal); });

  socket.once('call:ended',    () => { clearTimeout(callTimeout); fireOnEnd(); cleanupCall(stream); });
  socket.once('call:declined', () => { clearTimeout(callTimeout); fireOnEnd('declined'); cleanupCall(stream); });
  socket.once('call:unavailable', () => { clearTimeout(callTimeout); fireOnEnd('unavailable'); cleanupCall(stream); });

  return stream;
}

export async function answerCall({ fromUid, offer, isVideo, onStream, onEnd, onVideoUpgrade, onVideoUpgradeRequest }) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
    });
  } catch (e) {
    const msg = e.name === 'NotAllowedError'
      ? 'Toegang tot microfoon/camera geweigerd. Geef toestemming in je browser.'
      : 'Kan microfoon/camera niet starten: ' + e.message;
    alert(msg);
    onEnd?.();
    return null;
  }

  callPeer = fromUid;

  peer = new SimplePeer({
    initiator: false,
    trickle: true,
    stream,
    config: { iceServers: ICE_SERVERS }
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
  socket.on('call:video-upgrade', () => { onVideoUpgradeRequest?.(); });

  peer.on('close', () => { onEnd?.(); cleanupCall(stream); });
  peer.on('error', (e) => { console.error('WebRTC error:', e); onEnd?.(); cleanupCall(stream); });

  iceHandler = ({ candidate }) => { peer?.signal(candidate); };
  socket.on('call:ice-candidate', iceHandler);

  // Renegotiatie ontvangen
  socket.on('call:renegotiate', ({ signal }) => { peer?.signal(signal); });

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
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
    peer.addTrack(vs.getVideoTracks()[0], vs);
    return vs;
  } catch (e) {
    console.error('Video upgrade accepteren mislukt:', e);
    return null;
  }
}

export async function upgradeToVideo() {
  if (!peer) return null;
  try {
    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
    const videoTrack = videoStream.getVideoTracks()[0];
    peer.addTrack(videoTrack, videoStream);
    // Vertel remote kant ook camera te starten
    socket.emit('call:video-upgrade', { to: callPeer });
    return videoStream;
  } catch (e) {
    console.error('Video upgraden mislukt:', e);
    return null;
  }
}

function cleanupCall(stream) {
  peer?.destroy();
  peer = null;
  callPeer = null;
  stream?.getTracks().forEach(t => t.stop());
  if (iceHandler) { socket?.off('call:ice-candidate', iceHandler); iceHandler = null; }
  socket?.off('call:renegotiate');
  socket?.off('call:video-upgrade');
}
