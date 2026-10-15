import React from 'react';
import { PhoneEnd, PhoneMissed, PhoneOutgoing, Video } from './Icons';
import { formatTime } from '../utils';

export default function CallMessageCard({ presentation, onCallBack }) {
  const missed = presentation.kind === 'missed_incoming';
  const declined = presentation.kind?.endsWith('_declined');
  const negative = missed || declined;
  const CallIcon = presentation.isVideo
    ? Video
    : missed
      ? PhoneMissed
      : declined
        ? PhoneEnd
        : PhoneOutgoing;

  return (
    <button
      type="button"
      className={`msg-call-card${negative ? ' msg-call-card--negative' : ''}`}
      onClick={onCallBack}
      disabled={!onCallBack}
      aria-label={`${presentation.title}. ${presentation.subtitle}`}
    >
      <span className="msg-call-card-icon" aria-hidden="true">
        <CallIcon size={24} />
      </span>
      <span className="msg-call-card-copy">
        <strong>{presentation.title}</strong>
        <span>{presentation.subtitle}</span>
      </span>
      <time className="msg-call-card-time" dateTime={presentation.createdAt || undefined}>
        {formatTime(presentation.createdAt)}
      </time>
    </button>
  );
}
