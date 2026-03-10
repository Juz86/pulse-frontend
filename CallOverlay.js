// src/components/CallOverlay.js
import React, { useEffect, useRef, useState } from 'react';
import { answerCall, declineCall, endCall } from '../services/socket';

export default function CallOverlay({ incoming, active, user, onClose, onEnd }) {
  const [callState,    setCallState]    = useState(incoming ? 'incoming' : 'calling');
  const [timer,        setTimer]        = useState(0);
  const [muted,        setMuted]        = useState(false);
  const [camOff,       setCamOff]       = useState(false);

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const timerRef       = useRef(null);
  const localStreamRef = useRef(null);

  // ── Inkomend gesprek beantwoorden ────────────────────────────────────────
  async function handleAccept() {
    setCallState('connecting');
    try {
      const localStream = await answerCall({
        fromUid:  incoming.from,
        offer:    incoming.offer,
        isVideo:  incoming.isVideo,
        onStream: (remoteStream, localStream) => {
          localStreamRef.current = localStream;
          if (localVideoRef.current)  localVideoRef.current.srcObject  = localStream;
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          setCallState('active');
          startTimer();
        },
        onEnd: () => { cleanup(); onClose?.(); },
      });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    } catch (e) {
      alert('Kan geen toegang krijgen tot microfoon/camera.');
      onClose?.();
    }
  }

  // ── Weigeren ─────────────────────────────────────────────────────────────
  function handleDecline() {
    declineCall(incoming?.from);
    cleanup();
    onClose?.();
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

  function formatTimer(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  }

  // Actief gesprek: koppel streams
  useEffect(() => {
    if (active?.localStream  && localVideoRef.current)  localVideoRef.current.srcObject  = active.localStream;
    if (active?.remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = active.remoteStream;
    if (active && callState === 'calling') {
      setTimeout(() => { setCallState('active'); startTimer(); }, 2000);
    }
  }, [active]);

  useEffect(() => () => cleanup(), []);

  const isVideo   = incoming?.isVideo || active?.isVideo;
  const callName  = incoming?.callerName || active?.name || 'Contactpersoon';

  return (
    <div className={`call-overlay ${isVideo && callState === 'active' ? 'video-mode' : ''}`}>

      {/* ── VIDEO STREAMS ── */}
      {isVideo && (
        <div className="video-container">
          <video ref={remoteVideoRef} className="video-remote" autoPlay playsInline />
          <video ref={localVideoRef}  className="video-local"  autoPlay playsInline muted />
        </div>
      )}

      {/* ── CALL CARD ── */}
      <div className={`call-card ${isVideo && callState === 'active' ? 'transparent' : ''}`}>
        <div className="call-avatar-big">{callName.slice(0,2).toUpperCase()}</div>
        <div className="call-name">{callName}</div>

        {callState === 'incoming' && (
          <div className="call-status blink">{isVideo ? '📹 Inkomend videogesprek' : '📞 Inkomende oproep'}</div>
        )}
        {callState === 'calling'     && <div className="call-status blink">Verbinden…</div>}
        {callState === 'connecting'  && <div className="call-status blink">Camera aanzetten…</div>}
        {callState === 'active'      && <div className="call-timer">{formatTimer(timer)}</div>}

        {/* ── KNOPPEN ── */}
        <div className="call-controls">
          {callState === 'incoming' ? (
            <>
              <button className="call-ctrl-btn decline" onClick={handleDecline}>📵<span>Weigeren</span></button>
              <button className="call-ctrl-btn accept"  onClick={handleAccept}>📞<span>Opnemen</span></button>
            </>
          ) : (
            <>
              <button className={`call-ctrl-btn mute ${muted ? 'on' : ''}`} onClick={toggleMute}>
                {muted ? '🔇' : '🎤'}<span>{muted ? 'Dempen uit' : 'Dempen'}</span>
              </button>
              {isVideo && (
                <button className={`call-ctrl-btn cam ${camOff ? 'on' : ''}`} onClick={toggleCam}>
                  {camOff ? '📵' : '📷'}<span>Camera</span>
                </button>
              )}
              <button className="call-ctrl-btn end" onClick={handleEnd}>📵<span>Ophangen</span></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
