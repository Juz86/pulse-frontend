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
  const message = buildMessageBubbleContext({
    msg,
    isOwn,
    isFocused,
    isGroup,
    memberNames,
    currentUid,
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
    onRetry,
    onStartCall,
    onViewContact,
    interactions,
  });

  return renderMessageBubbleCard(buildMessageBubbleRenderInput({
    card,
    message,
    handlers,
  }));
});

export default MessageBubble;
