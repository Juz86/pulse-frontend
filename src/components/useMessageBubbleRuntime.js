import useMessageBubbleInteractions from './useMessageBubbleInteractions';
import useMessageBubbleCardPresentation from './useMessageBubbleCardPresentation';
import {
  buildMessageBubbleHandlers,
  buildMessageBubbleMessageContext,
} from './messageBubbleRuntimeHelpers';

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
  const message = buildMessageBubbleMessageContext({
    msg,
    isOwn,
    isFocused,
    isGroup,
    memberNames,
    currentUid,
    user,
    chatSearch,
  });
  const handlers = buildMessageBubbleHandlers({
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
  });
  return {
    card,
    message,
    handlers,
  };
}
