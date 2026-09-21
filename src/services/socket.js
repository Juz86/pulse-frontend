// Central Socket.IO connection used by chat, presence and realtime sync.

import { io } from 'socket.io-client';
import { WS_URL } from '../config/runtimeConfig';
import { resolveBackendUrl } from '../lib/backendUrl';

export const BACKEND_URL = resolveBackendUrl();
export const SOCKET_URL = WS_URL || BACKEND_URL;

let socket = null;

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
  socket.on('connect', () => socket.emit('user:online'));
  socket.on('connect_error', (error) => {
    console.warn('[Pulse] Socket connect_error:', error?.message || error);
  });
  socket.on('reconnect_attempt', (attempt) => {
    console.warn('[Pulse] Socket reconnect_attempt:', attempt);
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
