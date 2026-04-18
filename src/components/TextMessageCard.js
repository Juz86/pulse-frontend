import React from 'react';
import { Check, CheckDouble, Clock, ErrorIcon } from '../components/Icons';
import MessageBubbleActions from './MessageBubbleActions';
import { formatTime } from '../utils';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';

export default function TextMessageCard({
  msg,
  isOwn,
  isFocused,
  renderedContent,
  status,
  receiptSummaryLabel,
  onRetry,
  onReact,
  onShowContextMenu,
}) {
  return (
    <div className="msg-bubble-wrap">
      {msg.replyTo && (
        <div className="msg-reply-quote" aria-label={`Antwoord op bericht van ${msg.replyTo.senderName}`}>
          <span className="msg-reply-name">{msg.replyTo.senderName}</span>
          <span className="msg-reply-text">{getMessageDisplayText(msg.replyTo)}</span>
        </div>
      )}
      <div className="msg-bubble" style={isFocused ? { outline: '2px solid #f59e0b', outlineOffset: '2px' } : {}}>
        <button
          type="button"
          className="msg-bubble-menu-btn"
          aria-label="Berichtopties"
          onClick={(e) => { e.stopPropagation(); onShowContextMenu(e); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        <span className="msg-bubble-text">
          {renderedContent}
          {msg.editedAt && <span className="msg-edited" aria-label="Bewerkt"><span aria-hidden="true">(bewerkt)</span></span>}
        </span>
        <span className="msg-time">
          {formatTime(msg.createdAt)}
          {isOwn && status && (
            status.failed
              ? (
                <button
                  type="button"
                  className="msg-ticks failed"
                  onClick={onRetry}
                  title="Opnieuw versturen"
                  aria-label="Bericht niet verzonden, probeer opnieuw"
                >
                  <span className="msg-ticks-label">Niet verzonden.</span>
                  <span aria-hidden="true"><ErrorIcon size={12} /></span>
                </button>
              ) : (
                <span className={`msg-ticks${status.read ? ' read' : ''}`} aria-label={`Bericht ${status.label}`}>
                  <span className="msg-ticks-label">{status.label}</span>
                  {status.icon === 'clock'
                    ? <span className={msg._retrying ? 'msg-clock-spin' : ''} aria-hidden="true"><Clock size={11} /></span>
                    : status.icon === 'double'
                      ? <span aria-hidden="true"><CheckDouble size={11} /></span>
                      : <span aria-hidden="true"><Check size={11} /></span>}
                </span>
              )
          )}
        </span>
      </div>
      {receiptSummaryLabel && (
        <div
          className="msg-group-receipt-summary"
          style={{
            marginTop: 4,
            fontSize: 11,
            color: isOwn ? 'rgba(255,255,255,.62)' : 'var(--text3)',
            textAlign: isOwn ? 'right' : 'left',
          }}
        >
          {receiptSummaryLabel}
        </div>
      )}
      <MessageBubbleActions
        onReact={onReact}
      />
    </div>
  );
}
