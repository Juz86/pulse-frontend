// src/hooks/useCalling.js
import { useEffect, useState, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket';
import { BACKEND_URL, startCall } from '../services/socket';

export default function useCalling({
  user,
  pausedFeatures,
  activeConvRef,
  msgsAreaRef,
  setMessages,
  loadConversations,
  findConvWithUid,
  setShowCallModal,
  showErrToast,
}) {
  const [activeCall,  setActiveCall]  = useState(null);
  const [callLog, setCallLog] = useState([]);

  const callStartTimeRef = useRef(null);
  const callIsVideoRef   = useRef(false);
  const callConvIdRef    = useRef(null);
  const fallbackNoticeShownRef = useRef(false);
  const reopenRecentAfterCallRef = useRef(false);
  const callLogRefreshTimersRef = useRef([]);
  const callTargetUidRef = useRef('');
  const callTargetNameRef = useRef('');
  const callTargetPhotoRef = useRef('');

  const authFetch = useCallback(async (url, options = {}) => {
    const token = await user.getIdToken();
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    return response;
  }, [user]);

  function getLegacyCallLogKey() {
    return `pulse_calls_${user.uid}`;
  }

  function readLegacyCallLog() {
    try {
      const raw = JSON.parse(localStorage.getItem(getLegacyCallLogKey()) || '[]');
      return Array.isArray(raw) ? raw.filter((entry) => entry && entry.uid && Number.isFinite(Number(entry.ts))) : [];
    } catch {
      return [];
    }
  }

  function writeLegacyCallEntry(entry) {
    if (!entry?.uid || !Number.isFinite(Number(entry?.ts))) return;
    const existing = readLegacyCallLog();
    const deduped = existing.filter((item) => !(item.uid === entry.uid && item.ts === entry.ts && !!item.isVideo === !!entry.isVideo));
    localStorage.setItem(getLegacyCallLogKey(), JSON.stringify([entry, ...deduped].slice(0, 50)));
  }

  function mergeCallLogs(primary = [], fallback = []) {
    const merged = [];
    const seen = new Set();
    [...primary, ...fallback].forEach((entry) => {
      const key = `${entry?.uid || ''}:${entry?.ts || 0}:${entry?.isVideo ? 'video' : 'voice'}`;
      if (!entry?.uid || !Number.isFinite(Number(entry?.ts)) || seen.has(key)) return;
      seen.add(key);
      merged.push(entry);
    });
    return merged.sort((a, b) => Number(b.ts) - Number(a.ts)).slice(0, 50);
  }

  const refreshCallLog = useCallback(async () => {
    const legacy = readLegacyCallLog();
    try {
      const res = await authFetch(`${BACKEND_URL}/api/messages/recent-calls?limit=50`);
      if (!res.ok) {
        setCallLog(legacy);
        return legacy;
      }
      const data = await res.json().catch(() => []);
      const normalized = Array.isArray(data) ? data.filter((entry) => (
        entry && entry.uid && Number.isFinite(Number(entry.ts))
      )) : [];
      const merged = mergeCallLogs(normalized, legacy);
      setCallLog(merged);
      return merged;
    } catch {
      setCallLog(legacy);
      return legacy;
    }
  }, [authFetch]);

  const clearCallLog = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/messages/recent-calls`, { method: 'DELETE' });
      localStorage.removeItem(getLegacyCallLogKey());
      if (!res.ok) {
        setCallLog([]);
        return true;
      }
      await refreshCallLog();
      return true;
    } catch {
      localStorage.removeItem(getLegacyCallLogKey());
      setCallLog([]);
      return true;
    }
  }, [authFetch, refreshCallLog]);

  useEffect(() => {
    refreshCallLog();
    return () => {
      callLogRefreshTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      callLogRefreshTimersRef.current = [];
    };
  }, [refreshCallLog]);

  function getCallLog() {
    return callLog;
  }

  function sendCallMessage({ isVideo, direction, duration }) {
    const socket = getSocket();
    const convId = callConvIdRef.current;
    if (!socket || !convId) return;
    socket.emit('conversation:join', { convId });
    if (activeConvRef.current?.id === convId) {
      const optimistic = {
        id:          `call-pending-${Date.now()}`,
        convId,      type: 'call', isVideo, direction,
        duration:    duration || 0,
        senderId:    user.uid,
        senderName:  user.displayName || user.email,
        createdAt:   new Date().toISOString(),
        pending:     true,
      };
      setMessages(prev => [...prev, optimistic]);
      setTimeout(() => {
        if (msgsAreaRef.current) msgsAreaRef.current.scrollTo({ top: msgsAreaRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
    socket.emit('call:log', {
      convId, isVideo, direction, duration: duration || 0,
      senderId: user.uid, senderName: user.displayName || user.email,
    });
    const localEntry = {
      uid: callTargetUidRef.current,
      name: callTargetNameRef.current || 'Contactpersoon',
      photoURL: callTargetPhotoRef.current || '',
      isVideo: !!isVideo,
      direction: direction === 'declined' || direction === 'no-answer' ? 'missed' : 'outgoing',
      ts: Date.now(),
    };
    writeLegacyCallEntry(localEntry);
    setCallLog((prev) => mergeCallLogs([localEntry], prev));
    callLogRefreshTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    callLogRefreshTimersRef.current = [0, 700, 1800, 3200].map((delay) => (
      setTimeout(() => {
        refreshCallLog();
      }, delay)
    ));
    loadConversations();
  }

  async function ensureDirectConversationForCall({ toUid, name, email }) {
    const existingConvId = findConvWithUid(toUid)?.id || null;
    if (existingConvId) return existingConvId;

    const socket = getSocket();
    if (!socket) return null;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), 3500);
      socket.emit('conversation:create', {
        members: [user.uid, toUid],
        isGroup: false,
        memberNames: {
          [user.uid]: user.displayName || user.email || user.uid,
          [toUid]: name || email || toUid,
        },
        memberEmails: {
          [user.uid]: user.email || null,
          [toUid]: email || null,
        },
      }, (ack = {}) => {
        clearTimeout(timeoutId);
        resolve(ack?.convId || null);
      });
    });
  }

  async function startCallTo({ toUid, convId, name, isVideo }) {
    if (isVideo ? pausedFeatures.video : pausedFeatures.call) {
      const canChat   = !pausedFeatures.chat;
      const canCall   = !pausedFeatures.call;
      const canVideo  = !pausedFeatures.video;
      const available = [canChat && 'chatten', canCall && 'bellen', canVideo && 'videobellen'].filter(Boolean).join(' en ');
      showErrToast(`⏸ ${isVideo ? 'Videobellen' : 'Bellen'} is gepauzeerd door je ouder${available ? `, maar je kan nog wel ${available}` : ''}.`);
      return;
    }
    callConvIdRef.current    = convId;
    callStartTimeRef.current = null;
    callIsVideoRef.current   = isVideo;
    fallbackNoticeShownRef.current = false;
    callTargetUidRef.current = toUid || '';
    callTargetNameRef.current = name || '';
    try {
      const stream = await startCall({
        toUid, fromUid: user.uid, callerName: user.displayName || user.email, isVideo,
        onStream: (remoteStream, localStream) => {
          callStartTimeRef.current = Date.now();
          setActiveCall(prev => ({ ...prev, remoteStream, localStream }));
        },
        onEnd: (reason) => {
          const wasConnected = callStartTimeRef.current !== null;
          const duration     = wasConnected ? Math.round((Date.now() - callStartTimeRef.current) / 1000) : 0;
          callStartTimeRef.current = null;
          const callDir = reason === 'declined'  ? 'declined'
            : (!wasConnected || reason === 'timeout' || reason === 'unavailable' || reason === 'busy') ? 'no-answer'
            : 'completed';
          if (reason !== 'busy') {
            sendCallMessage({ isVideo: callIsVideoRef.current, direction: callDir, duration });
          }
          callLogRefreshTimersRef.current.forEach((timerId) => clearTimeout(timerId));
          callLogRefreshTimersRef.current = [300, 900, 1800].map((delay) => (
            setTimeout(() => {
              refreshCallLog();
              if (reopenRecentAfterCallRef.current) {
                setShowCallModal(true);
              }
            }, delay)
          ));
          setTimeout(() => {
            reopenRecentAfterCallRef.current = false;
          }, 2200);
          if (reason === 'unavailable' || reason === 'declined' || reason === 'timeout' || reason === 'busy') {
            setActiveCall(prev => prev ? { ...prev, endReason: reason } : null);
          } else {
            setActiveCall(null);
          }
        },
        onVideoUpgrade: (localStream) => {
          callIsVideoRef.current = true;
          setActiveCall(prev => ({ ...prev, localStream, isVideo: true }));
        },
        onVideoUpgradeRequest: () => {
          setActiveCall(prev => prev ? { ...prev, videoUpgradeRequest: true } : prev);
        },
        onConnectionFallback: (message) => {
          if (fallbackNoticeShownRef.current) return;
          fallbackNoticeShownRef.current = true;
          showErrToast(message);
        },
      });
      if (stream) setActiveCall({ toUid, isVideo, name, localStream: null, remoteStream: null });
    } catch (err) {
      showErrToast(err.message);
    }
  }

  async function callContact(contact, isVideo) {
    reopenRecentAfterCallRef.current = false;
    setShowCallModal(false);
    const toUid = contact.uid;
    const name  = contact.displayName;
    callTargetPhotoRef.current = contact.photoURL || '';
    const convId = await ensureDirectConversationForCall({
      toUid,
      name: contact.displayName || contact.email || toUid,
      email: contact.email || null,
    });
    await startCallTo({ toUid, convId, name, isVideo });
  }

  async function callContactFromRecent(contact, isVideo) {
    reopenRecentAfterCallRef.current = true;
    setShowCallModal(false);
    const toUid = contact.uid;
    const name  = contact.displayName;
    callTargetPhotoRef.current = contact.photoURL || '';
    const convId = await ensureDirectConversationForCall({
      toUid,
      name: contact.displayName || contact.email || toUid,
      email: contact.email || null,
    });
    await startCallTo({ toUid, convId, name, isVideo });
  }

  async function initiateCall(isVideo) {
    const conv = activeConvRef.current;
    if (!conv || !Array.isArray(conv.members)) return;
    const toUid = conv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = conv.memberNames?.[toUid] || 'Contactpersoon';
    callTargetPhotoRef.current = '';
    await startCallTo({ toUid, convId: conv.id, name, isVideo });
  }

  async function initiateCallFromConv(conv, isVideo) {
    if (!Array.isArray(conv.members)) return;
    const toUid = conv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = conv.memberNames?.[toUid] || 'Contactpersoon';
    callTargetPhotoRef.current = '';
    await startCallTo({ toUid, convId: conv.id, name, isVideo });
  }

  return {
    activeCall, setActiveCall,
    getCallLog, refreshCallLog, clearCallLog,
    callContact, callContactFromRecent, initiateCall, initiateCallFromConv,
    sendCallMessage,
  };
}
