import React from 'react';
import { Phone, Video } from '../components/Icons';
import { formatTime } from '../utils';
import SoftMessageBubble from './SoftMessageBubble';

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
  const canRestartCall = isMissed && typeof onStartCall === 'function';

  return (
    <div
      className={`msg-group ${isOwn ? 'out' : 'in'}`}
      role="listitem"
      ref={isFocused ? el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
    >
      <div
        className={`msg-call-card ${isOwn ? 'out' : 'in'}${isMissed ? ' missed' : ''}`}
        role={canRestartCall ? 'button' : undefined}
        tabIndex={canRestartCall ? 0 : undefined}
        aria-label={canRestartCall ? callCardLabel : undefined}
        onClick={canRestartCall ? () => onStartCall(isVideo) : undefined}
        onKeyDown={canRestartCall ? (event) => onActionCardKeyDown(event, () => onStartCall(isVideo)) : undefined}
        style={canRestartCall ? { cursor: 'pointer' } : undefined}
      >
        <SoftMessageBubble
          isOwn={isOwn}
          className={`msg-call-card-shell${isMissed ? ' msg-call-card-shell--missed' : ''}`}
        >
          <div className={`msg-call-icon ${iconType}`} aria-hidden="true">
            {isVideo ? <Video size={20} aria-hidden="true" /> : <Phone size={20} aria-hidden="true" />}
          </div>
          <div className="msg-call-info">
            <div className="msg-call-label">{callLabel}</div>
            {callSub && <div className="msg-call-sub">{callSub}</div>}
          </div>
          <div className="msg-call-time">{formatTime(createdAt)}</div>
        </SoftMessageBubble>
      </div>
    </div>
  );
}
