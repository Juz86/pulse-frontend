// src/hooks/useConversations.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket, BACKEND_URL } from '../services/socket';
import { messagingService } from '../lib/e2ee/messagingService';
import {
  buildPendingMessage,
  getConversationPreview,
  normalizeIncomingMessage,
} from '../lib/e2ee/messageModel';
import { isE2EEServiceTransportEnabled } from '../lib/e2ee/config';
import { canEditMessage, ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE } from '../lib/e2ee/policy';
import { secureKeyStore } from '../lib/e2ee/secureKeyStore';
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
  serviceTransportReady = false,
}) {
  const authFetch = useCallback(async (url, options = {}) => {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` } });
  }, [user]);

  const pendingTempIds = useRef(new Set());

  const [conversations,  setConversations]  = useState([]);
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [loadingConvs,   setLoadingConvs]   = useState(true);
  const [loadingMsgs,    setLoadingMsgs]    = useState(false);
  const [hasMore,        setHasMore]        = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [msgOffset,      setMsgOffset]      = useState(0);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  // Sync refs owned by ChatScreen
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv, activeConvRef]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations, conversationsRef]);
  useEffect(() => {
    let mounted = true;

    secureKeyStore.getIdentity(user.uid).then((identity) => {
      if (mounted) setCurrentDeviceId(identity?.deviceId || null);
    });

    return () => {
      mounted = false;
    };
  }, [user.uid]);

  function getConversationRecipients(conv) {
    if (!conv) return [];
    return Array.from(new Set((conv.members || []).filter((memberUid) => memberUid && memberUid !== user.uid)));
  }

  async function hydrateMessages(rawMessages) {
    return Promise.all(
      rawMessages.map(async (raw) => {
        try {
          return await messagingService.hydrateIncomingMessage(raw, user.uid);
        } catch {
          return normalizeIncomingMessage(raw, user.uid);
        }
      })
    );
  }

  async function markConversationMessagesAsRead(items) {
    const targets = items.filter((message) =>
      message?.protocol === 'signal_v1' &&
      message?.id &&
      message?.senderId !== user.uid
    );

    await Promise.all(targets.map((message) =>
      messagingService.sendReceipt({ user, messageId: message.id, type: 'read' }).catch(() => {})
    ));
  }

  function shouldUseServiceTransport(conv) {
    return isE2EEServiceTransportEnabled && serviceTransportReady && !!currentDeviceId && getConversationRecipients(conv).length > 0;
  }

  function patchMessageAsSending(messageId, retryCount = 0) {
    setMessages(prev => prev.map((message) => (
      message.id === messageId
        ? {
            ...message,
            pending: true,
            failed: false,
            _retryCount: retryCount,
            _retrying: retryCount > 0,
            deliveryState: 'sending',
          }
        : message
    )));
  }

  function patchMessageAsFailed(messageId) {
    setMessages(prev => prev.map((message) => (
      message.id === messageId
        ? {
            ...message,
            pending: false,
            failed: true,
            _retrying: false,
            deliveryState: 'failed',
          }
        : message
    )));
  }

  function patchMessageAsSent(messageId, savedMsg, fallbackKey = messageId) {
    setMessages(prev => prev.map((message) => (
      message.id === messageId
        ? {
            ...normalizeIncomingMessage(savedMsg, user.uid),
            _key: fallbackKey,
            pending: false,
            failed: false,
            _retrying: false,
            deliveryState: 'sent',
          }
        : message
    )));
  }

  async function sendViaService({ conv, plaintext, recipientUserIds, replyToMessageId, messageType = 'text', sharedContact = null, attachment = null }) {
    const result = await messagingService.sendMessage({
      user,
      conversationId: conv.id,
      recipientUserIds,
      plaintext,
      replyToMessageId,
      messageType,
      sharedContact,
      attachment,
    }, currentDeviceId);

    return {
      id: result.messageId,
      conversationId: conv.id,
      senderId: user.uid,
      senderUserId: user.uid,
      senderDeviceId: currentDeviceId,
      text: messageType === 'contact'
        ? `Contactpersoon: ${sharedContact?.name || 'Contactpersoon'}`
        : messageType === 'attachment'
          ? (attachment?.caption || attachment?.name || 'Bijlage')
        : plaintext,
      createdAt: new Date().toISOString(),
      protocol: 'signal_v1',
      deliveryState: 'sent',
      replyToMessageId,
      type: messageType,
      messageType,
      sharedContact,
      attachment,
    };
  }

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
  }, [authFetch, setConvLabels, showErrToast, user.uid]);

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
      const hydrated = await hydrateMessages(arr);
      if (activeConvRef.current?.id !== convId) return;
      msgCache.current[convId] = hydrated;
      markConversationMessagesAsRead(hydrated).catch(() => {});
      setMessages(prev => {
        const fetchedIds = new Set(hydrated.map(m => m.id).filter(Boolean));
        const live = prev.filter(m => {
          if (!m.id) return false;
          if (fetchedIds.has(m.id)) return false;
          // Stale tempId: al bevestigd door server maar state nog niet bijgewerkt
          if (m.id.startsWith('temp-') && !pendingTempIds.current.has(m.id)) return false;
          return true;
        });
        return [...hydrated, ...live];
      });
      setMsgOffset(hydrated.length);
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
      const hydrated = await hydrateMessages(arr);
      setMessages(prev => [...hydrated, ...prev]);
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
    if (!canEditMessage(editingMsg)) {
      showErrToast(ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE);
      setEditingMsg(null);
      setText('');
      return;
    }
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
    if (!socket?.connected && !shouldUseServiceTransport(activeConv)) { showErrToast('Geen verbinding. Controleer je internet en probeer opnieuw.'); return; }
    const tempId = `temp-${Date.now()}`;
    const trimmedText = text.trim();
    const mentions = pendingMentions.filter(m => trimmedText.includes(`@${m.displayName}`)).map(m => m.uid);
    const recipientUserIds = getConversationRecipients(activeConv);
    const optimisticMsg = {
      ...buildPendingMessage({
        text: trimmedText,
        conversationId: activeConv.id,
        userId: user.uid,
        replyTo: replyTo || null,
        mentions,
      }),
      id: tempId,
      convId: activeConv.id,
      senderName: user.displayName || user.email,
      mentions,
      _key: tempId,
      _retryCount: 0,
    };
    const msg = {
      convId: activeConv.id, senderId: user.uid, senderName: user.displayName || user.email,
      text: trimmedText, createdAt: optimisticMsg.createdAt,
      protocol: 'signal_v1',
      senderDeviceId: currentDeviceId,
      ...(replyTo ? { replyTo } : {}),
      ...(mentions.length > 0 ? { mentions } : {}),
    };
    setReplyTo(null);
    pendingTempIds.current.add(optimisticMsg.id);
    setMessages(prev => [...prev, optimisticMsg]);
    savePending(optimisticMsg.id, activeConv.id, msg);
    setTimeout(() => { if (msgsAreaRef.current) msgsAreaRef.current.scrollTop = msgsAreaRef.current.scrollHeight; }, 50);
    setConversations(prev => {
      const updated = prev.map(c => c.id === activeConv.id ? { ...c, lastMessage: getConversationPreview(optimisticMsg), updatedAt: msg.createdAt, lastCallDirection: null, lastCallSenderId: null, lastCallIsVideo: null } : c);
      return [...updated].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
    });
    const failTimer = setTimeout(() => {
      patchMessageAsFailed(optimisticMsg.id);
    }, 20000);

    if (shouldUseServiceTransport(activeConv)) {
      sendViaService({
        conv: activeConv,
        plaintext: trimmedText,
        recipientUserIds,
        replyToMessageId: replyTo?.id || null,
        mentions,
      }).then((savedMsg) => {
        clearTimeout(failTimer);
        pendingTempIds.current.delete(optimisticMsg.id);
        patchMessageAsSent(optimisticMsg.id, savedMsg, optimisticMsg.id);
        removePending(optimisticMsg.id);
      }).catch(() => {
        clearTimeout(failTimer);
        patchMessageAsFailed(optimisticMsg.id);
      });
    } else {
      socket.emit('message:send', { convId: activeConv.id, message: msg }, (savedMsg) => {
        clearTimeout(failTimer);
        if (savedMsg?.id) {
          pendingTempIds.current.delete(optimisticMsg.id);
          patchMessageAsSent(optimisticMsg.id, savedMsg, optimisticMsg.id);
          removePending(optimisticMsg.id);
        }
      });
    }

    setText('');
    localStorage.removeItem(`pulse_draft_${user.uid}_${activeConv.id}`);
    setPendingMentions([]);
    setMentionSuggestions([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    stopTyping();
  }

  function sendContactCardToConversation(conv, sharedContact) {
    const socket = getSocket();
    if ((!socket?.connected && !shouldUseServiceTransport(conv)) || !conv || !sharedContact) return;

    const normalizedSharedContact = {
      uid: sharedContact.uid || null,
      name: sharedContact.name || 'Contactpersoon',
      email: sharedContact.email || '',
    };
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      ...buildPendingMessage({
        text: `Contactpersoon: ${normalizedSharedContact.name}`,
        conversationId: conv.id,
        userId: user.uid,
        type: 'contact',
        sharedContact: normalizedSharedContact,
      }),
      id: tempId,
      convId: conv.id,
      senderName: user.displayName || user.email,
      _key: tempId,
      _retryCount: 0,
    };
    const isActiveConversation = activeConvRef.current?.id === conv.id;

    if (isActiveConversation) {
      pendingTempIds.current.add(optimisticMsg.id);
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => {
        if (msgsAreaRef.current) msgsAreaRef.current.scrollTop = msgsAreaRef.current.scrollHeight;
      }, 50);
    }

    setConversations(prev => {
      const updated = prev.map((item) => (
        item.id === conv.id
          ? {
              ...item,
              lastMessage: getConversationPreview(optimisticMsg),
              updatedAt: optimisticMsg.createdAt,
              lastCallDirection: null,
              lastCallSenderId: null,
              lastCallIsVideo: null,
            }
          : item
      ));
      return [...updated].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
    });

    if (shouldUseServiceTransport(conv)) {
      const recipientUserIds = getConversationRecipients(conv);
      sendViaService({
        conv,
        plaintext: optimisticMsg.text,
        recipientUserIds,
        replyToMessageId: null,
        messageType: 'contact',
        sharedContact: normalizedSharedContact,
      }).then((savedMsg) => {
        if (!isActiveConversation) return;
        pendingTempIds.current.delete(optimisticMsg.id);
        patchMessageAsSent(optimisticMsg.id, savedMsg, optimisticMsg.id);
      }).catch(() => {
        if (!isActiveConversation) return;
        patchMessageAsFailed(optimisticMsg.id);
      });
      return;
    }

    socket.emit('message:send', {
      convId: conv.id,
      message: {
        convId: conv.id,
        senderId: user.uid,
        senderName: user.displayName || user.email,
        type: 'contact',
        sharedContact: normalizedSharedContact,
        createdAt: optimisticMsg.createdAt,
      },
    });
  }

  function sendAttachmentToConversation(conv, attachment) {
    const socket = getSocket();
    if ((!socket?.connected && !shouldUseServiceTransport(conv)) || !conv || !attachment) return;

    const normalizedAttachment = {
      name: attachment.name || 'Bestand',
      url: attachment.url || '',
      mimeType: attachment.mimeType || '',
      size: attachment.size || null,
      caption: attachment.caption || '',
    };
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      ...buildPendingMessage({
        text: normalizedAttachment.caption || normalizedAttachment.name,
        conversationId: conv.id,
        userId: user.uid,
        type: 'attachment',
        attachment: normalizedAttachment,
      }),
      id: tempId,
      convId: conv.id,
      senderName: user.displayName || user.email,
      _key: tempId,
      _retryCount: 0,
    };
    const isActiveConversation = activeConvRef.current?.id === conv.id;

    if (isActiveConversation) {
      pendingTempIds.current.add(optimisticMsg.id);
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => {
        if (msgsAreaRef.current) msgsAreaRef.current.scrollTop = msgsAreaRef.current.scrollHeight;
      }, 50);
    }

    setConversations(prev => {
      const updated = prev.map((item) => (
        item.id === conv.id
          ? {
              ...item,
              lastMessage: getConversationPreview(optimisticMsg),
              updatedAt: optimisticMsg.createdAt,
              lastCallDirection: null,
              lastCallSenderId: null,
              lastCallIsVideo: null,
            }
          : item
      ));
      return [...updated].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
    });

    if (shouldUseServiceTransport(conv)) {
      const recipientUserIds = getConversationRecipients(conv);
      sendViaService({
        conv,
        plaintext: normalizedAttachment.caption || normalizedAttachment.name,
        recipientUserIds,
        replyToMessageId: null,
        messageType: 'attachment',
        attachment: normalizedAttachment,
      }).then((savedMsg) => {
        if (!isActiveConversation) return;
        pendingTempIds.current.delete(optimisticMsg.id);
        patchMessageAsSent(optimisticMsg.id, savedMsg, optimisticMsg.id);
      }).catch(() => {
        if (!isActiveConversation) return;
        patchMessageAsFailed(optimisticMsg.id);
      });
      return;
    }

    socket.emit('message:send', {
      convId: conv.id,
      message: {
        convId: conv.id,
        senderId: user.uid,
        senderName: user.displayName || user.email,
        type: 'attachment',
        text: normalizedAttachment.caption || normalizedAttachment.name,
        attachment: normalizedAttachment,
        createdAt: optimisticMsg.createdAt,
      },
    });
  }

  function retryMessage(failedMsg) {
    const socket = getSocket();
    if ((!socket?.connected && !shouldUseServiceTransport(activeConv)) || !activeConv) return;
    const retryCount = (failedMsg._retryCount || 0) + 1;
    const recipientUserIds = getConversationRecipients(activeConv);
    patchMessageAsSending(failedMsg.id, retryCount);
    const failTimer = setTimeout(() => {
      patchMessageAsFailed(failedMsg.id);
    }, 20000);
    if (shouldUseServiceTransport(activeConv)) {
      sendViaService({
        conv: activeConv,
        plaintext: failedMsg.text,
        recipientUserIds,
        replyToMessageId: failedMsg.replyTo?.messageId || failedMsg.replyTo?.id || null,
      }).then((savedMsg) => {
        clearTimeout(failTimer);
        pendingTempIds.current.delete(failedMsg.id);
        patchMessageAsSent(failedMsg.id, savedMsg, failedMsg.id);
        removePending(failedMsg.id);
      }).catch(() => {
        clearTimeout(failTimer);
        patchMessageAsFailed(failedMsg.id);
      });
    } else {
      socket.emit('message:send', { convId: activeConv.id, message: { ...failedMsg, createdAt: new Date().toISOString() } }, (savedMsg) => {
        clearTimeout(failTimer);
        if (savedMsg?.id) {
          pendingTempIds.current.delete(failedMsg.id);
          patchMessageAsSent(failedMsg.id, savedMsg, failedMsg.id);
          removePending(failedMsg.id);
        }
      });
    }
  }

  function retryAllFailed() {
    const conv = activeConvRef.current;
    if (!conv) return;
    messages
      .filter(m => (m.deliveryState === 'failed' || m.failed) && (m._retryCount || 0) < 3)
      .forEach(msg => retryMessage(msg));
  }

  function toggleReaction(msgId, emoji) {
    const socket = getSocket();
    if (!activeConv) return;
    if (shouldUseServiceTransport(activeConv)) {
      authFetch(`${BACKEND_URL}/messages/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConv.id,
          msgId,
          emoji,
        }),
      })
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) throw new Error(data?.error || 'reaction_failed');
          setMessages(prev => prev.map(m => (
            m.id === msgId ? { ...m, reactions: data.reactions || {} } : m
          )));
        })
        .catch(() => {
          showErrToast('Reactie bijwerken mislukt');
        });
      setReactionPickerMsgId(null);
      return;
    }
    if (!socket?.connected) return;
    socket.emit('message:react', { convId: activeConv.id, msgId, emoji });
    setReactionPickerMsgId(null);
  }

  async function forwardToConv(conv) {
    const socket = getSocket();
    if ((!socket?.connected && !shouldUseServiceTransport(conv)) || !forwardMsg) return;
    const recipientUserIds = getConversationRecipients(conv);
    const msg = {
      convId: conv.id, senderId: user.uid, senderName: user.displayName || user.email,
      text: `↪️ ${forwardMsg.text}`, createdAt: new Date().toISOString(),
      protocol: 'signal_v1',
      senderDeviceId: currentDeviceId,
    };
    if (shouldUseServiceTransport(conv)) {
      try {
        await sendViaService({
          conv,
          plaintext: msg.text,
          recipientUserIds,
          replyToMessageId: null,
        });
      } catch {
        showErrToast('Doorsturen mislukt');
        return;
      }
    } else {
      socket.emit('message:send', { convId: conv.id, message: msg });
    }
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
    currentDeviceId,
    loadConversations, openConversation, deleteConversation, loadMoreMessages,
    sendMessage, sendEditedMessage, stopTyping, retryMessage, retryAllFailed, toggleReaction,
    sendContactCardToConversation, sendAttachmentToConversation,
    forwardToConv, deleteMessage,
    toggleGroupMember, createGroup, addMemberToGroup, removeMemberFromGroup,
  };
}
