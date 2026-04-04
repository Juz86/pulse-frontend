import { Server } from 'socket.io';
import admin from 'firebase-admin';
import { db } from '../services/firestore.js';
import { getDevUidFromSocketAuth, isDevAuthBypassEnabled } from '../middleware/auth.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';

const onlineUsers = new Map();

export function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  io.use(async (socket, next) => {
    try {
      if (isDevAuthBypassEnabled()) {
        const devUid = getDevUidFromSocketAuth(socket.handshake.auth || {});
        if (devUid) {
          socket.data.uid = devUid;
          socket.data.devBypass = true;
          return next();
        }
      }

      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('missing_auth_token'));
      }

      const decoded = await admin.auth().verifyIdToken(token);
      socket.data.uid = decoded.uid;
      return next();
    } catch (error) {
      return next(new Error('invalid_auth_token'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.data.uid;
    if (!onlineUsers.has(uid)) {
      onlineUsers.set(uid, new Set());
    }
    onlineUsers.get(uid).add(socket.id);

    socket.on('conversation:join', async ({ convId }) => {
      if (!convId || !uid) return;

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) return;

      const conv = convDoc.data();
      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) return;

      socket.join(`conv:${convId}`);
    });

    socket.on('call:offer', async ({ to, offer, isVideo, callerName }) => {
      if (!to || !offer || !uid) return;

      const decision = await parentPolicyService.mayStartCall(uid, to, !!isVideo);
      if (!decision.allowed) {
        await logPolicyEvent({
          actorUid: uid,
          targetUid: to,
          action: isVideo ? 'start_video_call' : 'start_audio_call',
          allowed: false,
          reason: decision.reason || 'call_not_allowed',
        });
        socket.emit('call:unavailable', { reason: decision.reason || 'call_not_allowed' });
        return;
      }

      emitToUser(io, to, 'call:offer', {
        fromUid: uid,
        offer,
        isVideo: !!isVideo,
        callerName: callerName || 'Iemand',
      });
    });

    socket.on('call:answer', ({ to, answer }) => {
      if (!to || !answer || !uid) return;
      emitToUser(io, to, 'call:answer', { fromUid: uid, answer });
    });

    socket.on('call:decline', ({ to }) => {
      if (!to || !uid) return;
      emitToUser(io, to, 'call:declined', { fromUid: uid });
    });

    socket.on('call:end', ({ to }) => {
      if (!to || !uid) return;
      emitToUser(io, to, 'call:ended', { fromUid: uid });
    });

    socket.on('call:ice-candidate', ({ to, candidate }) => {
      if (!to || !candidate || !uid) return;
      emitToUser(io, to, 'call:ice-candidate', { fromUid: uid, candidate });
    });

    socket.on('call:renegotiate', ({ to, signal }) => {
      if (!to || !signal || !uid) return;
      emitToUser(io, to, 'call:renegotiate', { fromUid: uid, signal });
    });

    socket.on('call:video-upgrade', async ({ to }) => {
      if (!to || !uid) return;

      const decision = await parentPolicyService.mayStartCall(uid, to, true);
      if (!decision.allowed) {
        await logPolicyEvent({
          actorUid: uid,
          targetUid: to,
          action: 'upgrade_to_video',
          allowed: false,
          reason: decision.reason || 'video_not_allowed',
        });
        return;
      }

      emitToUser(io, to, 'call:video-upgrade', { fromUid: uid });
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(uid);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(uid);
      }
    });
  });

  return {
    io,
    emitToUser,
  };
}

export function emitToUser(io, uid, event, payload) {
  const sockets = onlineUsers.get(uid);
  if (!sockets) return;

  for (const socketId of sockets) {
    io.to(socketId).emit(event, payload);
  }
}
