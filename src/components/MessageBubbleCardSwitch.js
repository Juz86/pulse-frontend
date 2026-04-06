import React from 'react';
import MessageBubbleCardRenderer from './MessageBubbleCardRenderer';
import useMessageBubbleCardPresentation from './useMessageBubbleCardPresentation';

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
  const card = useMessageBubbleCardPresentation({
    msg,
    isOwn,
    isFocused,
    isGroup,
    memberNames,
    currentUid,
    user,
    chatSearch,
  });

  return (
    <MessageBubbleCardRenderer
      card={card}
      msg={msg}
      isOwn={isOwn}
      onReact={onReact}
      onShowContextMenu={onShowContextMenu}
      onRetry={onRetry}
      onStartCall={onStartCall}
      onViewContact={onViewContact}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onActionCardKeyDown={onActionCardKeyDown}
    />
  );
}
