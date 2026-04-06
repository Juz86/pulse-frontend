import useMessageBubbleInteractions from './useMessageBubbleInteractions';

export default function useMessageBubbleRuntime({
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

  return {
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
    onContextMenu: handleContextMenu,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onActionCardKeyDown: handleActionCardKeyDown,
  };
}
