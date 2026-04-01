// src/hooks/useChat.js
import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';

const PRIVATE_NOTIFICATION_BODY = 'Open Pulse om het bericht veilig te bekijken.';
const PRIVATE_REQUEST_NOTIFICATION_BODY = 'Open Pulse om de uitnodiging te bekijken.';

export default function useChat({
  user,
  activeConvRef,
  conversationsRef,
  msgsAreaRef,
  dndRef,
  audioCtxRef,
  loadConversations,
  loadContacts,
  setMessages,
  setConversations,
  setUnreadCounts,
  setFriendRequests,
  setContactSuccess,
  setContacts,
  setActiveConv,
  setBlockedContacts,
  setParentBlockedUids,
  onReconnect,
}) {
  const disconnectTimerRef   = useRef(null);
  const reconnectIntervalRef = useRef(null);
  const socket = getSocket();

  const [connected,      setConnected]      = useState(true);
  const [reconnectIn,    setReconnectIn]    = useState(null);
  const [typing,         setTyping]         = useState(false);
  const [typingName,     setTypingName]     = useState('');
  const [pausedFeatures, setPausedFeatures] = useState({ chat: false, call: false, video: false });
  const [mentionToast,   setMentionToast]   = useState(null);

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

  // ── Socket events ─────────────────────────────────────────────────────────
  /* eslint-disable react-hooks/exhaustive-deps */
  // This socket wiring is intentionally attached to the live socket lifecycle.
  // The referenced setters/refs are stable inputs from React and parent hooks.
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      clearTimeout(disconnectTimerRef.current);
      clearInterval(reconnectIntervalRef.current);
      setConnected(true);
      setReconnectIn(null);
      conversationsRef.current.forEach(conv => socket.emit('conversation:join', { convId: conv.id }));
      socket.emit('users:online:request');
      // Herverstuurd mislukte berichten zodra socket daadwerkelijk connected is
      onReconnect?.();
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

    const onMessageReceived = (msg) => {
      const current = activeConvRef.current;
      if (current?.id === msg.convId) {
        setMessages(prev => {
          if (msg.type === 'call') {
            const callPendingIdx = prev.findIndex(m => m.pending && m.type === 'call' && m.senderId === msg.senderId);
            if (callPendingIdx !== -1) {
              const next = [...prev];
              next[callPendingIdx] = { ...msg, pending: false };
              return next;
            }
            if (prev.some(m => m.id && m.id === msg.id)) return prev;
            return [...prev, msg];
          }
          const pendingIdx = prev.findIndex(m => m.pending && m.senderId === msg.senderId && m.text === msg.text);
          if (pendingIdx !== -1) {
            const next = [...prev];
            next[pendingIdx] = { ...msg, pending: false };
            return next;
          }
          if (prev.some(m => m.id && m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => {
          if (msgsAreaRef.current) msgsAreaRef.current.scrollTo({ top: msgsAreaRef.current.scrollHeight, behavior: 'smooth' });
        }, 50);
        playMessageSound();
      } else if (msg.senderId !== user.uid) {
        setUnreadCounts(prev => ({ ...prev, [msg.convId]: (prev[msg.convId] || 0) + 1 }));
        if (Notification.permission === 'granted' && document.hidden) {
          new Notification('Nieuw bericht in Pulse', {
            body: PRIVATE_NOTIFICATION_BODY,
            icon: '/logo192.png',
          });
        }
        playMessageSound();
      }

      const previewText = msg.type === 'contact'
        ? `Contactpersoon: ${msg.sharedContact?.name || ''}`
        : msg.type === 'call'
          ? (() => {
              const isOwn = msg.senderId === user.uid;
              const iv    = msg.isVideo;
              if (msg.direction === 'completed') return iv ? 'Video-oproep' : 'Spraakoproep';
              if (msg.direction === 'declined')  return isOwn ? 'Geweigerd' : (iv ? 'Gemiste video-oproep' : 'Gemiste spraakoproep');
              return isOwn ? 'Geen antwoord' : (iv ? 'Gemiste video-oproep' : 'Gemiste spraakoproep');
            })()
          : (msg.text || '');

      setConversations(prev => {
        const exists = prev.some(c => c.id === msg.convId);
        if (!exists) return prev;
        const callMeta = msg.type === 'call'
          ? { lastCallSenderId: msg.senderId, lastCallDirection: msg.direction, lastCallIsVideo: !!msg.isVideo }
          : { lastCallDirection: null, lastCallSenderId: null, lastCallIsVideo: null };
        const target = prev.find(c => c.id === msg.convId);
        const rest   = prev.filter(c => c.id !== msg.convId);
        return [{ ...target, lastMessage: previewText, updatedAt: msg.createdAt || new Date().toISOString(), ...callMeta }, ...rest];
      });
    };

    const onTypingUpdate = ({ typing, name }) => {
      if (typing) { setTyping(true); setTypingName(name || 'Iemand'); }
      else setTyping(false);
    };

    const onMessageStatus = ({ convId, msgId, status }) => {
      if (status === 'gelezen') {
        setMessages(prev => prev.map(m =>
          m.convId === convId && m.senderId === user.uid ? { ...m, status: 'gelezen' } : m
        ));
      } else if (status === 'bezorgd' && msgId) {
        setMessages(prev => prev.map(m =>
          m.id === msgId && m.status !== 'gelezen' ? { ...m, status: 'bezorgd' } : m
        ));
      }
    };

    const onFriendRequest = (req) => {
      setFriendRequests(prev => [req, ...prev.filter(r => r.id !== req.id)]);
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
      setContactSuccess(`${byName} heeft je uitnodiging geaccepteerd!`);
      setTimeout(() => setContactSuccess(''), 4000);
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

    const onMessageDeleted  = ({ msgId })              => setMessages(prev => prev.filter(m => m.id !== msgId));
    const onMessageEdited   = ({ msgId, text, editedAt }) => setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text, editedAt } : m));
    const onMessageReaction = ({ msgId, reactions })   => setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    const onAccountPaused   = ({ features } = {})      => setPausedFeatures(features || { chat: true,  call: true,  video: true  });
    const onAccountResumed  = ({ features } = {})      => setPausedFeatures(features || { chat: false, call: false, video: false });

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

    const onMentionNotify = ({ senderName, groupName }) => {
      if (dndRef.current) return;
      setMentionToast({ senderName, groupName });
      setTimeout(() => setMentionToast(null), 4000);
    };

    socket.on('connect',          onConnect);
    socket.on('disconnect',       onDisconnect);
    socket.on('message:received', onMessageReceived);
    socket.on('typing:update',    onTypingUpdate);
    socket.on('message:status',   onMessageStatus);
    socket.on('friend:request',   onFriendRequest);
    socket.on('friend:accepted',  onFriendAccepted);
    socket.on('user:updated',     onUserUpdated);
    socket.on('message:deleted',  onMessageDeleted);
    socket.on('message:edited',   onMessageEdited);
    socket.on('message:reaction', onMessageReaction);
    socket.on('account:paused',   onAccountPaused);
    socket.on('account:resumed',  onAccountResumed);
    socket.on('mention:notify',   onMentionNotify);
    socket.on('contact:blocked-by-parent',   onContactBlockedByParent);
    socket.on('contact:unblocked-by-parent', onContactUnblockedByParent);
    socket.on('contact:removed-by-parent',   onContactRemovedByParent);

    return () => {
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('message:received', onMessageReceived);
      socket.off('typing:update',    onTypingUpdate);
      socket.off('message:status',   onMessageStatus);
      socket.off('friend:request',   onFriendRequest);
      socket.off('friend:accepted',  onFriendAccepted);
      socket.off('message:deleted',  onMessageDeleted);
      socket.off('message:edited',   onMessageEdited);
      socket.off('message:reaction', onMessageReaction);
      socket.off('account:paused',   onAccountPaused);
      socket.off('account:resumed',  onAccountResumed);
      socket.off('user:updated',     onUserUpdated);
      socket.off('mention:notify',   onMentionNotify);
      socket.off('contact:blocked-by-parent',   onContactBlockedByParent);
      socket.off('contact:unblocked-by-parent', onContactUnblockedByParent);
      socket.off('contact:removed-by-parent',   onContactRemovedByParent);
      clearTimeout(disconnectTimerRef.current);
      clearInterval(reconnectIntervalRef.current);
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

  return { connected, reconnectIn, typing, typingName, pausedFeatures, mentionToast, playMessageSound };
}
