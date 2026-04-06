import useMessageBubbleInteractions from './useMessageBubbleInteractions';
import useMessageBubbleCardPresentation from './useMessageBubbleCardPresentation';

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

  return {
    card,
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
