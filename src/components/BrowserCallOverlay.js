import React, { useEffect, useRef, useState } from 'react';
import { Cancel, Mic, MicOff, Phone, PhoneEnd, Speaker, Video, VideoOff } from './Icons';
import PulseLogo from './PulseLogo';
import UserAvatar from './UserAvatar';

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function callStatus(call, elapsed) {
  if (call.serverState === 'ACTIVE') return formatDuration(elapsed);
  if (call.serverState === 'CONNECTING') return 'Verbinden...';
  if (call.serverState === 'RINGING') {
    return call.direction === 'incoming'
      ? `Inkomende ${call.mediaType === 'video' ? 'video-oproep' : 'spraakoproep'}`
      : 'Gaat over...';
  }
  if (call.serverState === 'ENDED') {
    if (call.terminalReason === 'declined') return 'Oproep geweigerd';
    if (call.terminalReason === 'missed') return 'Gemiste oproep';
    if (call.terminalReason === 'taken_elsewhere') return 'Op ander apparaat beantwoord';
    if (call.terminalReason === 'signaling_error') return 'Niet bereikbaar';
    return 'Oproep beëindigd';
  }
  return 'Bellen...';
}

function AudioElement({ stream }) {
  const setElement = (element) => {
    if (!element || !stream) return;
    element.srcObject = stream;
    element.play().catch(() => {});
  };
  return <audio ref={setElement} autoPlay playsInline aria-hidden="true" />;
}

function VideoElement({ stream, className, muted = false, label }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return undefined;
    element.srcObject = stream || null;
    if (stream) element.play().catch(() => {});
    return () => {
      if (element.srcObject === stream) element.srcObject = null;
    };
  }, [stream]);
  return <video ref={videoRef} className={className} autoPlay playsInline muted={muted} aria-label={label} />;
}

function ControlButton({ icon: Icon, label, active = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      className={`browser-call-control${active ? ' browser-call-control--active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
    >
      <span><Icon size={26} aria-hidden="true" /></span>
      <small>{label}</small>
    </button>
  );
}

export default function BrowserCallOverlay({
  call,
  localStream,
  remoteStream,
  onAnswer,
  onDecline,
  onHangup,
  onToggleMute,
  onToggleVideo,
  onDismiss,
}) {
  const [elapsed, setElapsed] = useState(0);
  const [panelMode, setPanelMode] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(min-width: 900px)').matches
  ));
  const visible = call?.status === 'call';

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(min-width: 900px)');
    const updatePanelMode = () => setPanelMode(mediaQuery.matches);
    updatePanelMode();
    mediaQuery.addEventListener?.('change', updatePanelMode);
    return () => mediaQuery.removeEventListener?.('change', updatePanelMode);
  }, []);

  useEffect(() => {
    if (!visible || call.serverState !== 'ACTIVE' || !call.activeSince) {
      setElapsed(0);
      return undefined;
    }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - call.activeSince) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [call.activeSince, call.serverState, visible]);

  if (!visible) return null;
  const incoming = call.direction === 'incoming' && call.serverState === 'RINGING';
  const ended = call.serverState === 'ENDED';
  const activeControls = ['CONNECTING', 'ACTIVE'].includes(call.serverState);
  const isVideoCall = call.mediaType === 'video';

  return (
    <section
      className={`browser-call-overlay${panelMode ? ' browser-call-overlay--panel' : ''}`}
      role={panelMode ? 'complementary' : 'dialog'}
      aria-modal={panelMode ? undefined : true}
      aria-label="Pulse-oproep"
    >
      {call.photoURL && (
        <img
          className="browser-call-background"
          src={call.photoURL}
          alt=""
          aria-hidden="true"
        />
      )}
      <div className="browser-call-shade" aria-hidden="true" />
      {isVideoCall && (
        <div className="browser-call-video-stage">
          <VideoElement
            stream={remoteStream}
            className="browser-call-remote-video"
            label={`Videobeeld van ${call.displayName}`}
          />
          {localStream && call.isVideoEnabled && (
            <VideoElement
              stream={localStream}
              className="browser-call-local-video"
              muted
              label="Je eigen videobeeld"
            />
          )}
        </div>
      )}
      <div className="browser-call-content">
        <header className="browser-call-brand">
          <PulseLogo size={28} textSize={18} color="#ffffff" gap={8} />
          <span>End-to-end versleuteld</span>
        </header>

        <main className={`browser-call-contact${isVideoCall ? ' browser-call-contact--video' : ''}${isVideoCall && remoteStream ? ' browser-call-contact--connected-video' : ''}`}>
          {(!isVideoCall || !remoteStream) && (
            <>
              <UserAvatar
                photoURL={call.photoURL}
                displayName={call.displayName}
                className="browser-call-avatar"
                decorative
              />
              <h2>{call.displayName}</h2>
            </>
          )}
          <p>{callStatus(call, elapsed)}</p>
        </main>

        <footer className="browser-call-actions">
          {incoming ? (
            <div className="browser-call-incoming-actions">
              <button type="button" className="browser-call-action browser-call-action--reject" onClick={onDecline}>
                <span><PhoneEnd size={30} aria-hidden="true" /></span>
                <small>Weigeren</small>
              </button>
              <button type="button" className="browser-call-action browser-call-action--accept" onClick={onAnswer}>
                <span><Phone size={30} aria-hidden="true" /></span>
                <small>Accepteren</small>
              </button>
            </div>
          ) : ended ? (
            <button type="button" className="browser-call-action browser-call-action--close" onClick={onDismiss}>
              <span><Cancel size={30} aria-hidden="true" /></span>
              <small>Sluiten</small>
            </button>
          ) : (
            <>
              <div className="browser-call-controls">
                <ControlButton
                  icon={call.isMuted ? MicOff : Mic}
                  label={call.isMuted ? 'Gedempt' : 'Dempen'}
                  active={call.isMuted}
                  disabled={!activeControls}
                  onClick={onToggleMute}
                />
                <ControlButton
                  icon={call.isVideoEnabled ? Video : VideoOff}
                  label={call.isVideoEnabled ? 'Camera uit' : 'Camera aan'}
                  active={isVideoCall && !call.isVideoEnabled}
                  disabled={!isVideoCall || !activeControls}
                  onClick={onToggleVideo}
                />
                <ControlButton icon={Speaker} label="Systeemaudio" disabled />
              </div>
              <button type="button" className="browser-call-action browser-call-action--reject" onClick={onHangup}>
                <span><PhoneEnd size={32} aria-hidden="true" /></span>
                <small>Ophangen</small>
              </button>
            </>
          )}
        </footer>
      </div>
      {!isVideoCall && <AudioElement stream={remoteStream} />}
    </section>
  );
}
