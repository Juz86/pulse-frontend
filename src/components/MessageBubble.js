// src/components/MessageBubble.js
import React, { useRef, useState, useEffect } from 'react';
import { Check, CheckDouble, Clock, ErrorIcon } from '../components/Icons';
import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import MessageBubbleActions from './MessageBubbleActions';
import MessageReactionBar from './MessageReactionBar';
import SharedContactMessageCard from './SharedContactMessageCard';
import SystemMessageNote from './SystemMessageNote';
import {
  createAttachmentMessageActionRuntime,
  getInitialAttachmentActionState,
} from '../lib/e2ee/attachmentAccessAdapter';
import {
  buildAttachmentMessageCardPresentation,
} from '../lib/e2ee/attachmentPresentation';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';
import { formatTime } from '../utils';

// ── Helpers (pure, buiten component voor stabiele referentie) ─────────────────

function getMsgStatusInfo(msg) {
  if (msg.failed)  return { icon: 'cancel', label: 'Mislukt', failed: true };
  if (msg.pending) return { icon: 'clock',  label: 'verstuurd', failed: false };
  if (msg.deliveryState === 'read') return { icon: 'double', label: 'gelezen', read: true };
  if (msg.deliveryState === 'delivered') return { icon: 'double', label: 'bezorgd', read: false };
  if (msg.deliveryState === 'failed') return { icon: 'cancel', label: 'Mislukt', failed: true };
  if (msg.deliveryState === 'sending') return { icon: 'clock', label: 'verstuurd', failed: false };
  if (msg.status === 'gelezen') return { icon: 'double', label: 'gelezen', read: true };
  if (msg.status === 'bezorgd') return { icon: 'double', label: 'bezorgd', read: false };
  return { icon: 'check', label: 'verstuurd', failed: false };
}

function getReceiptSummaryLabel(msg, isGroup) {
  if (!isGroup || !msg?.receiptSummary || !msg?.isOwn) return '';

  const {
    recipientCount = 0,
    deliveredCount = 0,
    readCount = 0,
  } = msg.receiptSummary;

  if (!recipientCount) return '';
  if (readCount > 0) return `gelezen door ${readCount}/${recipientCount}`;
  if (deliveredCount > 0) return `bezorgd bij ${deliveredCount}/${recipientCount}`;
  return '';
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

// ── MessageBubble ─────────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({
  msg,
  isOwn,
  isFocused,
  isGroup,
  memberNames,
  currentUid,
  user,
  chatSearch,
  onReact,
  onShowContextMenu,
  onRetry,
  onStartCall,
  onViewContact,
}) {
  const longPressTimer    = useRef(null);
  const longPressFired    = useRef(false);
  const [resolvedAttachment, setResolvedAttachment] = useState(null);
  const [resolvedAttachmentAccess, setResolvedAttachmentAccess] = useState(null);
  const [attachmentActionError, setAttachmentActionError] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  useEffect(() => {
    const initialActionState = getInitialAttachmentActionState();
    setResolvedAttachment(initialActionState.resolvedAttachment);
    setResolvedAttachmentAccess(initialActionState.resolvedAttachmentAccess);
    setAttachmentActionError(initialActionState.attachmentActionError);
    setAttachmentBusy(initialActionState.attachmentBusy);
  }, [msg.id]);

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

  function handleActionCardKeyDown(event, action) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }

  if (msg.type === 'system') {
    return <SystemMessageNote text={msg.text} />;
  }

  if (msg.type === 'attachment') {
    const { runAttachmentAction } = createAttachmentMessageActionRuntime(
      msg.attachment,
      resolvedAttachment,
      user,
      {
      setAttachmentBusy,
      setResolvedAttachment,
        setResolvedAttachmentAccess,
      setAttachmentActionError,
      }
    );
    const attachmentCardPresentation = buildAttachmentMessageCardPresentation(
      msg.attachment,
      resolvedAttachment,
      resolvedAttachmentAccess,
      {
        busy: attachmentBusy,
        isOwn,
        actionError: attachmentActionError,
        onOpen: () => runAttachmentAction('open'),
        onAction: runAttachmentAction,
      }
    );

    return (
      <div className={`msg-group ${isOwn ? 'out' : 'in'}`} role="listitem">
        <AttachmentMessageCard
          presentation={attachmentCardPresentation}
          createdAt={msg.createdAt}
        />
      </div>
    );
  }

  // ── Gedeeld contactkaart bericht ─────────────────────────────────────────
  if (msg.type === 'contact') {
    const sc = msg.sharedContact;
    if (!sc?.uid && !sc?.name) return null;
    return (
      <div className={`msg-group ${isOwn ? 'out' : 'in'}`} role="listitem">
        <SharedContactMessageCard
          contact={sc}
          isOwn={isOwn}
          onViewContact={onViewContact}
          onActionCardKeyDown={handleActionCardKeyDown}
          createdAt={msg.createdAt}
        />
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
    const callCardLabel = isMissed
      ? `${callLabel}. Activeer om terug te bellen`
      : callSub ? `${callLabel}. ${callSub}` : callLabel;
    return (
      <CallMessageCard
        isOwn={isOwn}
        isFocused={isFocused}
        isMissed={isMissed}
        isVideo={msg.isVideo}
        callLabel={callLabel}
        callSub={callSub}
        callCardLabel={callCardLabel}
        iconType={iconType}
        onStartCall={onStartCall}
        onActionCardKeyDown={handleActionCardKeyDown}
        createdAt={msg.createdAt}
      />
    );
  }

  // ── Standaard tekst bericht ───────────────────────────────────────────────
  const status = isOwn ? getMsgStatusInfo(msg) : null;
  const displayText = getMessageDisplayText(msg);
  const receiptSummaryLabel = getReceiptSummaryLabel(msg, isGroup);

  return (
    <div
      className={`msg-group ${isOwn ? 'out' : 'in'}`}
      role="listitem"
      ref={isFocused ? el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={() => clearTimeout(longPressTimer.current)}
    >
      {!isOwn && isGroup && <div className="msg-sender">{msg.senderName}</div>}
      <div className="msg-bubble-wrap">
        {msg.replyTo && (
          <div className="msg-reply-quote" aria-label={`Antwoord op bericht van ${msg.replyTo.senderName}`}>
            <span className="msg-reply-name">{msg.replyTo.senderName}</span>
            <span className="msg-reply-text">{msg.replyTo.text}</span>
          </div>
        )}
        <div className="msg-bubble" style={isFocused ? { outline: '2px solid #f59e0b', outlineOffset: '2px' } : {}}>
          <span className="msg-bubble-text">
            {chatSearch.trim()
              ? highlightText(displayText, chatSearch)
              : renderMsgText(displayText, msg.mentions, memberNames)}
            {msg.editedAt && <span className="msg-edited" aria-label="Bewerkt"><span aria-hidden="true">(bewerkt)</span></span>}
          </span>
          {/* Tijd + status binnen de bubble */}
          <span className="msg-time">
            {formatTime(msg.createdAt)}
            {isOwn && status && (
              status.failed
                ? (
                  <button type="button" className="msg-ticks failed" onClick={onRetry} title="Opnieuw versturen" aria-label="Bericht niet verzonden, probeer opnieuw">
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
          onShowContextMenu={onShowContextMenu}
        />
      </div>

      <MessageReactionBar
        reactions={msg.reactions}
        currentUid={currentUid}
        onReact={onReact}
      />

    </div>
  );
});

export default MessageBubble;
