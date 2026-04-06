import React from 'react';
import { Phone, Video } from '../components/Icons';
import { formatTime } from '../utils';

export default function CallMessageCard({
  presentation,
  onStartCall,
  onActionCardKeyDown,
}) {
  const {
    isOwn,
    isFocused,
    isMissed,
    isVideo,
    callLabel,
    callSub,
    callCardLabel,
    iconType,
    createdAt,
  } = presentation;

  return (
    <div
      className={`msg-group ${isOwn ? 'out' : 'in'}`}
      role="listitem"
      ref={isFocused ? el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
    >
      <div
        className={`msg-call-card ${isOwn ? 'out' : 'in'}${isMissed ? ' missed' : ''}`}
        role={isMissed ? 'button' : undefined}
        tabIndex={isMissed ? 0 : undefined}
        aria-label={isMissed ? callCardLabel : undefined}
        onClick={isMissed ? () => onStartCall(isVideo) : undefined}
        onKeyDown={isMissed ? (event) => onActionCardKeyDown(event, () => onStartCall(isVideo)) : undefined}
        style={isMissed ? { cursor: 'pointer' } : undefined}
      >
        <div className={`msg-call-icon ${iconType}`} aria-hidden="true">
          {isVideo ? <Video size={20} aria-hidden="true" /> : <Phone size={20} aria-hidden="true" />}
        </div>
        <div className="msg-call-info">
          <div className="msg-call-label">{callLabel}</div>
          {callSub && <div className="msg-call-sub">{callSub}</div>}
        </div>
        <div className="msg-call-time">{formatTime(createdAt)}</div>
      </div>
    </div>
  );
}
