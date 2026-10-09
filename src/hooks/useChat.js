// src/hooks/useChat.js
import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { messagingService } from '../lib/e2ee/messagingService';
import { getMessageDisplayText, normalizeIncomingMessage } from '../lib/e2ee/messageModel';
import { ENCRYPTED_MESSAGE_PROTOCOL } from '../lib/e2ee/messageProtocolConstants';
import {
  applyConversationSummaryToList,
  applyConversationReactionSummaryToList,
} from '../lib/e2ee/conversationSummaries';
import { canApplyPlaintextEditUpdate } from '../lib/e2ee/policy';
import { normalizeSingleUserReaction } from '../lib/e2ee/messageReactions';
import { isRealtimePopupRelevant } from './useRealtimeSync';

const PRIVATE_NOTIFICATION_BODY = 'Open Pulse om het bericht veilig te bekijken.';
const PRIVATE_REQUEST_NOTIFICATION_BODY = 'Open Pulse om de uitnodiging te bekijken.';

export default function useChat({
  user,
  activeConvRef,
  conversationsRef,
  messagesRef,
  msgCache,
  msgsAreaRef,
  dndRef,
  mutedConversationIdsRef,
  audioCtxRef,
  loadConversations,
  loadContacts,
  loadFriendRequests,
  markFriendRequestSeen,
  setMessages,
  setConversations,
  setUnreadCounts,
  setFriendRequests,
  setContacts,
  setActiveConv,
  setBlockedContacts,
  setParentBlockedUids,
  showErrToast,
  setConfirmDialog,
  onReconnect,
  onOpenMentionConversation,
  onTransientMessage,
}) {
  const disconnectTimerRef   = useRef(null);
  const reconnectIntervalRef = useRef(null);
  const processedIncomingRef = useRef(new Map());
  const onReconnectRef       = useRef(onReconnect);
  const loadConversationsRef = useRef(loadConversations);
  const missingConvRefreshRef = useRef(new Map());
  const socket = getSocket();

  const [connected,      setConnected]      = useState(true);
  const [reconnectIn,    setReconnectIn]    = useState(null);
  const [typing,         setTyping]         = useState(false);
  const [typingName,     setTypingName]     = useState('');
  const [typingByConv,   setTypingByConv]   = useState({});
  const [pausedFeatures, setPausedFeatures] = useState({ chat: false });
  const [mentionToast,   setMentionToast]   = useState(null);
  const typingTimeoutsRef = useRef(new Map());

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  function playMessageSound() {
    if (dndRef.current) return;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      [[880, 0, 0.08], [1100, 0.09, 0.14]].forEach(([freq, start, end]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + start);
        gain.gain.setValueAtTime(0, t + start);
        gain.gain.linearRampToValueAtTime(0.18, t + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + end);
        osc.start(t + start);
        osc.stop(t + end);
      });
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }

  function isConversationMuted(convId) {
    return Array.isArray(mutedConversationIdsRef?.current) && mutedConversationIdsRef.current.includes(convId);
  }

  // ── Socket events ─────────────────────────────────────────────────────────
  /* eslint-disable react-hooks/exhaustive-deps */
  // This socket wiring is intentionally attached to the live socket lifecycle.
  // The referenced setters/refs are stable inputs from React and parent hooks.
  useEffect(() => {
    if (!socket) return;

    function buildIncomingEventKey(message, hydratedMessage) {
      const resolved = hydratedMessage || message || {};
      const convId = resolved.convId || resolved.conversationId || message?.convId || message?.conversationId || 'unknown-conv';
      const messageId = resolved.id || message?.id || message?.messageId;
      if (messageId) return `${convId}:${messageId}`;
      const senderId = resolved.senderId || message?.senderId || 'unknown-sender';
      const createdAt = resolved.createdAt || message?.createdAt || resolved.sentAt || message?.sentAt || '';
      const text = resolved.text || message?.text || resolved.type || message?.type || '';
      return `${convId}:${senderId}:${createdAt}:${text}`;
    }

    function markIncomingEventProcessed(key) {
      const now = Date.now();
      processedIncomingRef.current.set(key, now);
      processedIncomingRef.current.forEach((seenAt, seenKey) => {
        if (now - seenAt > 15000) processedIncomingRef.current.delete(seenKey);
      });
    }

    const onConnect = () => {
      clearTimeout(disconnectTimerRef.current);
      clearInterval(reconnectIntervalRef.current);
      setConnected(true);
      setReconnectIn(null);
      conversationsRef.current.forEach(conv => socket.emit('conversation:join', { convId: conv.id }));
      socket.emit('users:online:request');
      // Haal vriendschapsverzoeken op bij reconnect — gemiste verzoeken tijdens offline periode ophalen
      loadFriendRequests?.({ force: true });
      // Herverstuurd mislukte berichten zodra socket daadwerkelijk connected is
      onReconnectRef.current?.();
    };

    const onDisconnect = () => {
      disconnectTimerRef.current = setTimeout(() => {
        setConnected(false);
        setReconnectIn(10);
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = setInterval(() => {
          setReconnectIn(prev => {
            if (prev <= 1) { clearInterval(reconnectIntervalRef.current); return null; }
            return prev - 1;
          });
        }, 1000);
      }, 3000);
    };

    const onMessageReceived = async (msg) => {
      let hydratedMsg;
      try {
        hydratedMsg = await messagingService.hydrateIncomingMessage(msg, user.uid);
      } catch {
        hydratedMsg = normalizeIncomingMessage(msg, user.uid);
      }

      const incomingKey = buildIncomingEventKey(msg, hydratedMsg);
      if (processedIncomingRef.current.has(incomingKey)) return;
      markIncomingEventProcessed(incomingKey);

      const current = activeConvRef.current;
      const convId = hydratedMsg.convId || hydratedMsg.conversationId || msg.convId;
      if (!convId) return;
      const isIncomingFromOtherUser = hydratedMsg.senderId !== user.uid;
      const knownConversation = conversationsRef.current.some((conversation) => conversation.id === convId);

      if (!knownConversation) {
        const now = Date.now();
        const lastRefreshAt = missingConvRefreshRef.current.get(convId) || 0;
        if (now - lastRefreshAt > 1200) {
          missingConvRefreshRef.current.set(convId, now);
          loadConversationsRef.current?.({ force: true });
        }
      }

      if (hydratedMsg.transient) {
        onTransientMessage?.(convId, hydratedMsg);
      }

      if (current?.id === convId) {
        if (hydratedMsg.protocol === ENCRYPTED_MESSAGE_PROTOCOL && isIncomingFromOtherUser && hydratedMsg.id) {
          messagingService.sendReceipt({ user, messageId: hydratedMsg.id, type: 'read' }).catch(() => {});
        }
        setMessages(prev => {
          const pendingIdx = prev.findIndex(m => (
            m.pending
            && m.senderId === hydratedMsg.senderId
            && (
              (m.localId && hydratedMsg.localId && m.localId === hydratedMsg.localId)
              || (m.id && hydratedMsg.localId && m.id === hydratedMsg.localId)
              || (!hydratedMsg.localId && m.text === hydratedMsg.text)
            )
          ));
          if (pendingIdx !== -1) {
            const next = [...prev];
            next[pendingIdx] = { ...hydratedMsg, pending: false };
            return next;
          }
          if (prev.some(m => m.id && m.id === hydratedMsg.id)) return prev;
          return [...prev, hydratedMsg];
        });
        setTimeout(() => {
          if (msgsAreaRef.current) msgsAreaRef.current.scrollTo({ top: msgsAreaRef.current.scrollHeight, behavior: 'smooth' });
        }, 50);
        if (isIncomingFromOtherUser && !isConversationMuted(convId)) playMessageSound();
      } else if (isIncomingFromOtherUser) {
        if (hydratedMsg.protocol === ENCRYPTED_MESSAGE_PROTOCOL && hydratedMsg.id) {
          messagingService.sendReceipt({ user, messageId: hydratedMsg.id, type: 'delivered' }).catch(() => {});
        }
        setUnreadCounts(prev => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));
        if (!isConversationMuted(convId) && Notification.permission === 'granted' && document.hidden) {
          new Notification('Nieuw bericht in Pulse', {
            body: PRIVATE_NOTIFICATION_BODY,
            icon: '/logo192.png',
          });
        }
        if (!isConversationMuted(convId)) playMessageSound();
      }

      setConversations(prev => {
        const exists = prev.some(c => c.id === convId);
        if (!exists) return prev;
        return applyConversationSummaryToList(
          prev,
          convId,
          hydratedMsg,
          hydratedMsg.createdAt || new Date().toISOString()
        );
      });
    };

    const onTypingUpdate = ({ convId, conversationId, typing, isTyping, name, displayName }) => {
      const resolvedConvId = convId || conversationId;
      const resolvedName = displayName || name;
      const typingActive = typeof typing === 'boolean' ? typing : (typeof isTyping === 'boolean' ? isTyping : true);
      if (!resolvedConvId) return;
      const currentConvId = activeConvRef.current?.id;
      const nextDisplayName = resolvedName || 'Iemand';
      const timeoutMap = typingTimeoutsRef.current;
      const previousTimeout = timeoutMap.get(resolvedConvId);
      if (previousTimeout) {
        clearTimeout(previousTimeout);
        timeoutMap.delete(resolvedConvId);
      }

      if (typingActive) {
        setTypingByConv(prev => ({ ...prev, [resolvedConvId]: nextDisplayName }));
        const timeoutId = setTimeout(() => {
          setTypingByConv(prev => {
            if (!prev[resolvedConvId]) return prev;
            const next = { ...prev };
            delete next[resolvedConvId];
            return next;
          });
          typingTimeoutsRef.current.delete(resolvedConvId);
          if (activeConvRef.current?.id === resolvedConvId) {
            setTyping(false);
            setTypingName('');
          }
        }, 3500);
        timeoutMap.set(resolvedConvId, timeoutId);
      } else {
        setTypingByConv(prev => {
          if (!prev[resolvedConvId]) return prev;
          const next = { ...prev };
          delete next[resolvedConvId];
          return next;
        });
      }

      if (currentConvId && resolvedConvId === currentConvId) {
        if (typingActive) {
          setTyping(true);
          setTypingName(nextDisplayName);
          setTimeout(() => {
            if (msgsAreaRef.current) {
              msgsAreaRef.current.scrollTo({ top: msgsAreaRef.current.scrollHeight, behavior: 'smooth' });
            }
          }, 0);
        } else {
          setTyping(false);
          setTypingName('');
        }
      }
    };

    const onMessageStatus = ({ convId, msgId, status, receiptSummary }) => {
      if (status === 'gelezen') {
        setMessages(prev => prev.map(m =>
          (m.convId === convId || m.conversationId === convId)
            && (!msgId || m.id === msgId)
            && m.senderId === user.uid
            && !m.pending
            && !m.failed
            && m.deliveryState !== 'sending'
            && m.deliveryState !== 'failed'
            ? { ...m, status: 'gelezen', deliveryState: 'read', receiptSummary: receiptSummary || m.receiptSummary || null }
            : m
        ));
      } else if (status === 'bezorgd' && msgId) {
        setMessages(prev => prev.map(m =>
          m.id === msgId && m.status !== 'gelezen'
            ? { ...m, status: 'bezorgd', deliveryState: m.deliveryState === 'read' ? 'read' : 'delivered', receiptSummary: receiptSummary || m.receiptSummary || null }
            : m
        ));
      }
    };

    const onFriendRequest = (req) => {
      setFriendRequests(prev => [req, ...prev.filter(r => r.id !== req.id)]);
      markFriendRequestSeen?.(req);
      loadFriendRequests?.();
      if (isRealtimePopupRelevant('friend:request', req, user.uid)) {
        showErrToast?.({
          title: 'Nieuw vriendschapsverzoek',
          text: `${req?.fromName || req?.fromEmail || 'Iemand'} heeft je een vriendschapsverzoek gestuurd.`,
          tone: 'info',
        });
      }
      if (dndRef.current) return;
      try {
        const ctx   = new (window.AudioContext || window.webkitAudioContext)();
        const tones = [[600, 0], [900, 0.18]];
        let ended   = 0;
        tones.forEach(([freq, delay]) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.25);
          osc.onended = () => { if (++ended === tones.length) { try { ctx.close(); } catch (e) { console.warn('[Pulse] Fout:', e.message); } } };
        });
      } catch (e) { console.warn('[Pulse] Fout:', e.message); }
      if (Notification.permission === 'granted') {
        new Notification('Nieuwe uitnodiging in Pulse', {
          body: PRIVATE_REQUEST_NOTIFICATION_BODY,
          icon: '/logo192.png',
        });
      }
    };

    const onFriendAccepted = ({ byName }) => {
      loadContacts();
      loadFriendRequests?.();
      if (isRealtimePopupRelevant('friend:accepted', { byName }, user.uid)) {
        showErrToast?.({
          title: 'Vriendschapsverzoek geaccepteerd',
          text: `${byName || 'Je contactpersoon'} heeft je vriendschapsverzoek geaccepteerd.`,
          tone: 'success',
        });
      }
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [[500, 0], [700, 0.15], [1000, 0.30]].forEach(([freq, delay]) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.22);
          osc.onended = () => { try { ctx.close(); } catch (e) { console.warn('[Pulse] Fout:', e.message); } };
        });
      } catch (e) { console.warn('[Pulse] Fout:', e.message); }
    };

    const onFriendRequestCancelled = ({ requestId }) => {
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    };

    const onUserUpdated = ({ uid, displayName, photoURL }) => {
      setContacts(prev => prev.map(c =>
        c.uid === uid ? { ...c, displayName: displayName || c.displayName, photoURL: photoURL || c.photoURL } : c
      ));
      if (displayName) {
        setConversations(prev => prev.map(conv =>
          conv.memberNames?.[uid] ? { ...conv, memberNames: { ...conv.memberNames, [uid]: displayName } } : conv
        ));
        setActiveConv(prev => prev?.memberNames?.[uid] ? { ...prev, memberNames: { ...prev.memberNames, [uid]: displayName } } : prev);
      }
    };

    const onConversationCreated = (conversation) => {
      if (!conversation?.id) return;
      // Join de socket-room zodat berichten direct ontvangen worden
      socket.emit('conversation:join', { convId: conversation.id });
      setConversations(prev => {
        const withoutCurrent = prev.filter((conv) => conv.id !== conversation.id);
        return [conversation, ...withoutCurrent];
      });
      loadConversations?.();
    };

    const onConversationMemberAdded = ({ conversation }) => {
      if (!conversation?.id) return;
      setConversations(prev => prev.map((conv) => (
        conv.id === conversation.id ? { ...conv, ...conversation } : conv
      )));
      if (activeConvRef.current?.id === conversation.id) {
        setActiveConv((prev) => (prev?.id === conversation.id ? { ...prev, ...conversation } : prev));
      }
      loadConversations?.();
    };

    const onConversationMemberRemoved = ({ convId, uid: removedUid, removedSelf, conversation }) => {
      if (!convId) return;

      if (removedSelf && removedUid === user.uid) {
        setActiveConv((prev) => (prev?.id === convId ? null : prev));
        setMessages((prev) => (activeConvRef.current?.id === convId ? [] : prev));
        setConversations(prev => prev.filter((conv) => conv.id !== convId));
        loadConversations?.();
        return;
      }

      if (conversation?.id) {
        setConversations(prev => prev.map((conv) => (
          conv.id === conversation.id ? { ...conv, ...conversation } : conv
        )));
        if (activeConvRef.current?.id === conversation.id) {
          setActiveConv((prev) => (prev?.id === conversation.id ? { ...prev, ...conversation } : prev));
        }
      }

      loadConversations?.();
    };

    const onConversationRenamed = ({ conversation }) => {
      if (!conversation?.id) return;
      setConversations(prev => prev.map((conv) => (
        conv.id === conversation.id ? { ...conv, ...conversation } : conv
      )));
      if (activeConvRef.current?.id === conversation.id) {
        setActiveConv((prev) => (prev?.id === conversation.id ? { ...prev, ...conversation } : prev));
      }
    };
    const onConversationAdminsUpdated = ({ conversation, promotedUid, promotedByName }) => {
      onConversationRenamed({ conversation });
      if (isRealtimePopupRelevant('conversation:admins_updated', { promotedUid }, user.uid)) {
        showErrToast?.({ title: 'Beheerderrol toegekend', text: `${promotedByName || 'Een beheerder'} heeft je beheerder gemaakt in de groep '${conversation?.groupName || 'deze groep'}'.`, tone: 'success' });
      }
    };
    const onAdminPromotionRequested = ({ request }) => {
      if (!request?.id || request.targetUid !== user.uid) return;
      setConfirmDialog?.({
        type: 'admin-promotion',
        title: 'Beheerderverzoek',
        message: `${request.requestedByName || 'Een beheerder'} vraagt je beheerder te worden van de groep '${request.groupName || 'deze groep'}'.`,
        confirmLabel: 'Accepteren',
        confirmIcon: 'check',
        cancelLabel: 'Weigeren',
        cancelIcon: 'cancel',
        hideClose: true,
        onConfirm: () => {
          socket.emit('conversation:respondToAdminPromotion', { requestId: request.id, accept: true }, (res = {}) => {
            if (res.error) return showErrToast?.(res.error);
            showErrToast?.({ title: 'Beheerderrol geaccepteerd', text: 'Je bent nu beheerder.', tone: 'success' });
          });
        },
        onCancel: () => {
          socket.emit('conversation:respondToAdminPromotion', { requestId: request.id, accept: false }, (res = {}) => {
            if (res.error) return showErrToast?.(res.error);
            showErrToast?.({ text: 'Beheerderverzoek geweigerd.', tone: 'success' });
          });
        },
      });
    };

    const onConversationHardCleared = ({ convId, mode }) => {
      if (!convId) return;
      if (activeConvRef.current?.id === convId) {
        setMessages([]);
        if (mode === 'delete') setActiveConv(null);
      }
      setConversations((prev) => (
        mode === 'delete'
          ? prev.filter((conversation) => conversation.id !== convId)
          : prev.map((conversation) => (
              conversation.id === convId
                ? {
                    ...conversation,
                    lastMessage: '',
                    lastMessageAt: null,
                  }
                : conversation
            ))
      ));
      setUnreadCounts((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, convId)) return prev;
        const next = { ...prev };
        delete next[convId];
        return next;
      });
    };

    const onConversationDissolved = ({ convId }) => {
      if (!convId) return;
      if (activeConvRef.current?.id === convId) {
        setActiveConv(null);
        setMessages([]);
      }
      setConversations(prev => prev.filter((conversation) => conversation.id !== convId));
      setUnreadCounts((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, convId)) return prev;
        const next = { ...prev };
        delete next[convId];
        return next;
      });
      loadConversations?.();
    };

    const onMessageDeleted  = ({ msgId })              => setMessages(prev => prev.filter(m => m.id !== msgId));
    const onMessageEdited   = ({ msgId, text, editedAt }) => setMessages(prev => prev.map(m => (
      m.id === msgId
        ? (canApplyPlaintextEditUpdate(m) ? { ...m, text, editedAt, decryptedLocally: true } : m)
        : m
    )));
    const onMessageReaction = ({ convId, msgId, reactions, emoji, reactorId, reactionAt }) => {
      const normalizedReactions = normalizeSingleUserReaction(reactions || {}, user.uid);
      setMessages(prev => prev.map(m => (
        m.id === msgId ? { ...m, reactions: normalizedReactions } : m
      )));
      if (!convId || !emoji || !reactorId) return;
      const localMessages = activeConvRef.current?.id === convId
        ? messagesRef.current
        : msgCache.current?.[convId];
      const targetText = getMessageDisplayText(
        localMessages?.find((message) => message.id === msgId),
      );
      setConversations(prev => applyConversationReactionSummaryToList(prev, convId, {
        messageId: msgId,
        emoji,
        reactorId,
        // Keep the complete server payload for the conversation preview.  The
        // message UI only needs the current user's reaction, but filtering it
        // here drops a reaction made by the other participant and prevents
        // their chat-list preview from updating in real time.
        reactions: reactions || {},
        updatedAt: reactionAt || new Date().toISOString(),
        targetText,
      }));
    };
    const onAccountPaused   = ({ features } = {})      => setPausedFeatures({ chat: features?.chat !== false });
    const onAccountResumed  = ({ features } = {})      => setPausedFeatures({ chat: !!features?.chat });

    const onContactBlockedByParent = ({ targetUid, targetName }) => {
      setBlockedContacts?.(prev => {
        if (prev.some(c => c.uid === targetUid)) return prev;
        return [...prev, { uid: targetUid, displayName: targetName, isBlockedByParent: true }];
      });
      setParentBlockedUids?.(prev => prev.includes(targetUid) ? prev : [...prev, targetUid]);
    };
    const onContactUnblockedByParent = ({ targetUid }) => {
      setBlockedContacts?.(prev => prev.filter(c => c.uid !== targetUid));
      setParentBlockedUids?.(prev => prev.filter(uid => uid !== targetUid));
    };
    const onContactRemovedByParent = ({ targetUid }) => {
      setContacts(prev => prev.filter(c => c.uid !== targetUid));
      setActiveConv(prev => {
        if (!prev || prev.isGroup) return prev;
        const isWithTarget = prev.members?.includes(targetUid);
        return isWithTarget ? null : prev;
      });
    };

    const onMentionNotify = ({ senderName, groupName, convId }) => {
      if (dndRef.current) return;
      setMentionToast({ senderName, groupName, convId });
      setTimeout(() => setMentionToast(null), 4000);
    };

    socket.on('connect',          onConnect);
    socket.on('disconnect',       onDisconnect);
    socket.on('message:received', onMessageReceived);
    socket.on('message:new',      onMessageReceived);
    socket.on('typing:update',    onTypingUpdate);
    socket.on('typing:start',     onTypingUpdate);
    socket.on('typing:stop',      onTypingUpdate);
    socket.on('typing',           onTypingUpdate);
    socket.on('message:status',   onMessageStatus);
    socket.on('friend:request',   onFriendRequest);
    socket.on('friend:accepted',  onFriendAccepted);
    socket.on('friend:request:cancelled', onFriendRequestCancelled);
    socket.on('user:updated',     onUserUpdated);
    socket.on('message:deleted',  onMessageDeleted);
    socket.on('message:edited',   onMessageEdited);
    socket.on('message:reaction', onMessageReaction);
    socket.on('account:paused',   onAccountPaused);
    socket.on('account:resumed',  onAccountResumed);
    socket.on('mention:notify',   onMentionNotify);
    socket.on('conversation:created',       onConversationCreated);
    socket.on('conversation:member_added',  onConversationMemberAdded);
    socket.on('conversation:member_removed', onConversationMemberRemoved);
    socket.on('conversation:renamed',        onConversationRenamed);
    socket.on('conversation:admins_updated', onConversationAdminsUpdated);
    socket.on('conversation:admin_promotion_requested', onAdminPromotionRequested);
    socket.on('conversation:hardCleared',    onConversationHardCleared);
    socket.on('conversation:dissolved',      onConversationDissolved);
    socket.on('contact:blocked-by-parent',   onContactBlockedByParent);
    socket.on('contact:unblocked-by-parent', onContactUnblockedByParent);
    socket.on('contact:removed-by-parent',   onContactRemovedByParent);

    return () => {
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('message:received', onMessageReceived);
      socket.off('message:new',      onMessageReceived);
      socket.off('typing:update',    onTypingUpdate);
      socket.off('typing:start',     onTypingUpdate);
      socket.off('typing:stop',      onTypingUpdate);
      socket.off('typing',           onTypingUpdate);
      socket.off('message:status',   onMessageStatus);
      socket.off('friend:request',   onFriendRequest);
      socket.off('friend:accepted',  onFriendAccepted);
      socket.off('friend:request:cancelled', onFriendRequestCancelled);
      socket.off('message:deleted',  onMessageDeleted);
      socket.off('message:edited',   onMessageEdited);
      socket.off('message:reaction', onMessageReaction);
      socket.off('account:paused',   onAccountPaused);
      socket.off('account:resumed',  onAccountResumed);
      socket.off('user:updated',     onUserUpdated);
      socket.off('mention:notify',   onMentionNotify);
      socket.off('conversation:created',       onConversationCreated);
      socket.off('conversation:member_added',  onConversationMemberAdded);
      socket.off('conversation:member_removed', onConversationMemberRemoved);
      socket.off('conversation:renamed',        onConversationRenamed);
      socket.off('conversation:admins_updated', onConversationAdminsUpdated);
      socket.off('conversation:admin_promotion_requested', onAdminPromotionRequested);
      socket.off('conversation:hardCleared',    onConversationHardCleared);
      socket.off('conversation:dissolved',      onConversationDissolved);
      socket.off('contact:blocked-by-parent',   onContactBlockedByParent);
      socket.off('contact:unblocked-by-parent', onContactUnblockedByParent);
      socket.off('contact:removed-by-parent',   onContactRemovedByParent);
      clearTimeout(disconnectTimerRef.current);
      clearInterval(reconnectIntervalRef.current);
      typingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      typingTimeoutsRef.current.clear();
    };
  }, [socket]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // ── Inactiviteitsdetectie ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    let isInactive = false;
    let timer      = null;
    const onActivity = () => {
      clearTimeout(timer);
      if (isInactive) { isInactive = false; socket.emit('user:active'); }
      timer = setTimeout(() => { isInactive = true; socket.emit('user:inactive'); }, 60_000);
    };
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, onActivity, { passive: true }));
    onActivity();
    return () => { clearTimeout(timer); events.forEach(e => document.removeEventListener(e, onActivity)); };
  }, [socket]);

  return { connected, reconnectIn, typing, typingName, typingByConv, pausedFeatures, mentionToast, clearMentionToast: () => setMentionToast(null), playMessageSound };
}
