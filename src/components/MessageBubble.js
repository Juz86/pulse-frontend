// src/components/MessageBubble.js
import React from 'react';
import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import SharedContactMessageCard from './SharedContactMessageCard';
import StandardMessageBubble from './StandardMessageBubble';
import SystemMessageNote from './SystemMessageNote';
import { deriveCallMessagePresentation } from './callMessageHelpers';
import useAttachmentMessageRuntime from './useAttachmentMessageRuntime';
import useMessageBubbleInteractions from './useMessageBubbleInteractions';
import {
  buildTextMessageCardPresentation,
} from './messageBubbleHelpers';

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
  const attachmentRuntime = useAttachmentMessageRuntime({
    messageAttachment: msg.type === 'attachment' ? msg.attachment : null,
    messageId: msg.id,
    user,
    isOwn,
  });
  const {
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleContextMenu,
    handleActionCardKeyDown,
  } = useMessageBubbleInteractions(onShowContextMenu);

  if (msg.type === 'system') {
    return <SystemMessageNote text={msg.text} />;
  }

  if (msg.type === 'attachment') {
    const attachmentCardPresentation = attachmentRuntime.presentation;

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
    const callPresentation = deriveCallMessagePresentation(msg, isOwn);
    return (
      <CallMessageCard
        isOwn={isOwn}
        isFocused={isFocused}
        isMissed={callPresentation.isMissed}
        isVideo={callPresentation.isVideo}
        callLabel={callPresentation.callLabel}
        callSub={callPresentation.callSub}
        callCardLabel={callPresentation.callCardLabel}
        iconType={callPresentation.iconType}
        onStartCall={onStartCall}
        onActionCardKeyDown={handleActionCardKeyDown}
        createdAt={msg.createdAt}
      />
    );
  }

  // ── Standaard tekst bericht ───────────────────────────────────────────────
  const textCardPresentation = buildTextMessageCardPresentation(msg, {
    isOwn,
    isGroup,
    memberNames,
    chatSearch,
  });

  return (
    <StandardMessageBubble
      msg={msg}
      isOwn={isOwn}
      isFocused={isFocused}
      isGroup={isGroup}
      currentUid={currentUid}
      renderedContent={textCardPresentation.renderedContent}
      status={textCardPresentation.status}
      receiptSummaryLabel={textCardPresentation.receiptSummaryLabel}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onRetry={onRetry}
      onReact={onReact}
      onShowContextMenu={onShowContextMenu}
    />
  );
});

export default MessageBubble;
