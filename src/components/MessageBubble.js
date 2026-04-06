// src/components/MessageBubble.js
import React from 'react';
import MessageBubbleCardSwitch from './MessageBubbleCardSwitch';
import useMessageBubbleInteractions from './useMessageBubbleInteractions';

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
  const {
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleContextMenu,
    handleActionCardKeyDown,
  } = useMessageBubbleInteractions(onShowContextMenu);

  return (
    <MessageBubbleCardSwitch
      msg={msg}
      isOwn={isOwn}
      isFocused={isFocused}
      isGroup={isGroup}
      memberNames={memberNames}
      currentUid={currentUid}
      user={user}
      chatSearch={chatSearch}
      onReact={onReact}
      onShowContextMenu={onShowContextMenu}
      onRetry={onRetry}
      onStartCall={onStartCall}
      onViewContact={onViewContact}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onActionCardKeyDown={handleActionCardKeyDown}
    />
  );
});

export default MessageBubble;
