import React from 'react';
import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import MessageBubbleGroup from './MessageBubbleGroup';
import SharedContactMessageCard from './SharedContactMessageCard';
import StandardMessageBubble from './StandardMessageBubble';
import SystemMessageNote from './SystemMessageNote';
import { deriveCallMessagePresentation } from './callMessageHelpers';
import {
  buildTextMessageCardPresentation,
} from './messageBubbleHelpers';
import useAttachmentMessageRuntime from './useAttachmentMessageRuntime';

export default function MessageBubbleCardSwitch({
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
  onContextMenu,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onActionCardKeyDown,
}) {
  const attachmentRuntime = useAttachmentMessageRuntime({
    messageAttachment: msg.type === 'attachment' ? msg.attachment : null,
    messageId: msg.id,
    user,
    isOwn,
  });

  if (msg.type === 'system') {
    return <SystemMessageNote text={msg.text} />;
  }

  if (msg.type === 'attachment') {
    return (
      <MessageBubbleGroup isOwn={isOwn}>
        <AttachmentMessageCard
          presentation={attachmentRuntime.presentation}
          createdAt={msg.createdAt}
        />
      </MessageBubbleGroup>
    );
  }

  if (msg.type === 'contact') {
    const sc = msg.sharedContact;
    if (!sc?.uid && !sc?.name) return null;
    const contactPresentation = {
      contact: sc,
      isOwn,
      createdAt: msg.createdAt,
    };

    return (
      <MessageBubbleGroup isOwn={isOwn}>
        <SharedContactMessageCard
          presentation={contactPresentation}
          onViewContact={onViewContact}
          onActionCardKeyDown={onActionCardKeyDown}
        />
      </MessageBubbleGroup>
    );
  }

  if (msg.type === 'call') {
    const callPresentation = {
      ...deriveCallMessagePresentation(msg, isOwn),
      isOwn,
      isFocused,
    };

    return (
      <CallMessageCard
        presentation={callPresentation}
        onStartCall={onStartCall}
        onActionCardKeyDown={onActionCardKeyDown}
        createdAt={msg.createdAt}
      />
    );
  }

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
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onRetry={onRetry}
      onReact={onReact}
      onShowContextMenu={onShowContextMenu}
    />
  );
}
