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

export function buildMessageBubbleRuntimeState({
  card,
  message,
  handlers,
}) {
  return {
    card,
    message,
    handlers,
  };
}

export function buildMessageBubbleRuntime({
  message,
  card,
  onReact,
  onShowContextMenu,
  onRetry,
  onStartCall,
  onViewContact,
  interactions,
}) {
  const handlers = buildMessageBubbleHandlers({
    onReact,
    onShowContextMenu,
    onRetry,
    onStartCall,
    onViewContact,
    handleContextMenu: interactions.handleContextMenu,
    handleTouchStart: interactions.handleTouchStart,
    handleTouchEnd: interactions.handleTouchEnd,
    handleTouchMove: interactions.handleTouchMove,
    handleActionCardKeyDown: interactions.handleActionCardKeyDown,
  });

  return buildMessageBubbleRuntimeState({
    card,
    message,
    handlers,
  });
}
