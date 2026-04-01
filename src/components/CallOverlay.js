// src/components/CallOverlay.js
import React, { useEffect, useRef, useState } from 'react';
import { answerCall, declineCall, endCall, upgradeToVideo, acceptVideoUpgrade } from '../services/socket';
import { Phone, Video, Mic, MicOff, Camera, Cancel } from './Icons';

export default function CallOverlay({ incoming, active, user, onClose, onEnd }) {
  const [callState,    setCallState]    = useState(incoming ? 'incoming' : 'calling');
  const [callMsg,      setCallMsg]      = useState('');
  const [timer,        setTimer]        = useState(0);
  const [muted,        setMuted]        = useState(false);
  const [camOff,       setCamOff]       = useState(false);
  const [videoUpgraded, setVideoUpgraded] = useState(false);
  const [videoUpgradeRequest, setVideoUpgradeRequest] = useState(false);
  const [minimized,    setMinimized]    = useState(false);

  const localVideoRef   = useRef(null);
  const remoteVideoRef  = useRef(null);
  const remoteAudioRef  = useRef(null);
  const timerRef        = useRef(null);
  const closeTimeoutRef = useRef(null);
  const localStreamRef  = useRef(null);
  const remoteStreamRef = useRef(null);

  // ── Inkomend gesprek beantwoorden ────────────────────────────────────────
  async function handleAccept() {
    setCallState('connecting');
    try {
      const localStream = await answerCall({
        fromUid:  incoming.from,
        offer:    incoming.offer,
        isVideo:  incoming.isVideo,
        onStream: (remoteStream, localStream) => {
          localStreamRef.current  = localStream;
          remoteStreamRef.current = remoteStream;
          if (localVideoRef.current)  localVideoRef.current.srcObject  = localStream;
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
          setCallState('active');
          startTimer();
        },
        onEnd: () => { cleanup(); onClose?.(true); },
        onVideoUpgradeRequest: () => setVideoUpgradeRequest(true),
        onConnectionFallback: (message) => setCallMsg(message),
      });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    } catch (e) {
      setCallMsg(e.message || 'Kan geen toegang krijgen tot microfoon/camera.');
      setCallState('ended');
      closeTimeoutRef.current = setTimeout(() => onClose?.(), 3000);
    }
  }

  // ── Weigeren ─────────────────────────────────────────────────────────────
  function handleDecline() {
    declineCall(incoming?.from);
    cleanup();
    onClose?.(); // geen argument → gemiste oproep loggen
  }

  // ── Ophangen ─────────────────────────────────────────────────────────────
  function handleEnd() {
    const toUid = incoming?.from || active?.toUid;
    if (toUid) endCall(toUid);
    cleanup();
    onEnd?.();
    onClose?.();
  }

  function startTimer() {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
  }

  function cleanup() {
    clearInterval(timerRef.current);
    clearTimeout(closeTimeoutRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
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

  function formatTimer(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  }

  // Actief gesprek: koppel streams en activeer zodra remoteStream beschikbaar is
  useEffect(() => {
    if (active?.localStream) {
      localStreamRef.current = active.localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = active.localStream;
    }
    if (active?.remoteStream) {
      remoteStreamRef.current = active.remoteStream;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = active.remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = active.remoteStream;
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
  }, [active, callState, onClose]);

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

  useEffect(() => () => cleanup(), []);

  // Zodra video-upgrade actief is, zet streams opnieuw op de nieuw-gemounte video-elementen
  useEffect(() => {
    if (!videoUpgraded) return;
    if (localStreamRef.current  && localVideoRef.current)  localVideoRef.current.srcObject  = localStreamRef.current;
    if (remoteStreamRef.current && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
    if (remoteStreamRef.current && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStreamRef.current;
  }, [videoUpgraded]);

  const isVideo   = incoming?.isVideo || active?.isVideo || videoUpgraded;
  const callName  = incoming?.callerName || active?.name || 'Contactpersoon';

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
      <audio ref={remoteAudioRef} autoPlay />

      {/* ── VIDEO STREAMS ── */}
      {isVideo && (
        <div className="video-container">
          <video ref={remoteVideoRef} className="video-remote" autoPlay playsInline />
          <video ref={localVideoRef}  className="video-local"  autoPlay playsInline muted />
        </div>
      )}

      {/* ── CALL CARD ── */}
      <div className={`call-card ${isVideo && callState === 'active' ? 'transparent' : ''}`}>
        {canMinimize && (
          <button type="button" className="call-minimize-btn" aria-label="Minimaliseer gesprek" onClick={() => setMinimized(true)} title="Minimaliseren">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        )}
        <button type="button" className="call-close-btn" aria-label="Gespreksscherm sluiten" onClick={() => onClose?.()} title="Sluiten">
          <Cancel size={14} aria-hidden="true" />
        </button>
        <div className="call-avatar-big">{callName.slice(0,2).toUpperCase()}</div>
        <div className="call-name">{callName}</div>

        {callState === 'incoming' && (
          <div className="call-status blink" role="status" aria-live="polite">{isVideo ? <><Video size={14} aria-hidden="true" /> Inkomend videogesprek</> : <><Phone size={14} aria-hidden="true" /> Inkomende oproep</>}</div>
        )}
        {callState === 'calling'     && <div className="call-status blink" role="status" aria-live="polite">Verbinden…</div>}
        {callState === 'connecting'  && <div className="call-status blink" role="status" aria-live="polite">Camera aanzetten…</div>}
        {callState === 'active'      && <div className="call-timer" aria-label={`Gespreksduur ${formatTimer(timer)}`}>{formatTimer(timer)}</div>}
        {videoUpgradeRequest && callState === 'active' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', margin:'10px 0' }}>
            <div style={{ fontSize:'13px', color:'#ccc', display:'flex', alignItems:'center', gap:6 }} role="status" aria-live="polite"><Video size={14} aria-hidden="true" /> {callName} wil videobellen</div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button type="button" className="call-ctrl-btn decline" onClick={() => setVideoUpgradeRequest(false)}><Cancel size={18} aria-hidden="true" /><span>Weigeren</span></button>
              <button type="button" className="call-ctrl-btn accept" onClick={handleAcceptVideoUpgrade}><Video size={18} aria-hidden="true" /><span>Accepteren</span></button>
            </div>
          </div>
        )}
        {callState === 'ended'       && <div className="call-status call-status-error" role="status" aria-live="assertive">{callMsg}</div>}

        {/* ── KNOPPEN ── */}
        {callState !== 'ended' && <div className="call-controls">
          {callState === 'incoming' ? (
            <>
              <button type="button" className="call-ctrl-btn accept"  onClick={handleAccept}><Phone size={18} aria-hidden="true" /><span>Opnemen</span></button>
              <button type="button" className="call-ctrl-btn decline" onClick={handleDecline}><Cancel size={18} aria-hidden="true" /><span>Weigeren</span></button>
            </>
          ) : (
            <>
              <button type="button" className={`call-ctrl-btn mute ${muted ? 'on' : ''}`} aria-pressed={muted} onClick={toggleMute}>
                {muted ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}<span>{muted ? 'Dempen uit' : 'Dempen'}</span>
              </button>
              {isVideo && (
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
    </div>
  );
}
