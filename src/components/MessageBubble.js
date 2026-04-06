// src/components/MessageBubble.js
import React, { useRef, useState, useEffect } from 'react';
import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import MessageReactionBar from './MessageReactionBar';
import SharedContactMessageCard from './SharedContactMessageCard';
import SystemMessageNote from './SystemMessageNote';
import TextMessageCard from './TextMessageCard';
import {
  getMessageReceiptSummaryLabel,
  getMessageStatusInfo,
  highlightMessageSearch,
  renderMessageTextWithMentions,
} from './messageBubbleHelpers';
import {
  createAttachmentMessageActionRuntime,
  getInitialAttachmentActionState,
} from '../lib/e2ee/attachmentAccessAdapter';
import {
  buildAttachmentMessageCardPresentation,
} from '../lib/e2ee/attachmentPresentation';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';

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
  const status = isOwn ? getMessageStatusInfo(msg) : null;
  const displayText = getMessageDisplayText(msg);
  const receiptSummaryLabel = getMessageReceiptSummaryLabel(msg, isGroup);
  const renderedContent = chatSearch.trim()
    ? highlightMessageSearch(displayText, chatSearch)
    : renderMessageTextWithMentions(displayText, msg.mentions, memberNames);

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
      <TextMessageCard
        msg={msg}
        isOwn={isOwn}
        isFocused={isFocused}
        renderedContent={renderedContent}
        status={status}
        receiptSummaryLabel={receiptSummaryLabel}
        onRetry={onRetry}
        onReact={onReact}
        onShowContextMenu={onShowContextMenu}
      />

      <MessageReactionBar
        reactions={msg.reactions}
        currentUid={currentUid}
        onReact={onReact}
      />

    </div>
  );
});

export default MessageBubble;
