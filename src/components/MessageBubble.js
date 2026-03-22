// src/components/MessageBubble.js
import React, { useRef, useState, useEffect } from 'react';
import { Phone, Video, Check, CheckDouble, Clock, Cancel } from '../components/Icons';
import { getInitials, formatTime } from '../utils';

// ── Helpers (pure, buiten component voor stabiele referentie) ─────────────────

function getMsgStatusInfo(msg) {
  if (msg.failed)  return { icon: 'cancel', label: 'Mislukt', failed: true };
  if (msg.pending) return { icon: 'clock',  label: 'verstuurd', failed: false };
  if (msg.status === 'gelezen') return { icon: 'double', label: 'gelezen', read: true };
  if (msg.status === 'bezorgd') return { icon: 'double', label: 'bezorgd', read: false };
  return { icon: 'check', label: 'verstuurd', failed: false };
}

function renderMsgText(text, mentions, memberNames) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && mentions?.length) {
      const name    = part.slice(1).replace(/[^\w\s]/g, '');
      const matched = mentions.find(uid => (memberNames?.[uid] || '').toLowerCase() === name.toLowerCase());
      if (matched) return <span key={i} className="mention-tag">{part}</span>;
    }
    return part;
  });
}

function highlightText(text, query) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: '#f59e0b', color: '#000', borderRadius: '2px', padding: '0 1px' }}>{p}</mark>
      : p
  );
}

const QUICK_EMOJI = ['❤️', '👍', '😂', '😮', '😢', '👎'];

// ── MessageBubble ─────────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({
  msg,
  isOwn,
  isFocused,
  isGroup,
  memberNames,
  currentUid,
  chatSearch,
  onReact,
  onShowContextMenu,
  onRetry,
  onStartCall,
  onViewContact,
}) {
  const longPressTimer    = useRef(null);
  const longPressFired    = useRef(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const close = () => setEmojiPickerOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [emojiPickerOpen]);

  function handleTouchStart(e) {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      const touch = e.touches[0];
      onShowContextMenu({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
    }, 500);
  }
  function handleTouchEnd(e) {
    clearTimeout(longPressTimer.current);
    if (longPressFired.current) e.preventDefault();
  }
  function handleContextMenu(e) {
    e.preventDefault();
    onShowContextMenu(e);
  }
  // ── Gedeeld contactkaart bericht ─────────────────────────────────────────
  if (msg.type === 'contact') {
    const sc = msg.sharedContact;
    if (!sc?.uid && !sc?.name) return null;
    return (
      <div className={`msg-group ${isOwn ? 'out' : 'in'}`}>
        <div
          className="msg-contact-card"
          style={{ cursor: isOwn ? 'default' : 'pointer' }}
          onClick={!isOwn ? () => onViewContact(sc) : undefined}
        >
          <div className="avatar-circle sm u-flex-shrink" style={{ borderRadius: 12 }}>{getInitials(sc?.name || '')}</div>
          <div className="u-flex-1 u-min-w-0">
            <div className="u-fw-600 u-fs-14 u-ellipsis">{sc?.name || 'Contactpersoon'}</div>
            {sc?.email && (
              <div className="u-fs-12 u-ellipsis" style={{ color: isOwn ? 'rgba(255,255,255,.65)' : 'var(--text3)' }}>
                {sc.email}
              </div>
            )}
          </div>
          <div className="u-flex-shrink" style={{ fontSize: '11px', color: isOwn ? 'rgba(255,255,255,.5)' : 'var(--text3)', alignSelf: 'flex-end' }}>
            {formatTime(msg.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  // ── Oproep bericht ────────────────────────────────────────────────────────
  if (msg.type === 'call') {
    const isMissed    = !isOwn && (msg.direction === 'no-answer' || msg.direction === 'declined');
    const durSec      = msg.duration || 0;
    const durationStr = durSec > 0 ? (durSec >= 60 ? `${Math.floor(durSec / 60)} min` : `${durSec} sec`) : '';
    const callLabel   = isOwn
      ? (msg.direction === 'completed' ? (msg.isVideo ? 'Video-oproep' : 'Spraakoproep') : msg.direction === 'declined' ? 'Geweigerd' : 'Geen antwoord')
      : (isMissed ? (msg.isVideo ? 'Gemiste video-oproep' : 'Gemiste spraakoproep') : (msg.isVideo ? 'Video-oproep' : 'Spraakoproep'));
    const callSub     = durationStr || (isMissed ? 'Tik om terug te bellen' : '');
    const iconType    = isMissed ? 'missed' : isOwn ? 'outgoing' : 'incoming';
    return (
      <div
        className={`msg-group ${isOwn ? 'out' : 'in'}`}
        ref={isFocused ? el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
      >
        <div
          className={`msg-call-card ${isOwn ? 'out' : 'in'}${isMissed ? ' missed' : ''}`}
          onClick={isMissed ? () => onStartCall(msg.isVideo) : undefined}
          style={isMissed ? { cursor: 'pointer' } : undefined}
        >
          <div className={`msg-call-icon ${iconType}`}>
            {msg.isVideo ? <Video size={20} /> : <Phone size={20} />}
          </div>
          <div className="msg-call-info">
            <div className="msg-call-label">{callLabel}</div>
            {callSub && <div className="msg-call-sub">{callSub}</div>}
          </div>
          <div className="msg-call-time">{formatTime(msg.createdAt)}</div>
        </div>
      </div>
    );
  }

  // ── Standaard tekst bericht ───────────────────────────────────────────────
  const status = isOwn ? getMsgStatusInfo(msg) : null;

  return (
    <div
      className={`msg-group ${isOwn ? 'out' : 'in'}`}
      ref={isFocused ? el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={() => clearTimeout(longPressTimer.current)}
    >
      {!isOwn && isGroup && <div className="msg-sender">{msg.senderName}</div>}
      <div className="msg-bubble-wrap">
        {msg.replyTo && (
          <div className="msg-reply-quote">
            <span className="msg-reply-name">{msg.replyTo.senderName}</span>
            <span className="msg-reply-text">{msg.replyTo.text}</span>
          </div>
        )}
        <div className="msg-bubble" style={isFocused ? { outline: '2px solid #f59e0b', outlineOffset: '2px' } : {}}>
          {chatSearch.trim()
            ? highlightText(msg.text || '', chatSearch)
            : renderMsgText(msg.text || '', msg.mentions, memberNames)}
          {msg.editedAt && <span className="msg-edited">(bewerkt)</span>}
        </div>

        {/* Acties (zichtbaar bij hover) */}
        <div className="msg-actions" onClick={e => e.stopPropagation()}>
          <div style={{ position: 'relative' }}>
            <button
              className="msg-action-btn"
              aria-label="Reageren"
              onClick={e => { e.stopPropagation(); setEmojiPickerOpen(v => !v); }}
            >😊</button>
            {emojiPickerOpen && (
              <div className="msg-emoji-picker">
                {QUICK_EMOJI.map(emoji => (
                  <button key={emoji} onClick={() => { onReact(emoji); setEmojiPickerOpen(false); }}>{emoji}</button>
                ))}
              </div>
            )}
          </div>
          <button
            className="msg-action-btn"
            aria-label="Berichtopties"
            onClick={e => { e.stopPropagation(); onShowContextMenu(e); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Reacties */}
      {msg.reactions && Object.entries(msg.reactions).some(([, uids]) => uids?.length > 0) && (
        <div className="msg-reactions">
          {Object.entries(msg.reactions)
            .filter(([, uids]) => uids?.length > 0)
            .map(([emoji, uids]) => (
              <button
                key={emoji}
                className={`msg-reaction-pill${uids.includes(currentUid) ? ' mine' : ''}`}
                onClick={() => onReact(emoji)}
              >
                {emoji}{uids.length > 1 && <span>{uids.length}</span>}
              </button>
            ))}
        </div>
      )}

      {/* Tijd + status */}
      <div className="msg-time">
        {formatTime(msg.createdAt)}
        {isOwn && status && (
          status.failed
            ? (
              <span className="msg-ticks failed" onClick={onRetry} title="Opnieuw versturen">
                <span className="msg-ticks-label">Mislukt · Opnieuw</span><Cancel size={12} />
              </span>
            ) : (
              <span className={`msg-ticks${status.read ? ' read' : ''}`}>
                <span className="msg-ticks-label">{status.label}</span>
                {status.icon === 'clock' ? <Clock size={12} /> : status.icon === 'double' ? <CheckDouble size={12} /> : <Check size={12} />}
              </span>
            )
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
