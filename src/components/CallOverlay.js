// src/components/CallOverlay.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { answerCall, declineCall, endCall, upgradeToVideo, acceptVideoUpgrade, switchCameraTrack } from '../services/socket';
import { Phone, Video, Mic, Camera, Cancel, UserPlus, Message, Speaker, PhoneEnd } from './Icons';

export default function CallOverlay({ incoming, active, contacts = [], user, chatUnreadCount = 0, onClose, onEnd }) {
  const [callState,    setCallState]    = useState(incoming ? 'incoming' : 'calling');
  const [callMsg,      setCallMsg]      = useState('');
  const [timer,        setTimer]        = useState(0);
  const [muted,        setMuted]        = useState(false);
  const [camOff,       setCamOff]       = useState(false);
  const [videoUpgraded, setVideoUpgraded] = useState(false);
  const [videoUpgradeRequest, setVideoUpgradeRequest] = useState(false);
  const [minimized,    setMinimized]    = useState(false);
  const [showAddPersonPanel, setShowAddPersonPanel] = useState(false);
  const [addPersonQuery, setAddPersonQuery] = useState('');
  const [facingMode, setFacingMode] = useState('user');
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [speakerControlAvailable, setSpeakerControlAvailable] = useState(false);
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
    const videoStream = await upgradeToVideo();
    if (videoStream) {
      localStreamRef.current = videoStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = videoStream;
      setVideoUpgraded(true);
    }
  }

  async function handleSwitchCamera() {
    if (!localStreamRef.current || switchingCamera || !isVideo) return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setSwitchingCamera(true);
    try {
      const result = await switchCameraTrack(localStreamRef.current, nextMode);
      if (result?.ok) {
        setFacingMode(nextMode);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play?.().catch(() => {});
        }
        return;
      }
      setCallMsg('Camera wisselen is momenteel niet beschikbaar op dit apparaat.');
    } finally {
      setSwitchingCamera(false);
    }
  }

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

  const filteredContacts = contacts
    .filter((contact) => contact?.uid && contact.uid !== user?.uid)
    .filter((contact) => {
      const query = addPersonQuery.trim().toLowerCase();
      if (!query) return true;
      return String(contact.displayName || '').toLowerCase().includes(query)
        || String(contact.email || '').toLowerCase().includes(query);
    })
    .slice(0, 12);

  function handleSelectParticipant(contact) {
    setShowAddPersonPanel(false);
    setCallMsg(`${contact?.displayName || contact?.email || 'Contact'} toevoegen aan gesprek komt binnenkort.`);
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
        timeout:     'Geen antwoord.',
        busy:        'Contactpersoon is in gesprek.',
      };
      setCallMsg(msgs[active.endReason] || 'Gesprek beëindigd.');
      setCallState('ended');
      cleanup();
      closeTimeoutRef.current = setTimeout(() => onClose?.(), 3000);
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
    const onBeforeUnload = () => safeClose('beforeunload');
    const onPopState = () => safeClose('back_navigation');
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
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
  const isVoiceCallLayout = !isVideo && callState !== 'ended';
  const isVoiceActiveLayout = !isVideo && callState !== 'incoming' && callState !== 'ended';
  const isVideoActiveLayout = isVideo && callState !== 'incoming' && callState !== 'ended';
  const isVideoPendingLayout = isVideoActiveLayout && !hasRemoteVideoTrack;
  const incomingTimeLabel = new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  const canMinimize = callState === 'calling' || callState === 'active' || callState === 'connecting';

  if (minimized) return (
    <div className="call-mini-bar" role="button" tabIndex={0} aria-label={`Open gesprek met ${callName}`} onClick={() => setMinimized(false)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMinimized(false); } }}>
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
        <Cancel size={16} aria-hidden="true" />
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

  return (
    <div className={`call-overlay ${isVideoActiveLayout ? 'video-mode' : ''} ${isVideoPendingLayout ? 'video-pending-mode' : ''}`}>

      {/* Verborgen audio element voor spraakgesprekken */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {isVideoActiveLayout && !isVideoPendingLayout && (
        <div className="call-side-quick-actions" aria-label="Extra gespreksacties">
          <button type="button" className="call-side-action-btn" onClick={handleSwitchCamera} disabled={switchingCamera} title="Camera draaien" aria-label="Camera draaien">
            <CameraRotateIcon size={18} />
          </button>
          <button type="button" className="call-side-action-btn" onClick={handleOpenChat} title="Open chat" aria-label="Open chat">
            <Message size={18} aria-hidden="true" />
            {chatUnreadCount > 0 && (
              <span className="call-side-action-badge" aria-label={`${chatUnreadCount} ongelezen berichten`}>
                {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
              </span>
            )}
          </button>
          <button type="button" className="call-side-action-btn" onClick={() => setShowAddPersonPanel(true)} title="Persoon toevoegen" aria-label="Persoon toevoegen">
            <UserPlus size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── VIDEO STREAMS ── */}
      {isVideo && (
        <div className={`video-container ${isVideoPendingLayout ? 'video-container-pending' : ''}`}>
          <video ref={remoteVideoRef} className="video-remote" autoPlay playsInline />
          <video ref={localVideoRef}  className="video-local"  autoPlay playsInline muted />
        </div>
      )}

      {/* ── CALL CARD ── */}
      <div className={`call-card ${isVideoActiveLayout ? 'transparent' : ''} ${isVoiceCallLayout ? 'voice-active' : ''} ${isVideoPendingLayout ? 'call-video-pending' : ''}`}>
        {canMinimize && (
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
        {isVideoPendingLayout ? (
          <div className="call-pending-head">
            <div className="call-pending-avatar">{callName.slice(0,2).toUpperCase()}</div>
            <div className="call-pending-copy">
              <div className="call-name">{callName}</div>
              {callState === 'calling'    && <div className="call-status blink" role="status" aria-live="polite">Bellen…</div>}
              {callState === 'connecting' && <div className="call-status blink" role="status" aria-live="polite">Verbinden…</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="call-avatar-big">{callName.slice(0,2).toUpperCase()}</div>
            <div className="call-name">{callName}</div>
          </>
        )}

        {callState === 'incoming' && (
          <div className="call-status call-status-incoming blink" role="status" aria-live="polite">
            {isVideo ? <><Video size={24} aria-hidden="true" /> Inkomend videogesprek</> : <><Phone size={24} aria-hidden="true" /> Inkomende oproep</>}
          </div>
        )}
        {!isVideoPendingLayout && callState === 'calling'     && <div className="call-status blink" role="status" aria-live="polite">Bellen…</div>}
        {!isVideoPendingLayout && callState === 'connecting'  && <div className="call-status blink" role="status" aria-live="polite">Verbinden…</div>}
        {callState === 'active'      && <div className="call-timer" aria-label={`Gespreksduur ${formatTimer(timer)}`}>{formatTimer(timer)}</div>}
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
        {callState !== 'ended' && <div className={`call-controls ${callState !== 'incoming' ? 'active-layout' : 'incoming-layout'} ${isVideoActiveLayout ? 'video-layout' : ''}`}>
          {callState === 'incoming' ? (
            <>
              <button type="button" className="call-ctrl-btn accept incoming-btn"  onClick={handleAccept}><Phone size={26} aria-hidden="true" /><span>Opnemen</span></button>
              <button type="button" className="call-ctrl-btn decline incoming-btn" onClick={handleDecline}><Cancel size={26} aria-hidden="true" /><span>Weigeren</span></button>
            </>
          ) : (
            <>
              {isVideoActiveLayout && (
                <>
                  <button type="button" className="call-ctrl-btn aux call-ctrl-round call-ctrl-chat call-ctrl-secondary" onClick={handleOpenChat} title="Bericht versturen" aria-label="Bericht versturen">
                    <Message size={18} aria-hidden="true" />
                    <span>Bericht</span>
                    {chatUnreadCount > 0 && (
                      <span className="call-chat-badge" aria-label={`${chatUnreadCount} ongelezen berichten`}>
                        {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`call-ctrl-btn cam call-ctrl-round ${camOff ? 'on' : ''}`}
                    aria-pressed={camOff}
                    onClick={toggleCam}
                    aria-label={camOff ? 'Camera aanzetten' : 'Camera uitzetten'}
                  >
                    {camOff ? <Cancel size={18} aria-hidden="true" /> : <Video size={18} aria-hidden="true" />}<span>Camera</span>
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
                  <button
                    type="button"
                    className="call-ctrl-btn aux call-ctrl-round call-ctrl-secondary call-ctrl-add-person"
                    onClick={() => setShowAddPersonPanel(true)}
                    aria-label="Persoon toevoegen"
                    title="Persoon toevoegen"
                  >
                    <UserPlus size={18} aria-hidden="true" /><span>+ Persoon</span>
                  </button>
                  <button type="button" className="call-ctrl-btn end call-ctrl-round" onClick={handleEnd} aria-label="Ophangen"><PhoneEnd size={24} aria-hidden="true" /><span>Ophangen</span></button>
                </>
              )}
              {!isVoiceActiveLayout && !isVideoActiveLayout && (
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
                <button type="button" className="call-ctrl-btn cam call-ctrl-round" onClick={handleUpgradeToVideo} aria-label="Video">
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
              {isVoiceActiveLayout && (
                <button
                  type="button"
                  className="call-ctrl-btn aux call-ctrl-round call-ctrl-disabled call-ctrl-add-person"
                  disabled
                  aria-disabled="true"
                  aria-label="Persoon toevoegen"
                  title="Persoon toevoegen binnenkort"
                >
                  <UserPlus size={18} aria-hidden="true" /><span>+ Persoon</span>
                </button>
              )}
              {isVideo && !isVideoActiveLayout && (
                <button type="button" className={`call-ctrl-btn cam ${camOff ? 'on' : ''}`} aria-pressed={camOff} onClick={toggleCam}>
                  {camOff ? <Cancel size={18} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}<span>Camera</span>
                </button>
              )}
              {!isVoiceActiveLayout && !isVideoActiveLayout && (
                <button type="button" className="call-ctrl-btn end" onClick={handleEnd}><PhoneEnd size={24} aria-hidden="true" /><span>Ophangen</span></button>
              )}
              {isVoiceActiveLayout && (
                <button type="button" className="call-ctrl-btn end call-ctrl-round" onClick={handleEnd} aria-label="Ophangen"><PhoneEnd size={24} aria-hidden="true" /><span>Ophangen</span></button>
              )}
            </>
          )}
        </div>}
      </div>

      {showAddPersonPanel && (
        <div className="call-add-sheet" role="dialog" aria-modal="true" aria-label="Contact toevoegen aan gesprek">
          <div className="call-add-sheet-head">
            <strong>Persoon toevoegen</strong>
            <button
              type="button"
              className="call-add-sheet-close"
              aria-label="Sluiten"
              onClick={() => setShowAddPersonPanel(false)}
            >
              <Cancel size={16} aria-hidden="true" />
            </button>
          </div>
          <input
            type="text"
            className="call-add-sheet-input"
            placeholder="Zoek contact"
            value={addPersonQuery}
            onChange={(event) => setAddPersonQuery(event.target.value)}
            autoFocus
          />
          <div className="call-add-sheet-list">
            {filteredContacts.length === 0 && (
              <div className="call-add-sheet-empty">Geen contacten gevonden.</div>
            )}
            {filteredContacts.map((contact) => (
              <button
                key={contact.uid}
                type="button"
                className="call-add-sheet-item"
                onClick={() => handleSelectParticipant(contact)}
              >
                <span className="call-add-sheet-avatar">
                  {(contact.displayName || contact.email || '?').slice(0, 2).toUpperCase()}
                </span>
                <span className="call-add-sheet-copy">
                  <span className="call-add-sheet-name">{contact.displayName || 'Contact'}</span>
                  <span className="call-add-sheet-sub">{contact.email || 'Pulse contact'}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
  const CameraRotateIcon = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H8l1.4-2h5.2L16 6h2.5A2.5 2.5 0 0 1 21 8.5v7A2.5 2.5 0 0 1 18.5 18H5.5A2.5 2.5 0 0 1 3 15.5z" />
      <path d="M15.8 8.7a4.2 4.2 0 0 1 1.3 3h1.3" />
      <path d="m18.9 9.9-.8 1.7-1.7-.8" />
      <path d="M8.2 15.3a4.2 4.2 0 0 1-1.3-3H5.6" />
      <path d="m5.1 14.1.8-1.7 1.7.8" />
    </svg>
  );

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
