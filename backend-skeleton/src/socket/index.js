import { Server } from 'socket.io';
import admin from 'firebase-admin';
import { db } from '../services/firestore.js';
import { getDevUidFromSocketAuth, isDevAuthBypassEnabled } from '../middleware/auth.js';
import { canEditMessage, normalizeEditedText } from '../services/messageEdits.js';
import { buildCallMessage, buildLegacyMessage, buildSystemMessage } from '../services/legacyMessages.js';
import { computeHistoryExpiresAt, resolveConversationRetentionDays } from '../services/historyRetention.js';
import { isAllowedAppOrigin } from '../services/httpSecurity.js';
import { parentPolicyService } from '../services/parentPolicyService.js';
import { logPolicyEvent } from '../services/policyEvents.js';
import { toggleSingleUserReaction } from '../services/messageReactions.js';
import { sendPushToUsers } from '../services/pushNotifications.js';
import {
  clearExpiredPendingCallInvites,
  clearPendingCallInvite,
  listPendingCallInvitesForUser,
  savePendingCallInvite,
} from '../services/pendingCalls.js';

const onlineUsers = new Map();
const inactiveUsers = new Set();

function isGroupAdmin(conversation, uid) {
  return Array.isArray(conversation?.adminIds)
    ? conversation.adminIds.includes(uid)
    : conversation?.creatorId === uid;
}

async function createGroupSystemMessage({ io, convRef, conv, text, emitToUser }) {
  if (!convRef?.id || !text) return null;

  const messageRef = db.collection('messages').doc();
  const savedMessage = buildSystemMessage({
    id: messageRef.id,
    convId: convRef.id,
    text,
  });

  await messageRef.set(savedMessage);
  await convRef.set({
    lastMessage: savedMessage.text,
    updatedAt: savedMessage.createdAt,
  }, { merge: true });

  for (const memberUid of conv.members || []) {
    emitToUser(io, memberUid, 'message:received', savedMessage);
  }

  return savedMessage;
}

export function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        callback(null, isAllowedAppOrigin(origin));
      },
    },
    allowRequest(request, callback) {
      const requestOrigin = request.headers.origin || '';
      callback(null, isAllowedAppOrigin(requestOrigin));
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

    const removedExpired = clearExpiredPendingCallInvites();
    if (removedExpired > 0) {
      console.info('[Pulse][Call] Verlopen pending call invites opgeschoond', { removed: removedExpired });
    }
    const pendingInvites = listPendingCallInvitesForUser(uid);
    pendingInvites.forEach((invite) => {
      socket.emit('call:offer', {
        fromUid: invite.fromUid,
        offer: invite.offer,
        isVideo: !!invite.isVideo,
        callerName: invite.callerName || 'Iemand',
        sessionId: invite.sessionId,
      });
    });

    socket.on('user:online', () => {
      inactiveUsers.delete(uid);
      io.emit('user:status', { uid, online: true, inactive: false });
    });

    socket.on('user:inactive', () => {
      inactiveUsers.add(uid);
      io.emit('user:status', { uid, online: true, inactive: true });
    });

    socket.on('user:active', () => {
      inactiveUsers.delete(uid);
      io.emit('user:status', { uid, online: true, inactive: false });
    });

    socket.on('users:online:request', () => {
      socket.emit('users:online', Array.from(onlineUsers.keys()));
      socket.emit('users:inactive', Array.from(inactiveUsers));
    });

    socket.on('conversation:join', async ({ convId }) => {
      if (!convId || !uid) return;

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) return;

      const conv = convDoc.data();
      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) return;

      socket.join(`conv:${convId}`);
    });

    socket.on('conversation:create', async (payload = {}, ack = () => {}) => {
      const members = Array.from(new Set([...(payload.members || []), uid])).filter(Boolean);
      if (members.length < 2) {
        ack({ error: 'invalid_members' });
        return;
      }

      const isGroup = !!payload.isGroup;
      let existing = null;

      if (!isGroup && members.length === 2) {
        const snap = await db
          .collection('conversations')
          .where('isGroup', '==', false)
          .where('members', 'array-contains', uid)
          .get();

        existing = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .find((conv) => Array.isArray(conv.members) && conv.members.length === 2 && members.every((memberUid) => conv.members.includes(memberUid)));
      }

      if (existing) {
        const deletedForUserIds = Array.isArray(existing.deletedForUserIds) ? existing.deletedForUserIds : [];
        if (deletedForUserIds.includes(uid)) {
          const nextDeletedForUserIds = deletedForUserIds.filter((memberUid) => memberUid !== uid);
          await db.collection('conversations').doc(existing.id).set({
            deletedForUserIds: nextDeletedForUserIds,
          }, { merge: true });
          existing.deletedForUserIds = nextDeletedForUserIds;
        }
        socket.join(`conv:${existing.id}`);
        ack({ convId: existing.id });
        return;
      }

      for (const memberUid of members.filter((memberUid) => memberUid !== uid)) {
        const decision = await parentPolicyService.mayCreateConversation(uid, memberUid);
        if (!decision.allowed) {
          ack({ error: decision.reason || 'conversation_not_allowed' });
          return;
        }
      }

      const convRef = db.collection('conversations').doc();
      const now = new Date().toISOString();
      const conversation = {
        id: convRef.id,
        members,
        memberNames: payload.memberNames || {},
        memberEmails: payload.memberEmails || {},
        isGroup,
        groupName: isGroup ? (payload.groupName || 'Groep') : null,
        creatorId: uid,
        adminIds: isGroup ? [uid] : [],
        lastMessage: '',
        updatedAt: now,
        createdAt: now,
        lastCallDirection: null,
        lastCallSenderId: null,
        lastCallIsVideo: null,
      };

      await convRef.set(conversation);
      for (const memberUid of members) {
        emitToUser(io, memberUid, 'conversation:created', conversation);
      }
      socket.join(`conv:${convRef.id}`);
      ack({ convId: convRef.id });
    });

    socket.on('conversation:addMember', async ({ convId, uid: targetUid, displayName }, ack = () => {}) => {
      if (!convId || !targetUid || !uid) {
        ack({ error: 'invalid_payload' });
        return;
      }

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) {
        ack({ error: 'conversation_not_found' });
        return;
      }

      const conv = convDoc.data();
      if (!conv.isGroup) {
        ack({ error: 'not_a_group' });
        return;
      }

      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
        ack({ error: 'not_allowed_in_conversation' });
        return;
      }

      if (!isGroupAdmin(conv, uid)) {
        ack({ error: 'not_group_admin' });
        return;
      }

      if (conv.members.includes(targetUid)) {
        ack({ ok: true, alreadyMember: true });
        return;
      }

      const policyDecision = await parentPolicyService.mayAddGroupMember(uid, conv.members || [], targetUid);
      if (!policyDecision.allowed) {
        ack({ error: policyDecision.reason || 'group_member_not_allowed' });
        return;
      }

      const userDoc = await db.collection('users').doc(targetUid).get();
      if (!userDoc.exists) {
        ack({ error: 'user_not_found' });
        return;
      }

      const targetUser = userDoc.data();
      const nextMembers = [...conv.members, targetUid];
      const nextMemberNames = {
        ...(conv.memberNames || {}),
        [targetUid]: displayName || targetUser.displayName || targetUser.username || targetUser.email || targetUid,
      };
      const nextMemberEmails = {
        ...(conv.memberEmails || {}),
        [targetUid]: targetUser.email || null,
      };
      const updatedAt = new Date().toISOString();

      await convDoc.ref.set({
        members: nextMembers,
        memberNames: nextMemberNames,
        memberEmails: nextMemberEmails,
        updatedAt,
      }, { merge: true });

      const actorName = conv.memberNames?.[uid] || conv.memberEmails?.[uid] || uid;
      const targetName = nextMemberNames[targetUid] || targetUser.email || targetUid;

      const updatedConversation = {
        id: convId,
        ...conv,
        members: nextMembers,
        memberNames: nextMemberNames,
        memberEmails: nextMemberEmails,
        updatedAt,
      };

      await createGroupSystemMessage({
        io,
        convRef: convDoc.ref,
        conv: updatedConversation,
        text: `${actorName} heeft ${targetName} toegevoegd aan de groep.`,
        emitToUser,
      });

      for (const memberUid of nextMembers) {
        emitToUser(io, memberUid, 'conversation:member_added', {
          convId,
          uid: targetUid,
          conversation: updatedConversation,
        });
      }

      ack({ ok: true, conversation: updatedConversation });
    });

    socket.on('conversation:removeMember', async ({ convId, uid: targetUid }, ack = () => {}) => {
      if (!convId || !targetUid || !uid) {
        ack({ error: 'invalid_payload' });
        return;
      }

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) {
        ack({ error: 'conversation_not_found' });
        return;
      }

      const conv = convDoc.data();
      if (!conv.isGroup) {
        ack({ error: 'not_a_group' });
        return;
      }

      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
        ack({ error: 'not_allowed_in_conversation' });
        return;
      }

      const isSelfRemoval = uid === targetUid;
      if (!isSelfRemoval && !isGroupAdmin(conv, uid)) {
        ack({ error: 'not_group_admin' });
        return;
      }

      if (!conv.members.includes(targetUid)) {
        ack({ ok: true, alreadyRemoved: true });
        return;
      }

      const nextMembers = conv.members.filter((memberUid) => memberUid !== targetUid);
      const nextMemberNames = { ...(conv.memberNames || {}) };
      const nextMemberEmails = { ...(conv.memberEmails || {}) };
      const nextAdminIds = (conv.adminIds || [conv.creatorId]).filter((memberUid) => memberUid !== targetUid);
      delete nextMemberNames[targetUid];
      delete nextMemberEmails[targetUid];
      const updatedAt = new Date().toISOString();

      await convDoc.ref.set({
        members: nextMembers,
        memberNames: nextMemberNames,
        memberEmails: nextMemberEmails,
        adminIds: nextAdminIds,
        updatedAt,
      }, { merge: true });

      const actorName = conv.memberNames?.[uid] || conv.memberEmails?.[uid] || uid;
      const targetName = conv.memberNames?.[targetUid] || conv.memberEmails?.[targetUid] || targetUid;
      const systemText = isSelfRemoval
        ? `${targetName} heeft de groep verlaten.`
        : `${actorName} heeft ${targetName} uit de groep verwijderd.`;

      const updatedConversation = {
        id: convId,
        ...conv,
        members: nextMembers,
        memberNames: nextMemberNames,
        memberEmails: nextMemberEmails,
        adminIds: nextAdminIds,
        updatedAt,
      };

      await createGroupSystemMessage({
        io,
        convRef: convDoc.ref,
        conv: updatedConversation,
        text: systemText,
        emitToUser,
      });

      for (const memberUid of nextMembers) {
        emitToUser(io, memberUid, 'conversation:member_removed', {
          convId,
          uid: targetUid,
          conversation: updatedConversation,
        });
      }

      emitToUser(io, targetUid, 'conversation:member_removed', {
        convId,
        uid: targetUid,
        removedSelf: true,
        conversation: updatedConversation,
      });

      ack({ ok: true, conversation: updatedConversation });
    });

    socket.on('conversation:rename', async ({ convId, groupName }, ack = () => {}) => {
      const nextGroupName = String(groupName || '').trim();
      if (!convId || !nextGroupName || nextGroupName.length > 50 || !uid) {
        ack({ error: 'invalid_group_name' });
        return;
      }

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) {
        ack({ error: 'conversation_not_found' });
        return;
      }

      const conv = convDoc.data();
      if (!conv.isGroup) {
        ack({ error: 'not_a_group' });
        return;
      }
      if (!isGroupAdmin(conv, uid)) {
        ack({ error: 'not_group_admin' });
        return;
      }

      const updatedAt = new Date().toISOString();
      const conversation = { id: convId, ...conv, groupName: nextGroupName, updatedAt };
      await convDoc.ref.set({ groupName: nextGroupName, updatedAt }, { merge: true });
      for (const memberUid of conv.members || []) {
        emitToUser(io, memberUid, 'conversation:renamed', { conversation });
      }
      ack({ ok: true, conversation });
    });

    socket.on('conversation:promoteAdmin', async ({ convId, uid: targetUid }, ack = () => {}) => {
      if (!convId || !targetUid || !uid) {
        ack({ error: 'invalid_payload' });
        return;
      }

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) {
        ack({ error: 'conversation_not_found' });
        return;
      }

      const conv = convDoc.data();
      if (!conv.isGroup) {
        ack({ error: 'not_a_group' });
        return;
      }
      if (!isGroupAdmin(conv, uid)) {
        ack({ error: 'not_group_admin' });
        return;
      }
      if (!conv.members?.includes(targetUid)) {
        ack({ error: 'not_allowed_in_conversation' });
        return;
      }

      const adminIds = Array.from(new Set([...(conv.adminIds || [conv.creatorId]), targetUid]));
      const updatedAt = new Date().toISOString();
      const conversation = { id: convId, ...conv, adminIds, updatedAt };
      await convDoc.ref.set({ adminIds, updatedAt }, { merge: true });
      for (const memberUid of conv.members || []) {
        emitToUser(io, memberUid, 'conversation:admins_updated', { conversation });
      }
      ack({ ok: true, conversation });
    });

    socket.on('message:send', async ({ convId, message }, ack = () => {}) => {
      if (!convId || !message || !uid) {
        ack({ error: 'invalid_payload' });
        return;
      }

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) {
        ack({ error: 'conversation_not_found' });
        return;
      }

      const conv = convDoc.data();
      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
        ack({ error: 'not_allowed_in_conversation' });
        return;
      }

      const messageRef = db.collection('messages').doc();
      const savedMessage = buildLegacyMessage({
        id: messageRef.id,
        convId,
        message: {
          ...message,
          senderId: uid,
        },
      });
      const retentionDays = await resolveConversationRetentionDays(conv.members || []);
      savedMessage.expiresAt = computeHistoryExpiresAt(savedMessage.createdAt, retentionDays);

      await messageRef.set(savedMessage);
      await convDoc.ref.set({
        lastMessage: savedMessage.type === 'text' ? savedMessage.text : (savedMessage.type === 'contact' ? `Contactpersoon: ${savedMessage.sharedContact?.name || ''}` : 'Nieuw bericht'),
        updatedAt: savedMessage.createdAt,
        deletedForUserIds: [],
      }, { merge: true });

      for (const memberUid of conv.members) {
        emitToUser(io, memberUid, 'message:received', savedMessage);
      }

      const pushResult = await sendPushToUsers({
        senderUid: uid,
        recipientUids: conv.members || [],
        payload: {
          convId,
          messageId: savedMessage.id,
          body: savedMessage.type === 'text' ? 'Nieuw bericht ontvangen' : 'Nieuw media- of contactbericht',
        },
      });
      console.info('[Pulse][Push] socket message:send', { convId, messageId: savedMessage.id, pushResult });

      if (conv.isGroup && Array.isArray(savedMessage.mentions) && savedMessage.mentions.length > 0) {
        const uniqueMentions = Array.from(new Set(
          savedMessage.mentions.filter((mentionedUid) => mentionedUid && mentionedUid !== uid && conv.members.includes(mentionedUid))
        ));

        for (const mentionedUid of uniqueMentions) {
          emitToUser(io, mentionedUid, 'mention:notify', {
            convId,
            senderUid: uid,
            senderName: savedMessage.senderName || uid,
            groupName: conv.groupName || 'Groep',
            messageId: savedMessage.id,
          });
        }
      }

      ack(savedMessage);
    });

    socket.on('messages:read', async ({ convId }) => {
      if (!convId || !uid) return;
      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) return;
      const conv = convDoc.data();
      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) return;

      for (const memberUid of conv.members.filter((memberUid) => memberUid !== uid)) {
        emitToUser(io, memberUid, 'message:status', {
          convId,
          status: 'gelezen',
        });
      }
    });

    socket.on('call:log', async ({
      convId,
      isVideo = false,
      direction = 'completed',
      duration = 0,
      senderId,
      senderName,
    } = {}) => {
      if (!convId || !uid) return;

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) return;

      const conv = convDoc.data();
      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) return;

      const messageRef = db.collection('messages').doc();
      const savedMessage = buildCallMessage({
        id: messageRef.id,
        convId,
        senderId: senderId || uid,
        senderName: senderName || uid,
        isVideo: !!isVideo,
        direction,
        duration,
      });
      const retentionDays = await resolveConversationRetentionDays(conv.members || []);
      savedMessage.expiresAt = computeHistoryExpiresAt(savedMessage.createdAt, retentionDays);

      await messageRef.set(savedMessage);
      await convDoc.ref.set({
        lastMessage: '',
        lastMessageType: 'call',
        lastCallDirection: savedMessage.direction,
        lastCallSenderId: savedMessage.senderId,
        lastCallIsVideo: savedMessage.isVideo,
        updatedAt: savedMessage.createdAt,
        deletedForUserIds: [],
      }, { merge: true });

      for (const memberUid of conv.members) {
        emitToUser(io, memberUid, 'message:received', savedMessage);
      }
    });

    socket.on('message:react', async ({ convId, msgId, emoji }) => {
      if (!convId || !msgId || !emoji || !uid) return;
      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) return;
      const conv = convDoc.data();
      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) return;

      const msgDoc = await db.collection('messages').doc(msgId).get();
      if (!msgDoc.exists) return;
      const data = msgDoc.data();
      const reactions = toggleSingleUserReaction(data.reactions || {}, emoji, uid);
      await msgDoc.ref.set({ reactions }, { merge: true });
      for (const memberUid of conv.members) {
        emitToUser(io, memberUid, 'message:reaction', { convId, msgId, reactions });
      }
    });

    socket.on('message:edit', async ({ convId, msgId, newText }, ack = () => {}) => {
      if (!convId || !msgId || !uid) {
        ack({ error: 'invalid_payload' });
        return;
      }

      const trimmedText = normalizeEditedText(newText);
      if (!trimmedText) {
        ack({ error: 'invalid_payload' });
        return;
      }

      const convDoc = await db.collection('conversations').doc(convId).get();
      if (!convDoc.exists) {
        ack({ error: 'conversation_not_found' });
        return;
      }

      const conv = convDoc.data();
      if (!Array.isArray(conv.members) || !conv.members.includes(uid)) {
        ack({ error: 'not_allowed_in_conversation' });
        return;
      }

      const msgDoc = await db.collection('messages').doc(msgId).get();
      if (!msgDoc.exists) {
        ack({ error: 'message_not_found' });
        return;
      }

      const message = msgDoc.data();
      if (message.conversationId !== convId) {
        ack({ error: 'message_conversation_mismatch' });
        return;
      }

      const decision = canEditMessage(message, uid);
      if (!decision.allowed) {
        ack({ error: decision.reason });
        return;
      }

      const editedAt = new Date().toISOString();

      await msgDoc.ref.set(
        {
          text: trimmedText,
          editedAt,
          updatedAt: editedAt,
        },
        { merge: true }
      );

      for (const memberUid of conv.members) {
        emitToUser(io, memberUid, 'message:edited', {
          msgId,
          convId,
          text: trimmedText,
          editedAt,
        });
      }

      ack({ ok: true, msgId, editedAt });
    });

    socket.on('call:offer', async ({ to, offer, isVideo, callerName, sessionId = null }) => {
      if (!to || !offer || !uid) return;
      const normalizedSessionId = sessionId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const decision = await parentPolicyService.mayStartCall(uid, to, !!isVideo);
      if (!decision.allowed) {
        await logPolicyEvent({
          actorUid: uid,
          targetUid: to,
          action: isVideo ? 'start_video_call' : 'start_audio_call',
          allowed: false,
          reason: decision.reason || 'call_not_allowed',
        });
        socket.emit('call:unavailable', { reason: decision.reason || 'call_not_allowed', sessionId });
        return;
      }

      savePendingCallInvite({
        toUid: to,
        fromUid: uid,
        sessionId: normalizedSessionId,
        offer,
        isVideo: !!isVideo,
        callerName: callerName || 'Iemand',
      });

      emitToUser(io, to, 'call:offer', {
        fromUid: uid,
        offer,
        isVideo: !!isVideo,
        callerName: callerName || 'Iemand',
        sessionId: normalizedSessionId,
      });

      const pushResult = await sendPushToUsers({
        senderUid: uid,
        recipientUids: [to],
        payload: {
          type: 'incoming_call',
          title: callerName || 'Inkomende oproep',
          body: isVideo ? 'Videogesprek in Pulse' : 'Spraakgesprek in Pulse',
          callSessionId: normalizedSessionId,
          fromUid: uid,
          callerName: callerName || 'Iemand',
          isVideo: !!isVideo,
          ttlMs: 35_000,
        },
      });
      console.info('[Pulse][Push] call:offer', { to, fromUid: uid, sessionId: normalizedSessionId, pushResult });
    });

    socket.on('call:answer', ({ to, answer, sessionId = null }) => {
      if (!to || !answer || !uid) return;
      if (sessionId) clearPendingCallInvite({ uid, sessionId });
      emitToUser(io, to, 'call:answer', { fromUid: uid, answer, sessionId });
    });

    socket.on('call:decline', ({ to, sessionId = null }) => {
      if (!to || !uid) return;
      if (sessionId) clearPendingCallInvite({ uid, sessionId });
      emitToUser(io, to, 'call:declined', { fromUid: uid, sessionId });
    });

    socket.on('call:end', ({ to, sessionId = null }) => {
      if (!to || !uid) return;
      if (sessionId) clearPendingCallInvite({ uid: to, sessionId });
      emitToUser(io, to, 'call:ended', { fromUid: uid, sessionId });
    });

    socket.on('call:ice-candidate', ({ to, candidate, sessionId = null }) => {
      if (!to || !candidate || !uid) return;
      emitToUser(io, to, 'call:ice-candidate', { fromUid: uid, candidate, sessionId });
    });

    socket.on('call:renegotiate', ({ to, signal, sessionId = null }) => {
      if (!to || !signal || !uid) return;
      emitToUser(io, to, 'call:renegotiate', { fromUid: uid, signal, sessionId });
    });

    socket.on('call:video-upgrade', async ({ to, sessionId = null }) => {
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

      emitToUser(io, to, 'call:video-upgrade', { fromUid: uid, sessionId });
    });

    socket.on('call:busy', ({ to, sessionId = null }) => {
      if (!to || !uid) return;
      if (sessionId) clearPendingCallInvite({ uid, sessionId });
      emitToUser(io, to, 'call:busy', { fromUid: uid, sessionId });
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(uid);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(uid);
        inactiveUsers.delete(uid);
        io.emit('user:status', { uid, online: false, inactive: false });
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
