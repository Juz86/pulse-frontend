// src/components/MessageBubble.js
import React from 'react';
import MessageBubbleCardSwitch from './MessageBubbleCardSwitch';
import useMessageBubbleRuntime from './useMessageBubbleRuntime';

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
  const bubbleRuntime = useMessageBubbleRuntime({
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
  });

  return <MessageBubbleCardSwitch {...bubbleRuntime} />;
});

export default MessageBubble;
