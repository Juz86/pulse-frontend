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

  const authFetch = useCallback(async (url, options = {}) => {
    const token = await user.getIdToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    return response;
  }, [user]);

  const refreshCallLog = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/messages/recent-calls?limit=50`);
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      const normalized = Array.isArray(data) ? data.filter((entry) => (
        entry && entry.uid && Number.isFinite(Number(entry.ts))
      )) : [];
      setCallLog(normalized);
      return normalized;
    } catch {
      return [];
    }
  }, [authFetch]);

  const clearCallLog = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/messages/recent-calls`, { method: 'DELETE' });
      if (!res.ok) return false;
      await refreshCallLog();
      return true;
    } catch {
      return false;
    }
  }, [authFetch, refreshCallLog]);

  useEffect(() => {
    refreshCallLog();
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
    loadConversations();
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
    setShowCallModal(false);
    const toUid = contact.uid;
    const name  = contact.displayName;
    await startCallTo({ toUid, convId: findConvWithUid(toUid)?.id || null, name, isVideo });
  }

  async function initiateCall(isVideo) {
    const conv = activeConvRef.current;
    if (!conv || !Array.isArray(conv.members)) return;
    const toUid = conv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = conv.memberNames?.[toUid] || 'Contactpersoon';
    await startCallTo({ toUid, convId: conv.id, name, isVideo });
  }

  async function initiateCallFromConv(conv, isVideo) {
    if (!Array.isArray(conv.members)) return;
    const toUid = conv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = conv.memberNames?.[toUid] || 'Contactpersoon';
    await startCallTo({ toUid, convId: conv.id, name, isVideo });
  }

  return {
    activeCall, setActiveCall,
    getCallLog, refreshCallLog, clearCallLog,
    callContact, initiateCall, initiateCallFromConv,
    sendCallMessage,
  };
}
