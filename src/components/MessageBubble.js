// src/components/MessageBubble.js
import React from 'react';
import { renderMessageBubbleCard } from './messageBubbleCardRendererHelpers';
import {
  buildAttachmentMessageRuntimeInput,
  buildMessageBubbleCard,
  buildMessageBubbleContext,
  buildMessageBubbleHandlers,
  buildMessageBubbleRenderInput,
} from './messageBubbleCardHelpers';
import useMessageBubbleInteractions from './useMessageBubbleInteractions';
import useAttachmentMessageRuntime from './useAttachmentMessageRuntime';

// ── MessageBubble ─────────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({
  msg,
  isOwn,
  isFocused,
  isGroup,
  memberNames,
  contacts,
  currentUid,
  currentUser,
  user,
  chatSearch,
  onReact,
  onShowContextMenu,
  onOpenReactionPicker,
  reactionPickerOpen,
  onCloseReactionPicker,
  onRetry,
  onViewContact,
  onStartAudioCall,
  onStartVideoCall,
}) {
  const interactions = useMessageBubbleInteractions(onShowContextMenu, onOpenReactionPicker);
  const message = buildMessageBubbleContext({
    msg,
    isOwn,
    isFocused,
    isGroup,
    memberNames,
    contacts,
    currentUid,
    currentUser,
    user,
    chatSearch,
  });
  const attachmentRuntime = useAttachmentMessageRuntime(
    buildAttachmentMessageRuntimeInput(message),
  );
  const card = buildMessageBubbleCard(message, attachmentRuntime);
  const handlers = buildMessageBubbleHandlers({
    onReact,
    onShowContextMenu,
    onOpenReactionPicker,
    reactionPickerOpen,
    onCloseReactionPicker,
    onRetry,
    onViewContact,
    onStartAudioCall,
    onStartVideoCall,
    interactions,
  });

  return renderMessageBubbleCard(buildMessageBubbleRenderInput({
    card,
    message,
    handlers,
  }));
});

export default MessageBubble;
