// src/hooks/useCalling.js
import { useEffect, useState, useRef } from 'react';
import { getSocket } from '../services/socket';
import { BACKEND_URL, startCall } from '../services/socket';

export default function useCalling({
  user,
  contacts,
  pausedFeatures,
  activeConvRef,
  msgsAreaRef,
  setMessages,
  loadConversations,
  findConvWithUid,
  setShowCallModal,
  showErrToast,
}) {
  const socket = getSocket();

  const [activeCall,  setActiveCall]  = useState(null);
  const [historyRetentionDays, setHistoryRetentionDays] = useState(() => Number(localStorage.getItem(`pulse_history_retention_${user.uid}`) || 30));

  const callStartTimeRef = useRef(null);
  const callIsVideoRef   = useRef(false);
  const callConvIdRef    = useRef(null);
  const fallbackNoticeShownRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function loadHistoryRetention() {
      try {
        const cachedDays = Number(localStorage.getItem(`pulse_history_retention_${user.uid}`) || 30);
        if (mounted) setHistoryRetentionDays(cachedDays);
        const token = await user.getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/users/${user.uid}/history-settings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (mounted) {
          const nextDays = Number(data?.historyRules?.retentionDays || 30);
          localStorage.setItem(`pulse_history_retention_${user.uid}`, String(nextDays));
          setHistoryRetentionDays(nextDays);
        }
      } catch {
        if (mounted) setHistoryRetentionDays(30);
      }
    }

    function handleRetentionUpdate(event) {
      if (event?.detail?.uid !== user.uid) return;
      setHistoryRetentionDays(Number(event.detail.retentionDays || 30));
    }

    loadHistoryRetention();
    window.addEventListener('pulse:history-retention-updated', handleRetentionUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('pulse:history-retention-updated', handleRetentionUpdate);
    };
  }, [user, user.uid]);

  function logCall({ uid, name, photoURL, isVideo, direction }) {
    const key      = `pulse_calls_${user.uid}`;
    const cutoff   = Date.now() - historyRetentionDays * 24 * 60 * 60 * 1000;
    const existing = JSON.parse(localStorage.getItem(key) || '[]').filter(e => e.ts > cutoff);
    const entry    = { uid, name, photoURL: photoURL || '', isVideo, direction, ts: Date.now() };
    localStorage.setItem(key, JSON.stringify([entry, ...existing].slice(0, 50)));
  }

  function getCallLog() {
    const cutoff = Date.now() - historyRetentionDays * 24 * 60 * 60 * 1000;
    return JSON.parse(localStorage.getItem(`pulse_calls_${user.uid}`) || '[]').filter(e => e.ts > cutoff);
  }

  function sendCallMessage({ isVideo, direction, duration }) {
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
    logCall({ uid: toUid, name, photoURL: contact.photoURL, isVideo, direction: 'outgoing' });
    await startCallTo({ toUid, convId: findConvWithUid(toUid)?.id || null, name, isVideo });
  }

  async function initiateCall(isVideo) {
    const conv = activeConvRef.current;
    if (!conv || !Array.isArray(conv.members)) return;
    const toUid = conv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = conv.memberNames?.[toUid] || 'Contactpersoon';
    const photo = contacts.find(c => c.uid === toUid)?.photoURL || '';
    logCall({ uid: toUid, name, photoURL: photo, isVideo, direction: 'outgoing' });
    await startCallTo({ toUid, convId: conv.id, name, isVideo });
  }

  async function initiateCallFromConv(conv, isVideo) {
    if (!Array.isArray(conv.members)) return;
    const toUid = conv.members.find(m => m !== user.uid);
    if (!toUid) return;
    const name  = conv.memberNames?.[toUid] || 'Contactpersoon';
    const photo = contacts.find(c => c.uid === toUid)?.photoURL || '';
    logCall({ uid: toUid, name, photoURL: photo, isVideo, direction: 'outgoing' });
    await startCallTo({ toUid, convId: conv.id, name, isVideo });
  }

  return {
    activeCall, setActiveCall,
    logCall, getCallLog,
    callContact, initiateCall, initiateCallFromConv,
    sendCallMessage,
  };
}
