// src/components/CallOverlay.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { answerCall, declineCall, endCall, upgradeToVideo, acceptVideoUpgrade, switchCameraTrack } from '../services/socket';
import { Phone, Video, Mic, MicOff, Camera, Cancel, UserPlus, Message } from './Icons';

export default function CallOverlay({ incoming, active, contacts = [], user, onClose, onEnd }) {
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

  function handleAddParticipant() {
    setShowAddPersonPanel(true);
    setAddPersonQuery('');
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

  const isVideo   = incoming?.isVideo || active?.isVideo || videoUpgraded;
  const callName  = incoming?.callerName || active?.name || 'Contactpersoon';
  const isVoiceActiveLayout = !isVideo && callState !== 'incoming' && callState !== 'ended';
  const isVideoActiveLayout = isVideo && callState !== 'incoming' && callState !== 'ended';

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

  return (
    <div className={`call-overlay ${isVideo && callState === 'active' ? 'video-mode' : ''}`}>

      {/* Verborgen audio element voor spraakgesprekken */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* ── VIDEO STREAMS ── */}
      {isVideo && (
        <div className="video-container">
          <video ref={remoteVideoRef} className="video-remote" autoPlay playsInline />
          <video ref={localVideoRef}  className="video-local"  autoPlay playsInline muted />
        </div>
      )}

      {isVideoActiveLayout && (
        <div className="call-side-quick-actions" aria-label="Snelle gespreksacties">
          <button type="button" className="call-side-action-btn" onClick={handleAddParticipant} title="Persoon toevoegen">
            <UserPlus size={18} aria-hidden="true" />
          </button>
          <button type="button" className="call-side-action-btn" onClick={handleOpenChat} title="Open chat">
            <Message size={18} aria-hidden="true" />
          </button>
          <button type="button" className="call-side-action-btn" onClick={toggleCam} title="Camera draaien">
            <Camera size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── CALL CARD ── */}
      <div className={`call-card ${isVideo && callState === 'active' ? 'transparent' : ''} ${isVoiceActiveLayout ? 'voice-active' : ''}`}>
        {canMinimize && (
          <button type="button" className="call-minimize-btn" aria-label="Minimaliseer gesprek" onClick={() => setMinimized(true)} title="Minimaliseren">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        )}
        <button type="button" className="call-close-btn" aria-label={callState === 'active' || callState === 'calling' || callState === 'connecting' ? 'Beeindig gesprek' : (callState === 'incoming' ? 'Weiger oproep' : 'Gespreksscherm sluiten')} onClick={handleOverlayClose} title="Sluiten">
          <Cancel size={14} aria-hidden="true" />
        </button>
        <div className="call-avatar-big">{callName.slice(0,2).toUpperCase()}</div>
        <div className="call-name">{callName}</div>

        {callState === 'incoming' && (
          <div className="call-status blink" role="status" aria-live="polite">{isVideo ? <><Video size={14} aria-hidden="true" /> Inkomend videogesprek</> : <><Phone size={14} aria-hidden="true" /> Inkomende oproep</>}</div>
        )}
        {callState === 'calling'     && <div className="call-status blink" role="status" aria-live="polite">Bellen…</div>}
        {callState === 'connecting'  && <div className="call-status blink" role="status" aria-live="polite">Verbinden…</div>}
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
        {callState !== 'ended' && <div className={`call-controls ${callState !== 'incoming' ? 'active-layout' : ''} ${isVideoActiveLayout ? 'video-layout' : ''}`}>
          {callState === 'incoming' ? (
            <>
              <button type="button" className="call-ctrl-btn accept"  onClick={handleAccept}><Phone size={18} aria-hidden="true" /><span>Opnemen</span></button>
              <button type="button" className="call-ctrl-btn decline" onClick={handleDecline}><Cancel size={18} aria-hidden="true" /><span>Weigeren</span></button>
            </>
          ) : (
            <>
              {isVideoActiveLayout && (
                <>
                  <button type="button" className="call-ctrl-btn aux" onClick={handleOpenChat} title="Open chat">
                    <Message size={18} aria-hidden="true" /><span>Chat</span>
                  </button>
                  <button
                    type="button"
                    className="call-ctrl-btn aux"
                    onClick={handleAddParticipant}
                    title="Persoon toevoegen"
                  >
                    <UserPlus size={18} aria-hidden="true" /><span>+ Persoon</span>
                  </button>
                  <button type="button" className={`call-ctrl-btn cam ${camOff ? 'on' : ''}`} aria-pressed={camOff} onClick={toggleCam}>
                    {camOff ? <Cancel size={18} aria-hidden="true" /> : <Video size={18} aria-hidden="true" />}<span>Video</span>
                  </button>
                  <button type="button" className="call-ctrl-btn aux" onClick={handleSwitchCamera} disabled={switchingCamera} title="Camera wisselen">
                    <Camera size={18} aria-hidden="true" /><span>{switchingCamera ? 'Wisselen…' : 'Draaien'}</span>
                  </button>
                </>
              )}
              <button type="button" className={`call-ctrl-btn mute ${muted ? 'on' : ''}`} aria-pressed={muted} onClick={toggleMute}>
                {muted ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}<span>{muted ? 'Dempen uit' : 'Dempen'}</span>
              </button>
              {!isVideo && callState === 'active' && (
                <button
                  type="button"
                  className={`call-ctrl-btn aux ${speakerEnabled ? 'on' : ''}`}
                  onClick={toggleSpeakerMode}
                  disabled={!speakerControlAvailable}
                  title="Speaker/oorluidspreker wisselen"
                >
                  <Phone size={18} aria-hidden="true" />
                  <span>{speakerControlAvailable ? (speakerEnabled ? 'Speaker' : 'Oor') : 'Speaker n.v.t.'}</span>
                </button>
              )}
              {isVideo && !isVideoActiveLayout && (
                <button type="button" className={`call-ctrl-btn cam ${camOff ? 'on' : ''}`} aria-pressed={camOff} onClick={toggleCam}>
                  {camOff ? <Cancel size={18} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}<span>Camera</span>
                </button>
              )}
              {!isVideo && callState === 'active' && (
                <button type="button" className="call-ctrl-btn cam" onClick={handleUpgradeToVideo}>
                  <Video size={18} aria-hidden="true" /><span>Video</span>
                </button>
              )}
              <button type="button" className="call-ctrl-btn end" onClick={handleEnd}><Cancel size={18} aria-hidden="true" /><span>Ophangen</span></button>
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
