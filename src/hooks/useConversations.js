// src/hooks/useConversations.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket, BACKEND_URL } from '../services/socket';
import { toMs } from '../utils';

const MSG_LIMIT = 30;

export default function useConversations({
  user,
  text, setText,
  setActiveTab,
  setShowChatSearch, setChatSearch,
  replyTo, setReplyTo,
  editingMsg, setEditingMsg,
  setReactionPickerMsgId,
  forwardMsg, setForwardMsg,
  pendingMentions, setPendingMentions, setMentionSuggestions,
  setUnreadCounts,
  convLabels, setConvLabels,
  setChatFading,
  groupName, setGroupName,
  groupMembers, setGroupMembers,
  setShowNewGroup,
  setAddingMember,
  showErrToast, setConfirmDialog,
  msgCache, msgsAreaRef, activeConvRef, conversationsRef, textareaRef, typingTimer,
}) {
  async function authFetch(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` } });
  }

  const pendingTempIds = useRef(new Set());

  const [conversations,  setConversations]  = useState([]);
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [loadingConvs,   setLoadingConvs]   = useState(true);
  const [loadingMsgs,    setLoadingMsgs]    = useState(false);
  const [hasMore,        setHasMore]        = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [msgOffset,      setMsgOffset]      = useState(0);

  // Sync refs owned by ChatScreen
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // ── Gesprekken laden ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/conversations/${user.uid}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const stored = (() => { try { return JSON.parse(localStorage.getItem(`pulse_labels_${user.uid}`) || '{}'); } catch { return {}; } })();
        let updated = false;
        data.forEach(conv => {
          if (!conv.isGroup && !stored[conv.id]) {
            const otherUid = (conv.members || []).find(m => m !== user.uid);
            const otherEmail = conv.memberEmails?.[otherUid] || '';
            if (otherEmail.endsWith('@pulse.internal')) { stored[conv.id] = 'familie'; updated = true; }
          }
        });
        if (updated) { localStorage.setItem(`pulse_labels_${user.uid}`, JSON.stringify(stored)); setConvLabels(stored); }
      }
      setConversations(Array.isArray(data) ? data : []);
      const sock = getSocket();
      if (sock && Array.isArray(data)) {
        data.forEach(conv => sock.emit('conversation:join', { convId: conv.id }));
        sock.emit('users:online:request');
      }
    } catch { showErrToast('Gesprekken laden mislukt'); }
    finally { setLoadingConvs(false); }
  }, [user.uid]);

  // ── Gesprek openen ────────────────────────────────────────────────────────
  async function openConversation(conv) {
    const convId = conv.id;
    if (activeConvRef.current?.id && text.trim()) {
      localStorage.setItem(`pulse_draft_${user.uid}_${activeConvRef.current.id}`, text.trim());
    } else if (activeConvRef.current?.id) {
      localStorage.removeItem(`pulse_draft_${user.uid}_${activeConvRef.current.id}`);
    }
    setActiveConv(conv);
    activeConvRef.current = conv;
    const draft = localStorage.getItem(`pulse_draft_${user.uid}_${convId}`) || '';
    setText(draft);
    setActiveTab('chats');
    setShowChatSearch(false);
    setChatSearch('');
    setMsgOffset(0);
    setHasMore(false);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[conv.id]; return n; });
    const cached = msgCache.current[convId];
    if (cached) { setMessages(cached); setLoadingMsgs(false); }
    else { setMessages([]); setLoadingMsgs(true); }
    setChatFading(true);
    setTimeout(() => setChatFading(false), 150);
    const liveSocket = getSocket();
    liveSocket?.emit('conversation:join', { convId: conv.id });
    liveSocket?.emit('messages:read', { convId: conv.id });
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/messages/${conv.id}?limit=${MSG_LIMIT}&offset=0`);
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : [];
      if (activeConvRef.current?.id !== convId) return;
      msgCache.current[convId] = arr;
      setMessages(prev => {
        const fetchedIds = new Set(arr.map(m => m.id).filter(Boolean));
        const live = prev.filter(m => {
          if (!m.id) return false;
          if (fetchedIds.has(m.id)) return false;
          // Stale tempId: al bevestigd door server maar state nog niet bijgewerkt
          if (m.id.startsWith('temp-') && !pendingTempIds.current.has(m.id)) return false;
          return true;
        });
        return [...arr, ...live];
      });
      setMsgOffset(arr.length);
      setHasMore(arr.length === MSG_LIMIT);
      setTimeout(() => { if (msgsAreaRef.current) msgsAreaRef.current.scrollTop = msgsAreaRef.current.scrollHeight; }, 100);
    } catch (e) {
      if (activeConvRef.current?.id === convId) showErrToast('Berichten laden mislukt');
    }
    finally { setLoadingMsgs(false); }
  }

  // ── Gesprek verwijderen ───────────────────────────────────────────────────
  async function deleteConversation(e, convId) {
    e.stopPropagation();
    setConfirmDialog({
      message: 'Weet je zeker dat je dit gesprek wilt verwijderen?',
      onConfirm: async () => {
        try {
          await authFetch(`${BACKEND_URL}/api/conversations/${convId}`, { method: 'DELETE' });
        } catch { showErrToast('Verwijderen mislukt'); }
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (activeConv?.id === convId) { setActiveConv(null); setMessages([]); }
      },
    });
  }

  // ── Meer berichten laden ──────────────────────────────────────────────────
  async function loadMoreMessages() {
    if (!activeConv || loadingMore) return;
    setLoadingMore(true);
    try {
      const res  = await authFetch(`${BACKEND_URL}/api/messages/${activeConv.id}?limit=${MSG_LIMIT}&offset=${msgOffset}`);
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : [];
      setMessages(prev => [...arr, ...prev]);
      setMsgOffset(prev => prev + arr.length);
      setHasMore(arr.length === MSG_LIMIT);
    } catch { showErrToast('Meer berichten laden mislukt'); }
    finally { setLoadingMore(false); }
  }

  // ── Lokale pending-berichten backup ──────────────────────────────────────
  function savePending(tempId, convId, msg) {
    try {
      const key  = `pulse_pending_${user.uid}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push({ tempId, convId, msg });
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }
  function removePending(tempId) {
    try {
      const key  = `pulse_pending_${user.uid}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(list.filter(m => m.tempId !== tempId)));
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }

  // ── Berichten ─────────────────────────────────────────────────────────────
  function stopTyping() {
    clearTimeout(typingTimer.current);
    const conv = activeConvRef.current;
    if (conv) getSocket()?.emit('typing:stop', { convId: conv.id });
  }

  function sendEditedMessage() {
    const socket = getSocket();
    if (!editingMsg || !text.trim() || !socket?.connected) return;
    const trimmed = text.trim();
    socket.emit('message:edit', { convId: activeConv.id, msgId: editingMsg.id, newText: trimmed }, (res) => {
      if (res?.error) return showErrToast(res.error);
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, text: trimmed, editedAt: new Date().toISOString() } : m));
    });
    setEditingMsg(null);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function sendMessage() {
    const socket = getSocket();
    if (editingMsg) return sendEditedMessage();
    if (!text.trim() || !activeConv) return;
    if (!socket?.connected) { showErrToast('Geen verbinding. Controleer je internet en probeer opnieuw.'); return; }
    const tempId = `temp-${Date.now()}`;
    const trimmedText = text.trim();
    const mentions = pendingMentions.filter(m => trimmedText.includes(`@${m.displayName}`)).map(m => m.uid);
    const msg = {
      convId: activeConv.id, senderId: user.uid, senderName: user.displayName || user.email,
      text: trimmedText, createdAt: new Date().toISOString(),
      ...(replyTo ? { replyTo } : {}),
      ...(mentions.length > 0 ? { mentions } : {}),
    };
    setReplyTo(null);
    pendingTempIds.current.add(tempId);
    setMessages(prev => [...prev, { ...msg, id: tempId, _key: tempId, pending: true, _retryCount: 0 }]);
    savePending(tempId, activeConv.id, msg);
    setTimeout(() => { if (msgsAreaRef.current) msgsAreaRef.current.scrollTop = msgsAreaRef.current.scrollHeight; }, 50);
    setConversations(prev => {
      const updated = prev.map(c => c.id === activeConv.id ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt, lastCallDirection: null, lastCallSenderId: null, lastCallIsVideo: null } : c);
      return [...updated].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
    });
    const failTimer = setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, pending: false, failed: true } : m));
    }, 20000);
    socket.emit('message:send', { convId: activeConv.id, message: msg }, (savedMsg) => {
      clearTimeout(failTimer);
      if (savedMsg?.id) {
        pendingTempIds.current.delete(tempId);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...savedMsg, _key: tempId, pending: false, failed: false } : m));
        removePending(tempId);
      }
    });
    setText('');
    localStorage.removeItem(`pulse_draft_${user.uid}_${activeConv.id}`);
    setPendingMentions([]);
    setMentionSuggestions([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    stopTyping();
  }

  function retryMessage(failedMsg) {
    const socket = getSocket();
    if (!socket?.connected || !activeConv) return;
    const retryCount = (failedMsg._retryCount || 0) + 1;
    setMessages(prev => prev.map(m => m.id === failedMsg.id
      ? { ...m, pending: true, failed: false, _retryCount: retryCount, _retrying: true }
      : m
    ));
    const failTimer = setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === failedMsg.id
        ? { ...m, pending: false, failed: true, _retrying: false }
        : m
      ));
    }, 20000);
    socket.emit('message:send', { convId: activeConv.id, message: { ...failedMsg, createdAt: new Date().toISOString() } }, (savedMsg) => {
      clearTimeout(failTimer);
      if (savedMsg?.id) {
        pendingTempIds.current.delete(failedMsg.id);
        setMessages(prev => prev.map(m => m.id === failedMsg.id
          ? { ...savedMsg, _key: failedMsg.id, pending: false, failed: false, _retrying: false }
          : m
        ));
        removePending(failedMsg.id);
      }
    });
  }

  function retryAllFailed() {
    const conv = activeConvRef.current;
    if (!conv) return;
    messages
      .filter(m => m.failed && (m._retryCount || 0) < 3)
      .forEach(msg => retryMessage(msg));
  }

  function toggleReaction(msgId, emoji) {
    const socket = getSocket();
    if (!socket?.connected || !activeConv) return;
    socket.emit('message:react', { convId: activeConv.id, msgId, emoji });
    setReactionPickerMsgId(null);
  }

  function forwardToConv(conv) {
    const socket = getSocket();
    if (!socket?.connected || !forwardMsg) return;
    const msg = {
      convId: conv.id, senderId: user.uid, senderName: user.displayName || user.email,
      text: `↪️ ${forwardMsg.text}`, createdAt: new Date().toISOString(),
    };
    socket.emit('message:send', { convId: conv.id, message: msg });
    setForwardMsg(null);
    showErrToast('📋 Bericht doorgestuurd');
  }

  async function deleteMessage(msgId, scope) {
    try {
      await authFetch(`${BACKEND_URL}/api/messages/${activeConv.id}/${msgId}?scope=${scope}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (e) { console.warn('[Pulse] Fout:', e.message); }
  }

  // ── Groepen ───────────────────────────────────────────────────────────────
  function toggleGroupMember(contact) {
    setGroupMembers(prev => prev.find(c => c.uid === contact.uid) ? prev.filter(c => c.uid !== contact.uid) : [...prev, contact]);
  }

  function createGroup() {
    const socket = getSocket();
    if (!socket || !groupName.trim() || groupMembers.length === 0) return;
    const memberUids  = [user.uid, ...groupMembers.map(c => c.uid)];
    const memberNames = Object.fromEntries([[user.uid, user.displayName || user.email], ...groupMembers.map(c => [c.uid, c.displayName])]);
    socket.emit('conversation:create', { members: memberUids, memberNames, isGroup: true, groupName: groupName.trim() }, ({ convId, error }) => {
      if (error) return showErrToast(error);
      const conv = { id: convId, members: memberUids, memberNames, isGroup: true, groupName: groupName.trim(), creatorId: user.uid };
      setShowNewGroup(false); setGroupName(''); setGroupMembers([]);
      openConversation(conv); loadConversations();
    });
  }

  function addMemberToGroup(contact) {
    const socket = getSocket();
    if (!socket || !activeConv) return;
    socket.emit('conversation:addMember', { convId: activeConv.id, uid: contact.uid, displayName: contact.displayName }, (res = {}) => {
      if (res.error) return showErrToast(res.error);
      setActiveConv(prev => ({
        ...prev,
        members:     [...prev.members, contact.uid],
        memberNames: { ...prev.memberNames, [contact.uid]: contact.displayName },
      }));
      setAddingMember(false);
    });
  }

  function removeMemberFromGroup(uid) {
    const socket = getSocket();
    if (!socket || !activeConv) return;
    setConfirmDialog({
      message: 'Weet je zeker dat je deze persoon wilt verwijderen uit de groep?',
      onConfirm: () => {
        socket.emit('conversation:removeMember', { convId: activeConv.id, uid }, (res = {}) => {
          if (res.error) return showErrToast(res.error);
          setActiveConv(prev => {
            const members     = prev.members.filter(m => m !== uid);
            const memberNames = { ...prev.memberNames };
            delete memberNames[uid];
            return { ...prev, members, memberNames };
          });
        });
      },
    });
  }

  return {
    conversations, setConversations,
    activeConv, setActiveConv,
    messages, setMessages,
    loadingConvs, loadingMsgs, hasMore, loadingMore, msgOffset, setMsgOffset,
    loadConversations, openConversation, deleteConversation, loadMoreMessages,
    sendMessage, sendEditedMessage, stopTyping, retryMessage, retryAllFailed, toggleReaction,
    forwardToConv, deleteMessage,
    toggleGroupMember, createGroup, addMemberToGroup, removeMemberFromGroup,
  };
}
