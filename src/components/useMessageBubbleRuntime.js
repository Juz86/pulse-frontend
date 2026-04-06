import useMessageBubbleInteractions from './useMessageBubbleInteractions';
import useMessageBubbleCardPresentation from './useMessageBubbleCardPresentation';
import {
  buildMessageBubbleMessageContext,
  buildMessageBubbleRuntime,
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
  const interactions = useMessageBubbleInteractions(onShowContextMenu);
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
  const card = useMessageBubbleCardPresentation({
    message,
  });
  return buildMessageBubbleRuntime({
    message,
    card,
    onReact,
    onShowContextMenu,
    onRetry,
    onStartCall,
    onViewContact,
    interactions,
  });
}
