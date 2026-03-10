// src/services/socket.js
// Verbinding met de backend via Socket.IO + WebRTC bellen

import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';

// ─── Pas dit aan naar jouw SiteGround domein / IP ───────────────────────────
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

let socket = null;
let peer   = null;

// ── Socket verbinden ──────────────────────────────────────────────────────────
export function connectSocket(uid) {
  if (socket?.connected) return socket;
  socket = io(BACKEND_URL, { transports: ['websocket'] });
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
export async function startCall({ toUid, fromUid, callerName, isVideo, onStream, onEnd }) {
  // Microfoon + eventueel camera ophalen
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });

  peer = new SimplePeer({ initiator: true, trickle: true, stream });

  peer.on('signal', (offer) => {
    socket.emit('call:offer', { to: toUid, from: fromUid, offer, isVideo, callerName });
  });

  peer.on('stream', (remoteStream) => {
    onStream?.(remoteStream, stream);
  });

  peer.on('close', () => { onEnd?.(); cleanupCall(); });
  peer.on('error', (e) => { console.error('WebRTC error:', e); onEnd?.(); });

  // Ontvang het antwoord
  socket.once('call:answer', ({ answer }) => {
    peer?.signal(answer);
  });

  // ICE candidates ontvangen
  socket.on('call:ice-candidate', ({ candidate }) => {
    peer?.signal(candidate);
  });

  socket.once('call:ended',   () => { onEnd?.(); cleanupCall(stream); });
  socket.once('call:declined',() => { onEnd?.('declined'); cleanupCall(stream); });

  return stream;
}

export async function answerCall({ fromUid, offer, isVideo, onStream, onEnd }) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });

  peer = new SimplePeer({ initiator: false, trickle: true, stream });
  peer.signal(offer);

  peer.on('signal', (answer) => {
    socket.emit('call:answer', { to: fromUid, answer });
  });

  peer.on('stream', (remoteStream) => {
    onStream?.(remoteStream, stream);
  });

  peer.on('close', () => { onEnd?.(); cleanupCall(); });
  peer.on('error', (e) => { console.error('WebRTC error:', e); onEnd?.(); });

  socket.on('call:ice-candidate', ({ candidate }) => {
    peer?.signal(candidate);
  });

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

function cleanupCall(stream) {
  peer?.destroy();
  peer = null;
  stream?.getTracks().forEach(t => t.stop());
}
