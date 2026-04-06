import React from 'react';
import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import MessageBubbleGroup from './MessageBubbleGroup';
import SharedContactMessageCard from './SharedContactMessageCard';
import StandardMessageBubble from './StandardMessageBubble';
import SystemMessageNote from './SystemMessageNote';

export default function MessageBubbleCardRenderer({
  card,
  msg,
  isOwn,
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
  if (card.type === 'system') {
    return <SystemMessageNote text={card.presentation.text} />;
  }

  if (card.type === 'attachment') {
    return (
      <MessageBubbleGroup isOwn={isOwn}>
        <AttachmentMessageCard
          presentation={card.presentation}
          createdAt={msg.createdAt}
        />
      </MessageBubbleGroup>
    );
  }

  if (card.type === 'contact') {
    if (!card.presentation) return null;

    return (
      <MessageBubbleGroup isOwn={isOwn}>
        <SharedContactMessageCard
          presentation={card.presentation}
          onViewContact={onViewContact}
          onActionCardKeyDown={onActionCardKeyDown}
        />
      </MessageBubbleGroup>
    );
  }

  if (card.type === 'call') {
    return (
      <CallMessageCard
        presentation={card.presentation}
        onStartCall={onStartCall}
        onActionCardKeyDown={onActionCardKeyDown}
        createdAt={msg.createdAt}
      />
    );
  }

  return (
    <StandardMessageBubble
      presentation={card.presentation}
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
