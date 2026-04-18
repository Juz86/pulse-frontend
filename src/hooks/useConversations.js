// src/hooks/useConversations.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket, BACKEND_URL } from '../services/socket';
import { messagingService } from '../lib/e2ee/messagingService';
import {
  buildSocketMessagePayload,
  buildServiceMessageResult,
  buildForwardServicePayload,
  buildRetryServicePayload,
  resolveOutgoingMessageDisplayText,
  SOCKET_FALLBACK_PROTOCOL,
} from '../lib/e2ee/messageTransportPayload';
import { ENCRYPTED_MESSAGE_PROTOCOL } from '../lib/e2ee/messageProtocolConstants';
import {
  buildPendingMessage,
  normalizeIncomingMessage,
} from '../lib/e2ee/messageModel';
import {
  applyConversationSummaryToList,
  normalizeConversationSummaryRecord,
} from '../lib/e2ee/conversationSummaries';
import {
  isE2EEServiceTransportEnabled,
} from '../lib/e2ee/config';
import { canEditMessage, ENCRYPTED_EDIT_UNAVAILABLE_MESSAGE } from '../lib/e2ee/policy';
import { secureKeyStore } from '../lib/e2ee/secureKeyStore';
import { readSessionConversations, writeSessionConversations } from '../utils';

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
  const sessionConversationStateRef = useRef(readSessionConversations(user.uid));

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

  const toMessageTimestamp = useCallback((message = {}) => {
    const raw = message?.createdAt || message?.updatedAt || 0;
    if (raw?.toDate) return raw.toDate().getTime();
    if (raw?._seconds) return raw._seconds * 1000;
    const value = new Date(raw).getTime();
    return Number.isFinite(value) ? value : 0;
  }, []);

  const sortConversationMessages = useCallback((messages = []) => {
    return [...messages].sort((a, b) => {
      const timeDiff = toMessageTimestamp(a) - toMessageTimestamp(b);
      if (timeDiff !== 0) return timeDiff;
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
  }, [toMessageTimestamp]);

  function mergeConversationMessages(persistedMessages = [], sessionMessages = []) {
    const merged = [];
    const seenIds = new Set();

    [...persistedMessages, ...sessionMessages].forEach((message) => {
      if (!message) return;
      const messageId = message.id || null;
      if (messageId && seenIds.has(messageId)) return;
      if (messageId) seenIds.add(messageId);
      merged.push(message);
    });

    return sortConversationMessages(merged);
  }

  function persistSessionConversationState(nextState) {
    sessionConversationStateRef.current = nextState;
    writeSessionConversations(user.uid, nextState);
  }

  function getSessionMessagesForConversation(convId) {
    const items = sessionConversationStateRef.current?.[convId];
    return Array.isArray(items) ? items : [];
  }

  function syncConversationCache(convId) {
    const cachedMessages = Array.isArray(msgCache.current[convId]) ? msgCache.current[convId] : [];
    const sessionMessages = getSessionMessagesForConversation(convId);
    const merged = mergeConversationMessages(
      cachedMessages.filter((message) => !message?.transient),
      sessionMessages,
    );
    msgCache.current[convId] = merged;
    return merged;
  }

  function setSessionMessagesForConversation(convId, messages) {
    const nextState = { ...sessionConversationStateRef.current };
    if (Array.isArray(messages) && messages.length > 0) nextState[convId] = sortConversationMessages(messages);
    else delete nextState[convId];
    persistSessionConversationState(nextState);
    syncConversationCache(convId);
  }

  function storeTransientConversationMessage(convId, message, { replaceMessageId = null } = {}) {
    if (!convId || !message?.transient) return null;
    const currentMessages = getSessionMessagesForConversation(convId);
    const filtered = currentMessages.filter((entry) => entry?.id !== replaceMessageId);
    const existingIndex = filtered.findIndex((entry) => entry?.id === message.id);
    const nextMessages = [...filtered];
    if (existingIndex >= 0) nextMessages[existingIndex] = message;
    else nextMessages.push(message);
    setSessionMessagesForConversation(convId, nextMessages);
    return message;
  }

  const applySessionConversationSummaries = useCallback((baseConversations = []) => {
    let nextConversations = baseConversations;
    Object.entries(sessionConversationStateRef.current || {}).forEach(([convId, messages]) => {
      if (!Array.isArray(messages) || messages.length === 0) return;
      if (!nextConversations.some((conversation) => conversation.id === convId)) return;
      const latestMessage = sortConversationMessages(messages).at(-1);
      if (!latestMessage) return;
      nextConversations = applyConversationSummaryToList(
        nextConversations,
        convId,
        latestMessage,
        latestMessage.createdAt || new Date().toISOString(),
      );
    });
    return nextConversations;
  }, [sortConversationMessages]);

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

  async function fetchConversationMessages(convId, { limit = MSG_LIMIT, offset = 0 } = {}) {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (currentDeviceId) query.set('deviceId', currentDeviceId);

    const e2eeFeedRes = await authFetch(`${BACKEND_URL}/messages/feed/${convId}?${query.toString()}`);
    if (e2eeFeedRes.ok) return e2eeFeedRes.json();

    const legacyRes = await authFetch(`${BACKEND_URL}/api/messages/${convId}?${query.toString()}`);
    if (!legacyRes.ok) throw new Error('messages_load_failed');
    return legacyRes.json();
  }

  async function markConversationMessagesAsRead(items) {
    const targets = items.filter((message) =>
      message?.protocol === ENCRYPTED_MESSAGE_PROTOCOL &&
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

  function resolvePendingMessageProtocol(conv) {
    return shouldUseServiceTransport(conv) ? ENCRYPTED_MESSAGE_PROTOCOL : SOCKET_FALLBACK_PROTOCOL;
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

  async function sendViaService({ conv, plaintext, recipientUserIds, replyToMessageId, messageType = 'text', sharedContact = null, mentions = [] }) {
    const result = await messagingService.sendMessage({
      user,
      conversationId: conv.id,
      recipientUserIds,
      plaintext,
      replyToMessageId,
      messageType,
      sharedContact,
      mentions,
    }, currentDeviceId);

    return buildServiceMessageResult({
      messageId: result.messageId,
      conversationId: conv.id,
      senderId: user.uid,
      senderDeviceId: currentDeviceId,
      plaintext: resolveOutgoingMessageDisplayText({ plaintext, messageType, sharedContact }),
      messageType,
      sharedContact,
      replyToMessageId,
    });
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
      const normalizedConversations = Array.isArray(data) ? data.map(normalizeConversationSummaryRecord) : [];
      setConversations(applySessionConversationSummaries(normalizedConversations));
      const sock = getSocket();
      if (sock && Array.isArray(data)) {
        data.forEach(conv => sock.emit('conversation:join', { convId: conv.id }));
        sock.emit('users:online:request');
      }
    } catch { showErrToast('Gesprekken laden mislukt'); }
    finally { setLoadingConvs(false); }
  }, [applySessionConversationSummaries, authFetch, setConvLabels, showErrToast, user.uid]);

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
    const sessionMessages = getSessionMessagesForConversation(convId);
    const cached = msgCache.current[convId];
    if (cached) {
      setMessages(mergeConversationMessages(cached, sessionMessages));
      setLoadingMsgs(false);
    } else if (sessionMessages.length > 0) {
      setMessages(sessionMessages);
      setLoadingMsgs(true);
    } else {
      setMessages([]);
      setLoadingMsgs(true);
    }
    const liveSocket = getSocket();
    liveSocket?.emit('conversation:join', { convId: conv.id });
    liveSocket?.emit('messages:read', { convId: conv.id });
    try {
      const data = await fetchConversationMessages(conv.id, { limit: MSG_LIMIT, offset: 0 });
      const arr  = Array.isArray(data) ? data : [];
      const hydrated = await hydrateMessages(arr);
      if (activeConvRef.current?.id !== convId) return;
      const mergedFetchedMessages = mergeConversationMessages(hydrated, getSessionMessagesForConversation(convId));
      msgCache.current[convId] = mergedFetchedMessages;
      markConversationMessagesAsRead(hydrated).catch(() => {});
      setMessages(prev => {
        const fetchedIds = new Set(mergedFetchedMessages.map(m => m.id).filter(Boolean));
        const live = prev.filter(m => {
          if (!m.id) return false;
          if (fetchedIds.has(m.id)) return false;
          // Stale tempId: al bevestigd door server maar state nog niet bijgewerkt
          if (m.id.startsWith('temp-') && !pendingTempIds.current.has(m.id)) return false;
          return true;
        });
        return mergeConversationMessages(mergedFetchedMessages, live);
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
    e?.stopPropagation?.();
    setConfirmDialog({
      message: 'Weet je zeker dat je dit gesprek wilt verwijderen?',
      onConfirm: async () => {
        try {
          await authFetch(`${BACKEND_URL}/api/conversations/${convId}`, { method: 'DELETE' });
        } catch { showErrToast('Verwijderen mislukt'); }
        setSessionMessagesForConversation(convId, []);
        delete msgCache.current[convId];
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (activeConv?.id === convId) { setActiveConv(null); setMessages([]); }
      },
    });
  }

  async function clearConversationHistoryHard(convId) {
    try {
      await authFetch(`${BACKEND_URL}/api/conversations/${convId}/hard?mode=clear`, { method: 'DELETE' });
      setSessionMessagesForConversation(convId, []);
      msgCache.current[convId] = [];
      setMessages((prev) => (activeConvRef.current?.id === convId ? [] : prev));
      setConversations((prev) => prev.map((conversation) => (
        conversation.id === convId
          ? {
              ...conversation,
              lastMessage: '',
              lastMessageAt: null,
              lastCallDirection: null,
              lastCallIsVideo: false,
              lastCallSenderId: null,
            }
          : conversation
      )));
    } catch {
      showErrToast('Chat wissen mislukt');
    }
  }

  async function hardDeleteConversation(convId) {
    try {
      await authFetch(`${BACKEND_URL}/api/conversations/${convId}/hard?mode=delete`, { method: 'DELETE' });
      setSessionMessagesForConversation(convId, []);
      delete msgCache.current[convId];
      setConversations((prev) => prev.filter((conversation) => conversation.id !== convId));
      if (activeConvRef.current?.id === convId) {
        setActiveConv(null);
        setMessages([]);
      }
    } catch {
      showErrToast('Chat verwijderen mislukt');
    }
  }

  // ── Meer berichten laden ──────────────────────────────────────────────────
  async function loadMoreMessages() {
    if (!activeConv || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchConversationMessages(activeConv.id, { limit: MSG_LIMIT, offset: msgOffset });
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
        protocol: resolvePendingMessageProtocol(activeConv),
        mentions,
      }),
      id: tempId,
      convId: activeConv.id,
      senderName: user.displayName || user.email,
      mentions,
      _key: tempId,
      _retryCount: 0,
    };
    const msg = buildSocketMessagePayload({
      conversationId: activeConv.id,
      senderId: user.uid,
      senderName: user.displayName || user.email,
      senderDeviceId: currentDeviceId,
      plaintext: trimmedText,
      createdAt: optimisticMsg.createdAt,
      replyTo: replyTo || null,
      mentions,
    });
    setReplyTo(null);
    pendingTempIds.current.add(optimisticMsg.id);
    setMessages(prev => [...prev, optimisticMsg]);
    savePending(optimisticMsg.id, activeConv.id, msg);
    setTimeout(() => { if (msgsAreaRef.current) msgsAreaRef.current.scrollTop = msgsAreaRef.current.scrollHeight; }, 50);
    setConversations(prev => applyConversationSummaryToList(prev, activeConv.id, optimisticMsg, msg.createdAt));
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
        const normalizedSavedMessage = normalizeIncomingMessage(savedMsg, user.uid);
        storeTransientConversationMessage(activeConv.id, normalizedSavedMessage, { replaceMessageId: optimisticMsg.id });
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
          const normalizedSavedMessage = normalizeIncomingMessage(savedMsg, user.uid);
          storeTransientConversationMessage(activeConv.id, normalizedSavedMessage, { replaceMessageId: optimisticMsg.id });
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
        text: resolveOutgoingMessageDisplayText({
          plaintext: '',
          messageType: 'contact',
          sharedContact: normalizedSharedContact,
        }),
        conversationId: conv.id,
        userId: user.uid,
        type: 'contact',
        protocol: resolvePendingMessageProtocol(conv),
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

    setConversations(prev => applyConversationSummaryToList(prev, conv.id, optimisticMsg, optimisticMsg.createdAt));

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
        const normalizedSavedMessage = normalizeIncomingMessage(savedMsg, user.uid);
        storeTransientConversationMessage(conv.id, normalizedSavedMessage, { replaceMessageId: optimisticMsg.id });
      }).catch(() => {
        if (!isActiveConversation) return;
        patchMessageAsFailed(optimisticMsg.id);
      });
      return;
    }

    socket.emit('message:send', {
      convId: conv.id,
      message: buildSocketMessagePayload({
        conversationId: conv.id,
        senderId: user.uid,
        senderName: user.displayName || user.email,
        senderDeviceId: currentDeviceId,
        plaintext: optimisticMsg.text,
        messageType: 'contact',
        sharedContact: normalizedSharedContact,
        createdAt: optimisticMsg.createdAt,
      }),
    }, (savedMsg) => {
      if (!savedMsg?.id) return;
      const normalizedSavedMessage = normalizeIncomingMessage(savedMsg, user.uid);
      storeTransientConversationMessage(conv.id, normalizedSavedMessage, { replaceMessageId: optimisticMsg.id });
    });
  }

  function retryMessage(failedMsg) {
    const socket = getSocket();
    if ((!socket?.connected && !shouldUseServiceTransport(activeConv)) || !activeConv) return;
    const retryCount = (failedMsg._retryCount || 0) + 1;
    const recipientUserIds = getConversationRecipients(activeConv);
    const retryPayload = buildRetryServicePayload(failedMsg);
    const retryScopeError = retryPayload.scopeError;
    if (retryScopeError) {
      showErrToast(retryScopeError);
      return;
    }
    patchMessageAsSending(failedMsg.id, retryCount);
    const failTimer = setTimeout(() => {
      patchMessageAsFailed(failedMsg.id);
    }, 20000);
    if (shouldUseServiceTransport(activeConv)) {
      sendViaService({
        conv: activeConv,
        plaintext: retryPayload.plaintext,
        recipientUserIds,
        replyToMessageId: retryPayload.replyToMessageId,
        messageType: retryPayload.messageType,
        sharedContact: retryPayload.sharedContact,
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
      socket.emit('message:send', {
        convId: activeConv.id,
        message: buildSocketMessagePayload({
          conversationId: activeConv.id,
          senderId: user.uid,
          senderName: user.displayName || user.email,
          senderDeviceId: currentDeviceId,
          plaintext: retryPayload.plaintext,
          messageType: retryPayload.messageType,
          sharedContact: retryPayload.sharedContact,
          createdAt: new Date().toISOString(),
          replyTo: failedMsg.replyTo || null,
          mentions: Array.isArray(failedMsg.mentions) ? failedMsg.mentions : [],
        }),
      }, (savedMsg) => {
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
      authFetch(`${BACKEND_URL}/api/messages/${activeConv.id}/${msgId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
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
    if (!socket?.connected) {
      showErrToast('Reactie bijwerken mislukt');
      return;
    }
    socket.emit('message:react', { convId: activeConv.id, msgId, emoji }, (data = {}) => {
      if (data.error) {
        showErrToast('Reactie bijwerken mislukt');
        return;
      }
      if (data.reactions) {
        setMessages(prev => prev.map(m => (
          m.id === msgId ? { ...m, reactions: data.reactions || {} } : m
        )));
      }
    });
    setReactionPickerMsgId(null);
  }

  async function forwardToConv(conv) {
    const socket = getSocket();
    if ((!socket?.connected && !shouldUseServiceTransport(conv)) || !forwardMsg) return;
    const recipientUserIds = getConversationRecipients(conv);
    const forwardPayload = buildForwardServicePayload(forwardMsg);
    const forwardScopeError = forwardPayload.scopeError;
    if (forwardScopeError) {
      showErrToast(forwardScopeError);
      return;
    }
    const msg = buildSocketMessagePayload({
      conversationId: conv.id,
      senderId: user.uid,
      senderName: user.displayName || user.email,
      senderDeviceId: currentDeviceId,
      plaintext: forwardPayload.plaintext,
      messageType: forwardPayload.messageType,
      sharedContact: forwardPayload.sharedContact,
    });
    if (shouldUseServiceTransport(conv)) {
      try {
        await sendViaService({
          conv,
          plaintext: forwardPayload.plaintext,
          recipientUserIds,
          replyToMessageId: null,
          messageType: forwardPayload.messageType,
          sharedContact: forwardPayload.sharedContact,
        });
      } catch {
        showErrToast('Doorsturen mislukt');
        return;
      }
    } else {
      socket.emit('message:send', {
        convId: conv.id,
        message: msg,
      });
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

  function leaveGroup() {
    const socket = getSocket();
    if (!socket || !activeConv?.isGroup) return;
    const convId = activeConv.id;
    const performLeave = () => {
      socket.emit('conversation:removeMember', { convId, uid: user.uid }, (res = {}) => {
        if (res.error) return showErrToast(res.error);
        setSessionMessagesForConversation(convId, []);
        delete msgCache.current[convId];
        setConversations(prev => prev.filter(conv => conv.id !== convId));
        setActiveConv(null);
        setMessages([]);
        showErrToast('Je hebt de groep verlaten');
      });
    };
    setConfirmDialog({
      message: 'Groep verlaten? Je verlaat deze groep en ziet het gesprek niet meer in je lijst.',
      onConfirm: performLeave,
    });
  }

  return {
    conversations, setConversations,
    activeConv, setActiveConv,
    messages, setMessages,
    loadingConvs, loadingMsgs, hasMore, loadingMore, msgOffset, setMsgOffset,
    currentDeviceId,
    loadConversations, openConversation, deleteConversation, clearConversationHistoryHard, hardDeleteConversation, loadMoreMessages,
    sendMessage, sendEditedMessage, stopTyping, retryMessage, retryAllFailed, toggleReaction,
    sendContactCardToConversation,
    forwardToConv, deleteMessage,
    toggleGroupMember, createGroup, addMemberToGroup, removeMemberFromGroup, leaveGroup,
    storeTransientConversationMessage,
  };
}
