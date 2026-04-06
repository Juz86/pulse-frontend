export function buildMessageBubbleMessageContext({
  msg,
  isOwn,
  isFocused,
  isGroup,
  memberNames,
  currentUid,
  user,
  chatSearch,
}) {
  return {
    msg,
    isOwn,
    isFocused,
    isGroup,
    memberNames,
    currentUid,
    user,
    chatSearch,
  };
}

export function buildMessageBubbleHandlers({
  onReact,
  onShowContextMenu,
  onRetry,
  onStartCall,
  onViewContact,
  handleContextMenu,
  handleTouchStart,
  handleTouchEnd,
  handleTouchMove,
  handleActionCardKeyDown,
}) {
  return {
    onReact,
    onShowContextMenu,
    onRetry,
    onStartCall,
    onViewContact,
    onContextMenu: handleContextMenu,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onActionCardKeyDown: handleActionCardKeyDown,
  };
}
