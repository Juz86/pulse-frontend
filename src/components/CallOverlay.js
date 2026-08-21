// src/components/CallOverlay.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { answerCall, declineCall, endCall, upgradeToVideo, acceptVideoUpgrade, switchCameraTrack } from '../services/socket';
import { Phone, Video, Mic, MicOff, Camera, CameraSwitch, Cancel, Message, Speaker, PhoneEnd } from './Icons';
import chatDefaultPattern from '../assets/chatachtergrond.jpeg';

export default function CallOverlay({ incoming, active, contacts = [], chatUnreadCount = 0, onClose, onEnd, onRetryCall }) {
  const [callState,    setCallState]    = useState(incoming ? 'incoming' : 'calling');
  const [callMsg,      setCallMsg]      = useState('');
  const [timer,        setTimer]        = useState(0);
  const [muted,        setMuted]        = useState(false);
  const [camOff,       setCamOff]       = useState(false);
  const [videoUpgraded, setVideoUpgraded] = useState(false);
  const [videoUpgradeRequest, setVideoUpgradeRequest] = useState(false);
  const [minimized,    setMinimized]    = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [speakerControlAvailable, setSpeakerControlAvailable] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [cameraSwitchMessage, setCameraSwitchMessage] = useState('');
  const [networkState, setNetworkState] = useState('stable');
  const closingRef = useRef(false);

  const localVideoRef   = useRef(null);
  const remoteVideoRef  = useRef(null);
  const remoteAudioRef  = useRef(null);
  const timerRef        = useRef(null);
  const closeTimeoutRef = useRef(null);
  const localStreamRef  = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioStreamRef = useRef(null);
  const remoteTrackListenerCleanupRef = useRef(null);
  const cameraSwitchMessageTimeoutRef = useRef(null);

  const attachMediaStream = useCallback(async (element, stream) => {
    if (!element || !stream) return;
    const isAudioElement = element instanceof HTMLAudioElement;
    const audioTracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
    const mediaStream = isAudioElement && audioTracks.length
      ? new MediaStream(audioTracks)
      : stream;

    if (isAudioElement) {
      remoteAudioStreamRef.current = mediaStream;
      element.autoplay = true;
      element.muted = false;
      element.volume = 1;
      element.playsInline = true;
    }

    element.srcObject = mediaStream;
    element.onloadedmetadata = () => {
      element.play?.().catch((error) => {
        console.warn('[Pulse] Fout: media metadata afspelen mislukt:', error?.message || error);
      });
    };
    try {
      await element.play?.();
    } catch (error) {
      console.warn('[Pulse] Fout: media afspelen mislukt:', error?.message || error);
    }
  }, []);

  const bindRemoteAudioStream = useCallback((stream) => {
    if (!stream) return;
    remoteTrackListenerCleanupRef.current?.();
    const syncAudio = () => {
      if (remoteAudioRef.current) attachMediaStream(remoteAudioRef.current, stream);
    };
    stream.addEventListener?.('addtrack', syncAudio);
    stream.addEventListener?.('removetrack', syncAudio);
    remoteTrackListenerCleanupRef.current = () => {
      stream.removeEventListener?.('addtrack', syncAudio);
      stream.removeEventListener?.('removetrack', syncAudio);
    };
    syncAudio();
  }, [attachMediaStream]);

  // ── Inkomend gesprek beantwoorden ────────────────────────────────────────
  async function handleAccept() {
    setCallState('connecting');
    try {
      const localStream = await answerCall({
        fromUid:  incoming.from,
        offer:    incoming.offer,
        sessionId: incoming.sessionId || null,
        isVideo:  incoming.isVideo,
        onStream: (remoteStream, localStream) => {
          localStreamRef.current  = localStream;
          remoteStreamRef.current = remoteStream;
          if (localVideoRef.current)  attachMediaStream(localVideoRef.current, localStream);
          if (remoteVideoRef.current) attachMediaStream(remoteVideoRef.current, remoteStream);
          bindRemoteAudioStream(remoteStream);
          setCallState('active');
          startTimer();
        },
        onEnd: () => { cleanup(); onClose?.(true); },
        onVideoUpgradeRequest: () => setVideoUpgradeRequest(true),
        onConnectionFallback: (message) => setCallMsg(message),
      });
      localStreamRef.current = localStream;
      if (localVideoRef.current) attachMediaStream(localVideoRef.current, localStream);
    } catch (e) {
      const isPermissionError = e?.name === 'NotAllowedError' || /toegang|permission|geweigerd/i.test(String(e?.message || ''));
      setCallMsg(isPermissionError
        ? 'Toegang tot camera/microfoon geweigerd. Sta rechten toe in Android instellingen.'
        : (e.message || 'Kan geen toegang krijgen tot microfoon/camera.'));
      setCallState('ended');
      closeTimeoutRef.current = setTimeout(() => onClose?.(), 3000);
    }
  }

  // ── Weigeren ─────────────────────────────────────────────────────────────
  function handleDecline() {
    declineCall(incoming?.from, incoming?.sessionId || null);
    cleanup();
    onClose?.(); // geen argument → gemiste oproep loggen
  }

  // ── Ophangen ─────────────────────────────────────────────────────────────
  function handleEnd() {
    const toUid = incoming?.from || active?.toUid;
    if (toUid) endCall(toUid, incoming?.sessionId || active?.sessionId || null);
    cleanup();
    onEnd?.();
    onClose?.();
  }

  function startTimer() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
  }

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(closeTimeoutRef.current);
    clearTimeout(cameraSwitchMessageTimeoutRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    remoteStreamRef.current?.getTracks?.().forEach(t => t.stop());
    remoteAudioStreamRef.current?.getTracks?.().forEach(t => t.stop());
    remoteTrackListenerCleanupRef.current?.();
    remoteTrackListenerCleanupRef.current = null;
    remoteAudioStreamRef.current = null;
  }, []);

  const safeClose = useCallback((reason = 'local_close') => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (callState === 'incoming') {
      declineCall(incoming?.from, incoming?.sessionId || null);
      cleanup();
      onClose?.();
      return;
    }
    if (callState === 'calling' || callState === 'connecting' || callState === 'active') {
      const toUid = incoming?.from || active?.toUid;
      if (toUid) endCall(toUid, incoming?.sessionId || active?.sessionId || null);
      cleanup();
      onEnd?.(reason);
      onClose?.();
      return;
    }
    cleanup();
    onClose?.();
  }, [callState, incoming, active, onClose, onEnd, cleanup]);

  function handleOverlayClose() {
    safeClose('overlay_close');
  }

  function toggleMute() {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) { audioTrack.enabled = muted; setMuted(!muted); }
  }

  function toggleCam() {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) { videoTrack.enabled = camOff; setCamOff(!camOff); }
  }

  async function handleAcceptVideoUpgrade() {
    setVideoUpgradeRequest(false);
    const vs = await acceptVideoUpgrade();
    if (vs) {
      localStreamRef.current = vs;
      if (localVideoRef.current) localVideoRef.current.srcObject = vs;
      setVideoUpgraded(true);
    }
  }

  async function handleUpgradeToVideo() {
    // Net als WhatsApp kan een audiogesprek pas naar video worden omgezet
    // nadat de andere persoon heeft opgenomen. De ontvanger krijgt daarna
    // via `call:video-upgrade` eerst de keuze om de camera te starten.
    if (callState !== 'active') return;
    const videoStream = await upgradeToVideo();
    if (videoStream) {
      localStreamRef.current = videoStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = videoStream;
      setVideoUpgraded(true);
    }
  }

  async function handleSwitchCamera() {
    const stream = localStreamRef.current;
    if (isSwitchingCamera) return;
    if (!stream) {
      setCameraSwitchMessage('Camera is nog niet beschikbaar.');
      return;
    }

    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setIsSwitchingCamera(true);
    try {
      const result = await switchCameraTrack(stream, nextFacing);
      if (!result?.ok) {
        const messageByReason = {
          no_alternative_camera: 'Geen andere camera beschikbaar.',
          same_camera: 'Geen andere camera beschikbaar.',
          NotAllowedError: 'Camera-toegang is niet toegestaan.',
          NotFoundError: 'Geen andere camera beschikbaar.',
          NotReadableError: 'De andere camera is nu niet beschikbaar. Probeer opnieuw.',
          replace_track_unsupported: 'Camera wisselen wordt niet ondersteund op dit apparaat.',
        };
        setCameraSwitchMessage(messageByReason[result?.reason] || 'Camera wisselen is niet gelukt.');
        return;
      }

      setCameraFacing(result.facingMode === 'environment' ? 'environment' : 'user');
      if (localVideoRef.current) await attachMediaStream(localVideoRef.current, stream);
    } finally {
      setIsSwitchingCamera(false);
    }
  }

  useEffect(() => {
    if (!cameraSwitchMessage) return undefined;
    clearTimeout(cameraSwitchMessageTimeoutRef.current);
    cameraSwitchMessageTimeoutRef.current = setTimeout(() => setCameraSwitchMessage(''), 3200);
    return () => clearTimeout(cameraSwitchMessageTimeoutRef.current);
  }, [cameraSwitchMessage]);

  async function toggleSpeakerMode() {
    const audioEl = remoteAudioRef.current || remoteVideoRef.current;
    if (!audioEl || typeof audioEl.setSinkId !== 'function') {
      setCallMsg('Speaker wisselen wordt op dit apparaat niet ondersteund.');
      return;
    }
    const nextEnabled = !speakerEnabled;
    const preferredSink = nextEnabled ? 'default' : 'communications';
    try {
      await audioEl.setSinkId(preferredSink);
      setSpeakerEnabled(nextEnabled);
    } catch (error) {
      console.warn('[Pulse][Call] Speaker route wisselen mislukt:', error?.message || error);
      setCallMsg('Speaker wisselen is niet gelukt. Controleer toestel-audio instellingen.');
    }
  }

  function handleOpenChat() {
    setMinimized(true);
  }

  function formatTimer(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  }

  // Actief gesprek: koppel streams en activeer zodra remoteStream beschikbaar is
  useEffect(() => {
    if (active?.localStream) {
      localStreamRef.current = active.localStream;
      if (localVideoRef.current) attachMediaStream(localVideoRef.current, active.localStream);
    }
    if (active?.remoteStream) {
      remoteStreamRef.current = active.remoteStream;
      if (remoteVideoRef.current) attachMediaStream(remoteVideoRef.current, active.remoteStream);
      bindRemoteAudioStream(active.remoteStream);
    }
    if (active?.remoteStream && callState === 'calling') {
      setCallState('active');
      startTimer();
    }
    if (active?.videoUpgradeRequest) setVideoUpgradeRequest(true);
    if (active?.endReason) {
      const msgs = {
        unavailable: 'Gebruiker is niet beschikbaar of offline.',
        declined:    'Oproep geweigerd.',
        timeout:     'Geen antwoord',
        busy:        'Contactpersoon is in gesprek.',
      };
      setCallMsg(msgs[active.endReason] || 'Gesprek beëindigd.');
      setCallState('ended');
      cleanup();
      if (active.endReason !== 'timeout') {
        closeTimeoutRef.current = setTimeout(() => onClose?.(), 3000);
      }
    }
  }, [active, callState, onClose, attachMediaStream, bindRemoteAudioStream, cleanup]);

  // ── Beltoon bij inkomend gesprek ─────────────────────────────────────────
  useEffect(() => {
    if (callState !== 'incoming') return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let active = true;

    function ring() {
      if (!active) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      setTimeout(() => { if (active) ring(); }, 1400);
    }
    ring();
    return () => { active = false; ctx.close(); };
  }, [callState]);

  useEffect(() => {
    const audioEl = remoteAudioRef.current || remoteVideoRef.current;
    setSpeakerControlAvailable(Boolean(audioEl && typeof audioEl.setSinkId === 'function'));
  }, [callState, active?.isVideo, incoming?.isVideo, videoUpgraded]);

  useEffect(() => {
    const onOffline = () => setNetworkState('reconnecting');
    const onOnline = () => setNetworkState('stable');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    const onPageHide = () => safeClose('pagehide');
    const onPopState = () => safeClose('back_navigation');
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('popstate', onPopState);
    };
  }, [safeClose]);

  // Zodra video-upgrade actief is, zet streams opnieuw op de nieuw-gemounte video-elementen
  useEffect(() => {
    if (!videoUpgraded) return;
    if (localStreamRef.current  && localVideoRef.current)  attachMediaStream(localVideoRef.current, localStreamRef.current);
    if (remoteStreamRef.current && remoteVideoRef.current) attachMediaStream(remoteVideoRef.current, remoteStreamRef.current);
    if (remoteStreamRef.current) bindRemoteAudioStream(remoteStreamRef.current);
  }, [videoUpgraded, attachMediaStream, bindRemoteAudioStream]);

  const hasLocalVideoTrack =
    !!active?.localStream?.getVideoTracks?.()?.length ||
    !!localStreamRef.current?.getVideoTracks?.()?.length;
  const hasRemoteVideoTrack =
    !!active?.remoteStream?.getVideoTracks?.()?.length ||
    !!remoteStreamRef.current?.getVideoTracks?.()?.length;
  const isVideo   = incoming?.isVideo || active?.isVideo || videoUpgraded || hasLocalVideoTrack;
  const callName  = incoming?.callerName || active?.name || 'Contactpersoon';
  const targetUid = incoming?.from || active?.toUid || '';
  const targetContact = contacts.find((contact) => contact?.uid === targetUid) || null;
  const callPhotoUrl = targetContact?.photoURL || '';
  const isVoiceCallLayout = !isVideo && callState !== 'ended';
  const isVoiceActiveLayout = !isVideo && callState !== 'incoming' && callState !== 'ended';
  const isVideoActiveLayout = isVideo && callState !== 'incoming' && callState !== 'ended';
  const canRequestVideoUpgrade = callState === 'active';
  const isVideoPendingLayout = isVideoActiveLayout && !hasRemoteVideoTrack;
  const hasActiveHeaderLayout = (isVoiceActiveLayout || isVideoActiveLayout) && !isVideoPendingLayout;
  const useCenteredActiveHeader = isVoiceActiveLayout || isVideoActiveLayout;
  const callingStatusLabel = 'Bellen…';
  const shouldShowVideoCallControls = Boolean(active?.isVideo || isVideo)
    && callState !== 'incoming'
    && callState !== 'ended';
  const incomingTimeLabel = new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const canMinimize = callState === 'calling' || callState === 'active' || callState === 'connecting';
  const isNoAnswerEnded = callState === 'ended' && /geen antwoord/i.test(callMsg || '');

  function handleRetryCall() {
    if (typeof onRetryCall === 'function' && targetUid) {
      onRetryCall(targetUid, Boolean(active?.isVideo || incoming?.isVideo || isVideo));
      return;
    }
    onClose?.();
  }

  const videoCallControls = (
    <>
      <button type="button" className="call-ctrl-btn aux call-ctrl-round call-ctrl-chat" onClick={handleOpenChat} title="Bericht versturen" aria-label="Bericht versturen">
        <Message size={18} aria-hidden="true" />
        <span>Chat</span>
      </button>
      <button
        type="button"
        className={`call-ctrl-btn cam call-ctrl-round ${!camOff ? 'on' : ''}`}
        aria-pressed={!camOff}
        onClick={toggleCam}
        aria-label={camOff ? 'Camera aanzetten' : 'Camera uitzetten'}
      >
        <Video size={18} aria-hidden="true" /><span>Camera</span>
      </button>
      <button
        type="button"
        className={`call-ctrl-btn aux call-ctrl-round call-ctrl-speaker ${speakerEnabled ? 'on' : ''}`}
        onClick={toggleSpeakerMode}
        disabled={!speakerControlAvailable}
        title="Luidspreker"
        aria-label="Luidspreker"
      >
        <Speaker size={19} aria-hidden="true" />
        <span>Luidspreker</span>
      </button>
      <button
        type="button"
        className={`call-ctrl-btn mute call-ctrl-round ${muted ? 'on' : ''}`}
        aria-pressed={muted}
        onClick={toggleMute}
        aria-label={muted ? 'Geluid aan' : 'Geluid uit'}
      >
        {muted ? <MutedMicIcon size={22} /> : <Mic size={20} aria-hidden="true" />}<span>{muted ? 'Geluid aan' : 'Geluid uit'}</span>
      </button>
      <button type="button" className="call-ctrl-btn end call-ctrl-round" onClick={handleEnd} aria-label="Ophangen"><PhoneEnd size={24} aria-hidden="true" /><span>Ophangen</span></button>
    </>
  );

  const videoTopBar = isVideoActiveLayout ? (
    <div className="call-video-topbar">
      <button type="button" className="call-video-topbar-action" aria-label="Minimaliseer gesprek" onClick={() => setMinimized(true)} title="Minimaliseren">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 9H4V4" />
          <path d="m4 9 6-6" />
          <path d="M15 15h5v5" />
          <path d="m20 15-6 6" />
        </svg>
      </button>
      <div className="call-video-topbar-copy">
        <div className="call-video-topbar-name">{callName}</div>
        <div className="call-video-topbar-status" role="status" aria-live="polite">
          {cameraSwitchMessage || (callState === 'active' ? formatTimer(timer) : (callState === 'connecting' ? 'Verbinden…' : 'Bellen…'))}
        </div>
      </div>
      <button type="button" className={`call-video-topbar-action ${isSwitchingCamera ? 'is-switching' : ''}`} onClick={handleSwitchCamera} title="Camera wisselen" aria-label="Camera wisselen" disabled={isSwitchingCamera}>
        <CameraSwitch size={27} aria-hidden="true" />
      </button>
    </div>
  ) : null;

  const voiceTopBar = isVoiceActiveLayout ? (
    <div className="call-voice-topbar">
      <button type="button" className="call-video-topbar-action" aria-label="Minimaliseer gesprek" onClick={() => setMinimized(true)} title="Minimaliseren">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 9H4V4" />
          <path d="m4 9 6-6" />
          <path d="M15 15h5v5" />
          <path d="m20 15-6 6" />
        </svg>
      </button>
      <div className="call-video-topbar-copy">
        <div className="call-video-topbar-name">{callName}</div>
        <div className="call-video-topbar-status" role="status" aria-live="polite">
          {callState === 'active' ? formatTimer(timer) : (callState === 'connecting' ? 'Verbinden…' : callingStatusLabel)}
        </div>
      </div>
      <span className="call-voice-topbar-spacer" aria-hidden="true" />
    </div>
  ) : null;

  if (minimized) return (
    <div className="call-mini-bar" role="button" tabIndex={0} aria-label={`Open gesprek met ${callName}`} onClick={() => setMinimized(false)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMinimized(false); } }}>
      <button
        type="button"
        className={`call-mini-mute${muted ? ' is-muted' : ''}`}
        aria-label={muted ? 'Dempen uitschakelen' : 'Dempen'}
        title={muted ? 'Dempen uitschakelen' : 'Dempen'}
        onClick={event => { event.stopPropagation(); toggleMute(); }}
      >
        {muted ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
      </button>
      <div className="call-mini-avatar">{callName.slice(0,2).toUpperCase()}</div>
      <div className="call-mini-info">
        <span className="call-mini-name">{callName}</span>
        <span className="call-mini-status">
          {callState === 'active' ? formatTimer(timer) : 'Verbinden…'}
        </span>
      </div>
      {callState === 'active' && <div className="call-mini-pulse" aria-hidden="true" />}
      <button type="button" className="call-mini-end" aria-label={`Beeindig gesprek met ${callName}`} onClick={e => { e.stopPropagation(); handleEnd(); }}
        title="Ophangen">
        <PhoneEnd size={24} aria-hidden="true" />
      </button>
    </div>
  );

  if (callState === 'incoming') {
    return (
      <div className="call-overlay call-overlay--incoming">
        <audio ref={remoteAudioRef} autoPlay playsInline />
        <div className="call-incoming-sheet" role="dialog" aria-modal="true" aria-label={`Inkomende oproep van ${callName}`}>
          <div className="call-incoming-sheet__meta">
            <div className="call-incoming-sheet__avatar-wrap">
              <div className="call-incoming-sheet__avatar">{callName.slice(0, 2).toUpperCase()}</div>
              <div className="call-incoming-sheet__badge" aria-hidden="true">
                <img src="/logo192.png" alt="" className="call-incoming-sheet__badge-logo" />
              </div>
            </div>
            <div className="call-incoming-sheet__copy">
              <div className="call-incoming-sheet__eyebrow">
                <span className="call-incoming-sheet__app">Pulse</span>
                <span className="call-incoming-sheet__time">{incomingTimeLabel}</span>
              </div>
              <div className="call-incoming-sheet__name">{callName}</div>
              <div className="call-incoming-sheet__status" role="status" aria-live="polite">
                {isVideo ? 'Inkomend videogesprek' : 'Inkomende spraakoproep'}
              </div>
            </div>
          </div>

          <div className="call-incoming-sheet__actions">
            <button type="button" className="call-incoming-sheet__action call-incoming-sheet__action--decline" onClick={handleDecline}>
              Weigeren
            </button>
            <button type="button" className="call-incoming-sheet__action call-incoming-sheet__action--accept" onClick={handleAccept}>
              Beantwoorden
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isNoAnswerEnded) {
    return (
      <div className="call-overlay call-overlay--ended-no-answer">
        <div className="call-no-answer-screen" role="dialog" aria-modal="true" aria-label={`Geen antwoord van ${callName}`}>
          <div className="call-no-answer-body">
            <div className="call-no-answer-avatar-wrap">
              {callPhotoUrl ? (
                <img src={callPhotoUrl} alt="" className="call-no-answer-photo" />
              ) : (
                <div className="call-no-answer-avatar">{callName.slice(0, 2).toUpperCase()}</div>
              )}
            </div>
            <div className="call-no-answer-name">{callName}</div>
            <div className="call-no-answer-status">{callMsg}</div>
          </div>

          <div className="call-no-answer-actions">
            <button type="button" className="call-no-answer-action" onClick={() => onClose?.()}>
              <span className="call-no-answer-action-circle call-no-answer-action-circle--cancel">
                <Cancel size={28} aria-hidden="true" />
              </span>
              <span className="call-no-answer-action-label">Annuleer</span>
            </button>
            <button type="button" className="call-no-answer-action" onClick={() => onClose?.()}>
              <span className="call-no-answer-action-circle call-no-answer-action-circle--neutral">
                <Message size={28} aria-hidden="true" />
              </span>
              <span className="call-no-answer-action-label">Stuur een bericht</span>
            </button>
            <button type="button" className="call-no-answer-action" onClick={handleRetryCall}>
              <span className="call-no-answer-action-circle call-no-answer-action-circle--retry">
                <Phone size={28} aria-hidden="true" />
              </span>
              <span className="call-no-answer-action-label">Bel opnieuw</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`call-overlay call-overlay--desktop-panel ${isVideoActiveLayout ? 'video-mode call-overlay--video-reference' : ''} ${isVideoPendingLayout ? 'video-pending-mode' : ''} ${isVoiceActiveLayout ? 'call-overlay--voice-reference' : ''}`}
      style={(isVoiceActiveLayout || isVideoPendingLayout) ? { backgroundImage: `linear-gradient(180deg, rgba(5,5,7,.76), rgba(5,5,7,.82)), url(${chatDefaultPattern})` } : undefined}
    >

      {/* Verborgen audio element voor spraakgesprekken */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* ── VIDEO STREAMS ── */}
      {isVideo && (
        <div className={`video-container ${isVideoPendingLayout ? 'video-container-pending' : ''} ${hasRemoteVideoTrack ? 'video-container-live' : 'video-container-placeholder'}`}>
          <video ref={remoteVideoRef} className="video-remote" autoPlay playsInline />
          <video ref={localVideoRef}  className="video-local"  autoPlay playsInline muted />
        </div>
      )}

      {videoTopBar}
      {voiceTopBar}

      {/* ── CALL CARD ── */}
      <div className={`call-card ${isVideoActiveLayout ? 'transparent' : ''} ${isVoiceCallLayout ? 'voice-active' : ''} ${isVideoPendingLayout ? 'call-video-pending' : ''}`}>
        {canMinimize && !isVideoActiveLayout && !isVoiceActiveLayout && (
          <button type="button" className={`call-minimize-btn ${isVideoPendingLayout ? 'call-minimize-btn-right' : ''}`} aria-label="Minimaliseer gesprek" onClick={() => setMinimized(true)} title="Minimaliseren">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 9H4V4" />
              <path d="m4 9 6-6" />
              <path d="M15 15h5v5" />
              <path d="m20 15-6 6" />
            </svg>
          </button>
        )}
        {!isVideoActiveLayout && !isVoiceCallLayout && (
          <button type="button" className="call-close-btn" aria-label={callState === 'active' || callState === 'calling' || callState === 'connecting' ? 'Beeindig gesprek' : (callState === 'incoming' ? 'Weiger oproep' : 'Gespreksscherm sluiten')} onClick={handleOverlayClose} title="Sluiten">
            <Cancel size={14} aria-hidden="true" />
          </button>
        )}
        {hasActiveHeaderLayout && !isVideoActiveLayout && !isVoiceActiveLayout && (
          <div className={`call-active-head ${useCenteredActiveHeader ? 'call-active-head-centered' : ''}`}>
            {!useCenteredActiveHeader && <div className="call-active-head-avatar">{callName.slice(0,2).toUpperCase()}</div>}
            <div className="call-active-head-copy">
              <div className="call-name">{callName}</div>
              {callState === 'active' ? (
                <div className="call-timer" aria-label={`Gespreksduur ${formatTimer(timer)}`}>{formatTimer(timer)}</div>
              ) : (
                <div className="call-status blink" role="status" aria-live="polite">
                  {callState === 'connecting' ? 'Verbinden…' : callingStatusLabel}
                </div>
              )}
            </div>
          </div>
        )}
        {isVideoPendingLayout ? (
          <>
            {!hasLocalVideoTrack && (
              <div className={`call-avatar-big ${callPhotoUrl ? 'call-avatar-big--photo' : ''}`}>
                {callPhotoUrl
                  ? <img src={callPhotoUrl} alt="" className="call-avatar-big-photo" />
                  : callName.slice(0,2).toUpperCase()}
              </div>
            )}
            {!isVideoActiveLayout && !hasActiveHeaderLayout && <div className="call-name">{callName}</div>}
            {!isVideoActiveLayout && !hasActiveHeaderLayout && callState === 'calling' && (
              <div className="call-status blink" role="status" aria-live="polite">Bellen…</div>
            )}
            {!isVideoActiveLayout && !hasActiveHeaderLayout && callState === 'connecting' && (
              <div className="call-status blink" role="status" aria-live="polite">Verbinden…</div>
            )}
          </>
        ) : (
          <>
            {!isVideoActiveLayout && (
              <div className={`call-avatar-big ${callPhotoUrl ? 'call-avatar-big--photo' : ''}`}>
                {callPhotoUrl
                  ? <img src={callPhotoUrl} alt="" className="call-avatar-big-photo" />
                  : callName.slice(0,2).toUpperCase()}
              </div>
            )}
            {!isVideoActiveLayout && !hasActiveHeaderLayout && <div className="call-name">{callName}</div>}
          </>
        )}

        {callState === 'incoming' && (
          <div className="call-status call-status-incoming blink" role="status" aria-live="polite">
            {isVideo ? <><Video size={24} aria-hidden="true" /> Inkomend videogesprek</> : <><Phone size={24} aria-hidden="true" /> Inkomende oproep</>}
          </div>
        )}
        {!isVideoPendingLayout && !hasActiveHeaderLayout && callState === 'calling'     && <div className="call-status blink" role="status" aria-live="polite">{callingStatusLabel}</div>}
        {!isVideoPendingLayout && !hasActiveHeaderLayout && callState === 'connecting'  && <div className="call-status blink" role="status" aria-live="polite">Verbinden…</div>}
        {!hasActiveHeaderLayout && callState === 'active'      && <div className="call-timer" aria-label={`Gespreksduur ${formatTimer(timer)}`}>{formatTimer(timer)}</div>}
        {networkState === 'reconnecting' && callState === 'active' && (
          <div className="call-status blink" role="status" aria-live="polite">Netwerk herverbinden…</div>
        )}
        {videoUpgradeRequest && callState === 'active' && (
          <div className="call-upgrade-banner">
            <div className="call-upgrade-message" role="status" aria-live="polite"><Video size={14} aria-hidden="true" /> {callName} wil videobellen</div>
            <div className="call-upgrade-actions">
              <button type="button" className="call-ctrl-btn decline" onClick={() => setVideoUpgradeRequest(false)}><Cancel size={18} aria-hidden="true" /><span>Weigeren</span></button>
              <button type="button" className="call-ctrl-btn accept" onClick={handleAcceptVideoUpgrade}><Video size={18} aria-hidden="true" /><span>Accepteren</span></button>
            </div>
          </div>
        )}
        {callState === 'ended'       && <div className="call-status call-status-error" role="status" aria-live="assertive">{callMsg}</div>}

        {/* ── KNOPPEN ── */}
        {callState !== 'ended' && <div className={`call-controls ${callState !== 'incoming' ? 'active-layout' : 'incoming-layout'} ${shouldShowVideoCallControls ? 'video-layout' : ''}`}>
          {callState === 'incoming' ? (
            <>
              <button type="button" className="call-ctrl-btn accept incoming-btn"  onClick={handleAccept}><Phone size={26} aria-hidden="true" /><span>Opnemen</span></button>
              <button type="button" className="call-ctrl-btn decline incoming-btn" onClick={handleDecline}><Cancel size={26} aria-hidden="true" /><span>Weigeren</span></button>
            </>
          ) : (
            <>
              {shouldShowVideoCallControls && videoCallControls}
              {!isVoiceActiveLayout && !shouldShowVideoCallControls && (
                <button type="button" className={`call-ctrl-btn mute ${muted ? 'on' : ''}`} aria-pressed={muted} onClick={toggleMute}>
                  {muted ? <MutedMicIcon size={22} /> : <Mic size={20} aria-hidden="true" />}<span>{muted ? 'Dempen uit' : 'Dempen'}</span>
                </button>
              )}
              {isVoiceActiveLayout && (
                <button type="button" className="call-ctrl-btn aux call-ctrl-round call-ctrl-chat" onClick={handleOpenChat} title="Bericht versturen" aria-label="Bericht versturen">
                  <Message size={18} aria-hidden="true" />
                  <span>Bericht</span>
                  {chatUnreadCount > 0 && (
                    <span className="call-chat-badge" aria-label={`${chatUnreadCount} ongelezen berichten`}>
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </button>
              )}
              {isVoiceActiveLayout && (
                <button
                  type="button"
                  className="call-ctrl-btn cam call-ctrl-round"
                  onClick={handleUpgradeToVideo}
                  disabled={!canRequestVideoUpgrade}
                  aria-label={canRequestVideoUpgrade ? 'Videobellen aanvragen' : 'Videobellen is beschikbaar zodra de oproep is opgenomen'}
                  title={canRequestVideoUpgrade ? 'Videobellen aanvragen' : 'Beschikbaar zodra de oproep is opgenomen'}
                >
                  <Video size={18} aria-hidden="true" /><span>Video</span>
                </button>
              )}
              {isVoiceActiveLayout && (
                <button
                  type="button"
                  className={`call-ctrl-btn aux call-ctrl-round call-ctrl-speaker ${speakerEnabled ? 'on' : ''}`}
                  onClick={toggleSpeakerMode}
                  disabled={!speakerControlAvailable}
                  title="Luidspreker"
                  aria-label="Luidspreker"
                >
                  <Speaker size={19} aria-hidden="true" />
                  <span>Luidspreker</span>
                </button>
              )}
              {isVoiceActiveLayout && (
                <button type="button" className={`call-ctrl-btn mute call-ctrl-round ${muted ? 'on' : ''}`} aria-pressed={muted} onClick={toggleMute} aria-label={muted ? 'Geluid aan' : 'Geluid uit'}>
                  {muted ? <MutedMicIcon size={22} /> : <Mic size={20} aria-hidden="true" />}<span>{muted ? 'Geluid aan' : 'Geluid uit'}</span>
                </button>
              )}
              {isVideo && !shouldShowVideoCallControls && (
                <button type="button" className={`call-ctrl-btn cam ${!camOff ? 'on' : ''}`} aria-pressed={!camOff} onClick={toggleCam}>
                  <Camera size={18} aria-hidden="true" /><span>Camera</span>
                </button>
              )}
              {!isVoiceActiveLayout && !shouldShowVideoCallControls && (
                <button type="button" className="call-ctrl-btn end" onClick={handleEnd}><PhoneEnd size={24} aria-hidden="true" /><span>Ophangen</span></button>
              )}
              {isVoiceActiveLayout && (
                <button type="button" className="call-ctrl-btn end call-ctrl-round" onClick={handleEnd} aria-label="Ophangen"><PhoneEnd size={24} aria-hidden="true" /><span>Ophangen</span></button>
              )}
            </>
          )}
        </div>}
      </div>

    </div>
  );
}
  const MutedMicIcon = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="10" rx="3" />
      <path d="M18 10.5v1a6 6 0 0 1-10.2 4.2" />
      <path d="M6 10.5v1a6 6 0 0 0 1.5 4" />
      <path d="M12 16.5v3.5" />
      <path d="M8.5 20h7" />
      <path d="M4 4l16 16" />
    </svg>
  );
