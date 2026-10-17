// Central Socket.IO connection used by chat, presence and realtime sync.

import { io } from 'socket.io-client';
import { WS_URL } from '../config/runtimeConfig';
import { resolveBackendUrl } from '../lib/backendUrl';
import { isNativePulseEnvironment } from '../lib/platform/runtime';

export const BACKEND_URL = resolveBackendUrl();
export const SOCKET_URL = WS_URL || BACKEND_URL;

let socket = null;
let socketToken = null;
let socketE2EEDeviceId = null;

export function supportsBrowserCalls(runtime = (typeof window === 'undefined' ? {} : window)) {
  return !isNativePulseEnvironment()
    && typeof runtime?.RTCPeerConnection === 'function'
    && typeof runtime?.navigator?.mediaDevices?.getUserMedia === 'function'
    && runtime?.isSecureContext !== false;
}

export const supportsBrowserAudioCalls = supportsBrowserCalls;
export const supportsBrowserVideoCalls = supportsBrowserCalls;

function socketAuth(token = socketToken) {
  const browserCalls = supportsBrowserCalls();
  return {
    token,
    callPlatform: browserCalls ? 'web' : undefined,
    callCapabilities: browserCalls ? ['audio', 'video'] : [],
    e2eeDeviceId: socketE2EEDeviceId || undefined,
  };
}

export function connectSocket(uid, token) {
  socketToken = token || socketToken;
  if (socket) {
    if (token) socket.auth = socketAuth(token);
    if (socket.connected) {
      setTimeout(() => socket.emit('user:online'), 0);
      return socket;
    }
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: socketAuth(token),
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

export function setSocketE2EEDeviceId(deviceId) {
  const normalized = deviceId == null ? null : String(deviceId);
  if (normalized && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new Error('v2_socket_device_invalid');
  }
  if (socketE2EEDeviceId === normalized) return;
  socketE2EEDeviceId = normalized;
  if (!socket) return;

  socket.auth = socketAuth();
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
  socketE2EEDeviceId = null;
}
