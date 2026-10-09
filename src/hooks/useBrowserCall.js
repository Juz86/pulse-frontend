import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket, supportsBrowserAudioCalls } from '../services/socket';
import { getOrCreatePushInstallationId } from '../services/pushInstallation';
import {
  BROWSER_CALL_STATES,
  BrowserCallMediaSession,
  createCallEventId,
  emitCallEvent,
  requestBrowserMicrophone,
} from '../services/browserCall';

const EMPTY_CALL = Object.freeze({ status: 'idle' });

function callError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export default function useBrowserCall({ user, resolvePeer }) {
  const supported = useMemo(() => supportsBrowserAudioCalls(), []);
  const installationId = useMemo(
    () => (supported ? getOrCreatePushInstallationId() : null),
    [supported]
  );
  const [call, setCall] = useState(EMPTY_CALL);
  const [remoteStream, setRemoteStream] = useState(null);
  const sessionRef = useRef(null);
  const callRef = useRef(EMPTY_CALL);
  const localStreamRef = useRef(null);
  const mediaRef = useRef(null);
  const mediaStartRef = useRef(null);
  const pendingSignalsRef = useRef([]);
  const applySessionRef = useRef(null);
  const resolvePeerRef = useRef(resolvePeer);
  const lastIceRestartRef = useRef(0);
  const notificationRef = useRef(null);

  useEffect(() => {
    resolvePeerRef.current = resolvePeer;
  }, [resolvePeer]);

  const updateCall = useCallback((value) => {
    callRef.current = typeof value === 'function' ? value(callRef.current) : value;
    setCall(callRef.current);
  }, []);

  useEffect(() => {
    const current = callRef.current;
    if (current.status !== 'call' || !current.peerUid) return;
    const peer = resolvePeer?.(current.peerUid);
    if (!peer) return;
    updateCall((previous) => ({
      ...previous,
      displayName: peer.displayName || peer.name || previous.displayName,
      photoURL: peer.photoURL || previous.photoURL,
    }));
  }, [resolvePeer, updateCall]);

  const closeMedia = useCallback(() => {
    mediaRef.current?.close();
    mediaRef.current = null;
    mediaStartRef.current = null;
    if (!mediaRef.current && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    pendingSignalsRef.current = [];
    setRemoteStream(null);
  }, []);

  const sendCommand = useCallback(async (command, reason = null) => {
    const socket = getSocket();
    let session = sessionRef.current;
    if (!socket || !session) throw callError('call_signaling_unavailable');
    const eventId = createCallEventId();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await emitCallEvent(socket, 'call:v2:command', {
        sessionId: session.sessionId,
        eventId,
        expectedRevision: session.revision,
        command,
        ...(reason ? { reason } : {}),
        ...(installationId ? { installationId } : {}),
      });
      if (response.session) applySessionRef.current?.(response.session);
      if (response.status !== 'CONFLICT') return response;
      session = response.session;
      if (!session) return response;
    }
    throw callError('call_conflict');
  }, [installationId]);

  const ensureMedia = useCallback(async (session) => {
    if (mediaRef.current?.session?.sessionId === session.sessionId) return true;
    if (mediaStartRef.current) return mediaStartRef.current;
    const socket = getSocket();
    if (!socket || !localStreamRef.current) return false;

    const startPromise = (async () => {
      const ice = await emitCallEvent(socket, 'call:v2:ice-config', {
        sessionId: session.sessionId,
      });
      if (!ice.ok || ice.status !== 'FOUND' || !Array.isArray(ice.iceServers) || !ice.iceServers.length) {
        throw callError('call_ice_unavailable');
      }
      const media = new BrowserCallMediaSession({
        socket,
        session,
        localUid: user.uid,
        localStream: localStreamRef.current,
        callbacks: {
          onRemoteStream: setRemoteStream,
          onConnected: () => {
            sendCommand('MEDIA_CONNECTED').catch(() => {});
          },
          onReconnecting: () => {
            sendCommand('NETWORK_LOST').catch(() => {});
          },
          onFailure: (reason) => {
            sendCommand('FAIL', reason).catch(() => {});
          },
        },
      });
      mediaRef.current = media;
      await media.start(ice.iceServers);
      const pendingSignals = pendingSignalsRef.current.splice(0);
      for (const signal of pendingSignals) await media.handleSignal(signal);
      return true;
    })().catch(async (error) => {
      mediaRef.current?.close();
      mediaRef.current = null;
      await sendCommand('FAIL', 'media_error').catch(() => {});
      throw error;
    }).finally(() => {
      mediaStartRef.current = null;
    });
    mediaStartRef.current = startPromise;
    return startPromise;
  }, [sendCommand, user.uid]);

  const applyServerSession = useCallback((session) => {
    if (!session || session.protocolVersion !== 2 || session.mediaType !== 'audio') return;
    const current = sessionRef.current;
    if (!current) {
      if (session.calleeUid !== user.uid || session.state !== BROWSER_CALL_STATES.RINGING) return;
      const peer = resolvePeerRef.current?.(session.callerUid) || {};
      sessionRef.current = session;
      lastIceRestartRef.current = Number(session.iceRestartSequence || 0);
      updateCall({
        status: 'call',
        sessionId: session.sessionId,
        direction: 'incoming',
        peerUid: session.callerUid,
        displayName: peer.displayName || peer.name || 'Pulse-gebruiker',
        photoURL: peer.photoURL || '',
        serverState: session.state,
        terminalReason: null,
        activeSince: null,
        isMuted: false,
      });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        notificationRef.current?.close?.();
        notificationRef.current = new Notification('Inkomende Pulse-oproep', {
          body: peer.displayName || peer.name || 'Pulse-gebruiker',
          icon: peer.photoURL || '/logo192.png',
          tag: `pulse-call-${session.sessionId}`,
          requireInteraction: true,
        });
        notificationRef.current.onclick = () => {
          window.focus();
          notificationRef.current?.close?.();
        };
      }
      return;
    }
    if (current.sessionId !== session.sessionId || session.revision < current.revision) return;
    sessionRef.current = session;

    const takenElsewhere = session.calleeUid === user.uid
      && session.acceptedInstallationId
      && session.acceptedInstallationId !== installationId
      && [BROWSER_CALL_STATES.CONNECTING, BROWSER_CALL_STATES.ACTIVE].includes(session.state);
    if (takenElsewhere) {
      closeMedia();
      notificationRef.current?.close?.();
      updateCall((previous) => ({
        ...previous,
        serverState: BROWSER_CALL_STATES.ENDED,
        terminalReason: 'taken_elsewhere',
      }));
      return;
    }

    updateCall((previous) => ({
      ...previous,
      serverState: session.state,
      terminalReason: session.terminalReason || null,
      activeSince: session.state === BROWSER_CALL_STATES.ACTIVE
        ? (previous.activeSince || Date.now())
        : previous.activeSince,
    }));

    if ([BROWSER_CALL_STATES.CONNECTING, BROWSER_CALL_STATES.ACTIVE].includes(session.state)) {
      notificationRef.current?.close?.();
      ensureMedia(session).catch(() => {});
      const restartSequence = Number(session.iceRestartSequence || 0);
      if (session.callerUid === user.uid && restartSequence > lastIceRestartRef.current) {
        lastIceRestartRef.current = restartSequence;
        mediaRef.current?.restartIce().catch(() => {});
      }
    } else if (session.state === BROWSER_CALL_STATES.ENDED) {
      notificationRef.current?.close?.();
      closeMedia();
    }
  }, [closeMedia, ensureMedia, installationId, updateCall, user.uid]);

  applySessionRef.current = applyServerSession;

  useEffect(() => {
    if (!supported || !user?.uid) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const announceAvailability = (available) => {
      if (!socket.connected) return;
      socket.emit('call:v2:client-ready', {
        platform: 'web',
        capability: 'audio',
        installationId,
        available,
      }, () => {});
    };

    const onSessionUpdated = (session) => applySessionRef.current?.(session);
    const onMedia = (signal) => {
      if (!signal || signal.sessionId !== sessionRef.current?.sessionId || signal.senderUid === user.uid) return;
      if (mediaRef.current?.connection) {
        mediaRef.current.handleSignal(signal).catch(() => {
          sendCommand('FAIL', 'media_error').catch(() => {});
        });
      } else if (pendingSignalsRef.current.length < 256) {
        pendingSignalsRef.current.push(signal);
      }
    };
    const onConnect = () => announceAvailability(true);
    socket.on('call:v2:updated', onSessionUpdated);
    socket.on('call:v2:media', onMedia);
    socket.on('connect', onConnect);
    announceAvailability(true);
    return () => {
      announceAvailability(false);
      socket.off('call:v2:updated', onSessionUpdated);
      socket.off('call:v2:media', onMedia);
      socket.off('connect', onConnect);
      notificationRef.current?.close?.();
      closeMedia();
    };
  }, [closeMedia, installationId, sendCommand, supported, user?.uid]);

  const startCall = useCallback(async ({ calleeUid, displayName, photoURL = '' }) => {
    if (!supported) throw callError('browser_call_unsupported');
    if (sessionRef.current) throw callError('call_already_active');
    const socket = getSocket();
    if (!socket?.connected) throw callError('call_signaling_unavailable');
    const localStream = await requestBrowserMicrophone();
    localStreamRef.current = localStream;
    try {
      const response = await emitCallEvent(socket, 'call:v2:start', {
        requestId: createCallEventId(),
        calleeUid,
        mediaType: 'audio',
      });
      if (!response.ok || !response.session) throw callError(response.status || 'call_rejected');
      sessionRef.current = response.session;
      lastIceRestartRef.current = Number(response.session.iceRestartSequence || 0);
      updateCall({
        status: 'call',
        sessionId: response.session.sessionId,
        direction: 'outgoing',
        peerUid: calleeUid,
        displayName,
        photoURL,
        serverState: response.session.state,
        terminalReason: null,
        activeSince: null,
        isMuted: false,
      });
      const ready = await sendCommand('INVITE_READY');
      if (!ready.ok && ready.status !== 'DUPLICATE') throw callError(ready.status || 'call_rejected');
      return ready;
    } catch (error) {
      closeMedia();
      sessionRef.current = null;
      updateCall(EMPTY_CALL);
      throw error;
    }
  }, [closeMedia, sendCommand, supported, updateCall]);

  const answer = useCallback(async () => {
    if (callRef.current.direction !== 'incoming' || sessionRef.current?.state !== BROWSER_CALL_STATES.RINGING) return;
    localStreamRef.current = await requestBrowserMicrophone();
    const response = await sendCommand('ACCEPT');
    if (!response.ok && response.status !== 'DUPLICATE') {
      closeMedia();
      throw callError(response.status || 'call_rejected');
    }
  }, [closeMedia, sendCommand]);

  const end = useCallback(async (decline = false) => {
    const session = sessionRef.current;
    if (!session) return;
    const command = decline && callRef.current.direction === 'incoming'
      && session.state === BROWSER_CALL_STATES.RINGING
      ? 'DECLINE'
      : 'END';
    const response = await sendCommand(command).catch(() => null);
    closeMedia();
    if (!response) {
      updateCall((previous) => ({
        ...previous,
        serverState: BROWSER_CALL_STATES.ENDED,
        terminalReason: command === 'DECLINE' ? 'declined' : 'hangup',
      }));
    }
  }, [closeMedia, sendCommand, updateCall]);

  const toggleMute = useCallback(() => {
    if (callRef.current.serverState !== BROWSER_CALL_STATES.ACTIVE || !mediaRef.current) return;
    const muted = !callRef.current.isMuted;
    mediaRef.current.setMuted(muted);
    updateCall((previous) => ({ ...previous, isMuted: muted }));
  }, [updateCall]);

  const dismiss = useCallback(() => {
    if (callRef.current.serverState !== BROWSER_CALL_STATES.ENDED) return;
    closeMedia();
    sessionRef.current = null;
    updateCall(EMPTY_CALL);
  }, [closeMedia, updateCall]);

  return {
    supported,
    call,
    remoteStream,
    startCall,
    answer,
    decline: () => end(true),
    hangup: () => end(false),
    toggleMute,
    dismiss,
  };
}
