// src/hooks/useCalling.js
import { useEffect, useState, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket';
import { BACKEND_URL, startCall, getCurrentCallSessionId } from '../services/socket';

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
  const [callLogRateLimitUntil, setCallLogRateLimitUntil] = useState(0);
  const callLogStateRef = useRef([]);

  const callStartTimeRef = useRef(null);
  const callIsVideoRef   = useRef(false);
  const callConvIdRef    = useRef(null);
  const fallbackNoticeShownRef = useRef(false);
  const reopenRecentAfterCallRef = useRef(false);
  const callLogRefreshTimersRef = useRef([]);
  const callLogRefreshPromiseRef = useRef(null);
  const callLogLastRefreshAtRef = useRef(0);
  const callLogCooldownUntilRef = useRef(0);
  const callLogApiUnavailableRef = useRef(false);
  const callTargetUidRef = useRef('');
  const callTargetNameRef = useRef('');
  const callTargetPhotoRef = useRef('');
  const MIN_CALL_LOG_REFRESH_INTERVAL_MS = 5000;

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

  const getLegacyCallLogKey = useCallback(() => (
    `pulse_calls_${user.uid}`
  ), [user.uid]);

  const readLegacyCallLog = useCallback(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(getLegacyCallLogKey()) || '[]');
      return Array.isArray(raw) ? raw.filter((entry) => entry && entry.uid && Number.isFinite(Number(entry.ts))) : [];
    } catch {
      return [];
    }
  }, [getLegacyCallLogKey]);

  function writeLegacyCallEntry(entry) {
    if (!entry?.uid || !Number.isFinite(Number(entry?.ts))) return;
    const existing = readLegacyCallLog();
    const deduped = existing.filter((item) => !(item.uid === entry.uid && item.ts === entry.ts && !!item.isVideo === !!entry.isVideo));
    localStorage.setItem(getLegacyCallLogKey(), JSON.stringify([entry, ...deduped].slice(0, 50)));
  }

  function mergeCallLogs(primary = [], fallback = []) {
    const merged = [];
    const seen = new Set();
    const hasPrimaryMatch = (entry) => primary.some((primaryEntry) => (
      primaryEntry?.uid === entry?.uid
      && !!primaryEntry?.isVideo === !!entry?.isVideo
      && Math.abs(Number(primaryEntry?.ts || 0) - Number(entry?.ts || 0)) <= 15000
    ));
    [...primary, ...fallback].forEach((entry, index) => {
      const key = `${entry?.uid || ''}:${entry?.ts || 0}:${entry?.isVideo ? 'video' : 'voice'}`;
      const isFallbackDuplicate = index >= primary.length && hasPrimaryMatch(entry);
      if (!entry?.uid || !Number.isFinite(Number(entry?.ts)) || seen.has(key) || isFallbackDuplicate) return;
      seen.add(key);
      merged.push(entry);
    });
    return merged.sort((a, b) => Number(b.ts) - Number(a.ts)).slice(0, 50);
  }

  const normalizeDirection = useCallback((rawDirection) => {
    const value = String(rawDirection || '').toLowerCase();
    if (value === 'outgoing' || value === 'incoming' || value === 'missed') return value;
    if (value === 'declined' || value === 'no-answer' || value === 'no_answer') return 'missed';
    if (value === 'completed') return 'incoming';
    return 'incoming';
  }, []);

  const normalizeCallLogEntries = useCallback((rawEntries = []) => {
    if (!Array.isArray(rawEntries)) return [];
    return rawEntries
      .map((entry, index) => {
        const uid = entry?.uid || entry?.otherUid || entry?.peerUid || entry?.contactUid || '';
        const timestampCandidate = entry?.ts ?? entry?.timestamp ?? entry?.createdAt ?? entry?.created_at ?? entry?.date;
        const numericTs = Number(timestampCandidate);
        const parsedTs = Number.isFinite(numericTs)
          ? numericTs
          : Date.parse(String(timestampCandidate || ''));
        if (!uid || !Number.isFinite(parsedTs) || parsedTs <= 0) return null;

        const isVideo = entry?.isVideo ?? entry?.video ?? entry?.callType === 'video';
        return {
          id: entry?.id || `${uid}:${parsedTs}:${index}`,
          convId: entry?.convId || entry?.conversationId || null,
          uid,
          name: entry?.name || entry?.displayName || entry?.contactName || 'Contactpersoon',
          photoURL: entry?.photoURL || entry?.photo || entry?.avatar || '',
          isVideo: !!isVideo,
          direction: normalizeDirection(entry?.direction),
          ts: parsedTs,
        };
      })
      .filter(Boolean);
  }, [normalizeDirection]);

  useEffect(() => {
    callLogStateRef.current = callLog;
  }, [callLog]);

  const refreshCallLog = useCallback(async ({ force = false } = {}) => {
    const legacy = readLegacyCallLog();

    if (callLogApiUnavailableRef.current) {
      return callLogStateRef.current.length > 0 ? callLogStateRef.current : legacy;
    }

    const now = Date.now();
    if (!force) {
      if (callLogRefreshPromiseRef.current) return callLogRefreshPromiseRef.current;
      if (now < callLogCooldownUntilRef.current) {
        setCallLogRateLimitUntil(callLogCooldownUntilRef.current);
        return callLogStateRef.current.length > 0 ? callLogStateRef.current : legacy;
      }
      if (now - callLogLastRefreshAtRef.current < MIN_CALL_LOG_REFRESH_INTERVAL_MS) {
        return callLogStateRef.current.length > 0 ? callLogStateRef.current : legacy;
      }
    }

    const run = (async () => {
      callLogLastRefreshAtRef.current = Date.now();
      try {
        const res = await authFetch(`${BACKEND_URL}/api/messages/recent-calls?limit=50`);
        if (res.status === 404) {
          callLogApiUnavailableRef.current = true;
          setCallLog(legacy);
          return legacy;
        }
        if (res.status === 429) {
          const retryAfterHeader = Number(res.headers.get('retry-after'));
          const retryAfterMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader * 1000
            : 15000;
          callLogCooldownUntilRef.current = Date.now() + retryAfterMs;
          setCallLogRateLimitUntil(callLogCooldownUntilRef.current);
          setCallLog(legacy);
          return legacy;
        }
        if (!res.ok) {
          callLogCooldownUntilRef.current = 0;
          setCallLogRateLimitUntil(0);
          setCallLog(legacy);
          return legacy;
        }
        callLogCooldownUntilRef.current = 0;
        setCallLogRateLimitUntil(0);
        const data = await res.json().catch(() => []);
        const normalized = normalizeCallLogEntries(data);
        const merged = mergeCallLogs(normalized, legacy);
        setCallLog(merged);
        return merged;
      } catch {
        callLogCooldownUntilRef.current = 0;
        setCallLogRateLimitUntil(0);
        setCallLog(legacy);
        return legacy;
      } finally {
        callLogRefreshPromiseRef.current = null;
      }
    })();

    callLogRefreshPromiseRef.current = run;
    try {
      return await run;
    } finally {
      if (callLogRefreshPromiseRef.current === run) {
        callLogRefreshPromiseRef.current = null;
      }
    }
  }, [authFetch, normalizeCallLogEntries, readLegacyCallLog]);

  const clearCallLog = useCallback(async () => {
    if (callLogApiUnavailableRef.current) {
      localStorage.removeItem(getLegacyCallLogKey());
      setCallLog([]);
      return true;
    }
    try {
      const res = await authFetch(`${BACKEND_URL}/api/messages/recent-calls`, { method: 'DELETE' });
      if (res.status === 404) {
        callLogApiUnavailableRef.current = true;
        localStorage.removeItem(getLegacyCallLogKey());
        setCallLog([]);
        return true;
      }
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
  }, [authFetch, getLegacyCallLogKey, refreshCallLog]);

  const deleteCallLogEntries = useCallback(async (entries = []) => {
    const selected = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!selected.length) return true;

    const isSameEntry = (left, right) => (
      (left?.convId && left?.id && left.convId === right?.convId && left.id === right?.id)
      || (
        left?.uid === right?.uid
        && Number(left?.ts) === Number(right?.ts)
        && !!left?.isVideo === !!right?.isVideo
      )
    );
    const remoteEntries = selected.filter((entry) => entry.convId && entry.id);

    try {
      const results = await Promise.all(remoteEntries.map((entry) => authFetch(
        `${BACKEND_URL}/api/messages/${encodeURIComponent(entry.convId)}/${encodeURIComponent(entry.id)}`,
        { method: 'DELETE' },
      )));
      if (results.some((response) => !response.ok && response.status !== 404)) {
        throw new Error('Oproepen verwijderen is niet gelukt.');
      }

      const remainingLegacyEntries = readLegacyCallLog().filter((entry) => !selected.some((selectedEntry) => (
        isSameEntry(entry, selectedEntry)
      )));
      localStorage.setItem(getLegacyCallLogKey(), JSON.stringify(remainingLegacyEntries));
      setCallLog((previous) => previous.filter((entry) => !selected.some((selectedEntry) => (
        isSameEntry(entry, selectedEntry)
      ))));
      await refreshCallLog({ force: true });
      return true;
    } catch (error) {
      showErrToast(error?.message || 'Oproepen verwijderen is niet gelukt.');
      return false;
    }
  }, [authFetch, getLegacyCallLogKey, readLegacyCallLog, refreshCallLog, showErrToast]);

  useEffect(() => {
    refreshCallLog();
    return () => {
      callLogRefreshTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      callLogRefreshTimersRef.current = [];
    };
  }, [refreshCallLog]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onRealtimeMessage = (msg = {}) => {
      if (String(msg?.type || '').toLowerCase() !== 'call') return;
      refreshCallLog();
    };

    socket.on('message:new', onRealtimeMessage);
    socket.on('message:received', onRealtimeMessage);

    return () => {
      socket.off('message:new', onRealtimeMessage);
      socket.off('message:received', onRealtimeMessage);
    };
  }, [refreshCallLog]);

  function getCallLog() {
    return callLog;
  }

  function sendCallMessage({ isVideo, direction, duration }) {
    const socket = getSocket();
    const convId = callConvIdRef.current;
    if (socket && convId) {
      socket.emit('conversation:join', { convId });
    }
    if (convId && activeConvRef.current?.id === convId) {
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
    if (socket && convId) {
      socket.emit('call:log', {
        convId, isVideo, direction, duration: duration || 0,
        senderId: user.uid, senderName: user.displayName || user.email,
      });
    }
    const fallbackUid = callTargetUidRef.current
      || activeConvRef.current?.members?.find?.((memberUid) => memberUid !== user.uid)
      || '';
    const localEntry = {
      uid: fallbackUid,
      name: callTargetNameRef.current || 'Contactpersoon',
      photoURL: callTargetPhotoRef.current || '',
      isVideo: !!isVideo,
      direction: direction === 'declined' || direction === 'no-answer' ? 'missed' : 'outgoing',
      ts: Date.now(),
    };
    if (localEntry.uid && callLogApiUnavailableRef.current) {
      writeLegacyCallEntry(localEntry);
      setCallLog((prev) => mergeCallLogs([localEntry], prev));
    }
    callLogRefreshTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    callLogRefreshTimersRef.current = [0, 2500].map((delay) => (
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
    if (activeCall) {
      showErrToast('Er is al een actief gesprek.');
      return;
    }
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
          callLogRefreshTimersRef.current = [400, 2400].map((delay) => (
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
      if (stream) {
        setActiveCall({ toUid, isVideo, name, sessionId: getCurrentCallSessionId(), localStream: stream, remoteStream: null });
      }
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
    getCallLog, refreshCallLog, clearCallLog, deleteCallLogEntries, callLogRateLimitUntil,
    callContact, callContactFromRecent, initiateCall, initiateCallFromConv,
    sendCallMessage,
  };
}
