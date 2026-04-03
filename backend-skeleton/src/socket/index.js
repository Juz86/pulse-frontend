import { Server } from 'socket.io';
import admin from 'firebase-admin';
import { db } from '../services/firestore.js';

const onlineUsers = new Map();

export function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  io.use(async (socket, next) => {
    try {
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
