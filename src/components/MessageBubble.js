// src/components/MessageBubble.js
import React from 'react';
import { renderMessageBubbleCard } from './messageBubbleCardRendererHelpers';
import useMessageBubbleInteractions from './useMessageBubbleInteractions';
import useAttachmentMessageRuntime from './useAttachmentMessageRuntime';
import { buildCallMessageCardPresentation } from './callMessageHelpers';
import {
  buildSharedContactMessageCardPresentation,
  buildStandardMessageBubblePresentation,
} from './messageBubbleHelpers';

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
  const message = {
    msg,
    isOwn,
    isFocused,
    isGroup,
    memberNames,
    currentUid,
    user,
    chatSearch,
  };
  const attachmentRuntime = useAttachmentMessageRuntime({
    messageAttachment: message.msg.type === 'attachment' ? message.msg.attachment : null,
    messageId: message.msg.id,
    user: message.user,
    isOwn: message.isOwn,
  });
  let card;

  switch (message.msg.type) {
    case 'attachment':
      card = {
        type: 'attachment',
        presentation: {
          ...attachmentRuntime.presentation,
          createdAt: message.msg.createdAt,
        },
      };
      break;
    case 'contact':
      card = {
        type: 'contact',
        presentation: buildSharedContactMessageCardPresentation(message.msg, {
          isOwn: message.isOwn,
        }),
      };
      break;
    case 'call':
      card = {
        type: 'call',
        presentation: {
          ...buildCallMessageCardPresentation(message.msg, {
            isOwn: message.isOwn,
            isFocused: message.isFocused,
          }),
          createdAt: message.msg.createdAt,
        },
      };
      break;
    case 'system':
      card = {
        type: 'system',
        presentation: {
          text: message.msg.text,
        },
      };
      break;
    default:
      card = {
        type: 'text',
        presentation: buildStandardMessageBubblePresentation(message.msg, {
          isOwn: message.isOwn,
          isFocused: message.isFocused,
          isGroup: message.isGroup,
          memberNames: message.memberNames,
          currentUid: message.currentUid,
          chatSearch: message.chatSearch,
        }),
      };
      break;
  }

  return renderMessageBubbleCard({
    card,
    message,
    handlers: {
      onReact,
      onShowContextMenu,
      onRetry,
      onStartCall,
      onViewContact,
      onContextMenu: interactions.handleContextMenu,
      onTouchStart: interactions.handleTouchStart,
      onTouchEnd: interactions.handleTouchEnd,
      onTouchMove: interactions.handleTouchMove,
      onActionCardKeyDown: interactions.handleActionCardKeyDown,
    },
  });
});

export default MessageBubble;
