import { buildCallMessageCardPresentation } from './callMessageHelpers';
import {
  buildSharedContactMessageCardPresentation,
  buildStandardMessageBubblePresentation,
} from './messageBubbleHelpers';

const MESSAGE_BUBBLE_CARD_BUILDERS = {
  attachment: (message, attachmentRuntime) => ({
    type: 'attachment',
    presentation: withMessageCreatedAt(message, attachmentRuntime.presentation),
  }),
  contact: (message) => ({
    type: 'contact',
    presentation: buildSharedContactMessageCardPresentation(message.msg, {
      isOwn: message.isOwn,
    }),
  }),
  call: (message) => ({
    type: 'call',
    presentation: withMessageCreatedAt(
      message,
      buildCallMessageCardPresentation(message.msg, {
        isOwn: message.isOwn,
        isFocused: message.isFocused,
      }),
    ),
  }),
  system: (message) => ({
    type: 'system',
    presentation: {
      text: message.msg.text,
    },
  }),
  text: (message) => ({
    type: 'text',
    presentation: buildStandardMessageBubblePresentation(message.msg, {
      isOwn: message.isOwn,
      isFocused: message.isFocused,
      isGroup: message.isGroup,
      memberNames: message.memberNames,
      contacts: message.contacts,
      currentUid: message.currentUid,
      currentUser: message.currentUser,
      chatSearch: message.chatSearch,
    }),
  }),
};

function withMessageCreatedAt(message, presentation) {
  return {
    ...presentation,
    createdAt: message.msg.createdAt,
  };
}

function resolveMessageBubbleCardBuilder(messageType) {
  return MESSAGE_BUBBLE_CARD_BUILDERS[messageType] || MESSAGE_BUBBLE_CARD_BUILDERS.text;
}

export function buildMessageBubbleContext({
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
}) {
  return {
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
  };
}

export function buildAttachmentMessageRuntimeInput(message) {
  return {
    messageAttachment: message.msg.type === 'attachment' ? message.msg.attachment : null,
    messageId: message.msg.id,
    user: message.user,
    isOwn: message.isOwn,
  };
}

export function buildMessageBubbleCard(message, attachmentRuntime) {
  return resolveMessageBubbleCardBuilder(message.msg.type)(message, attachmentRuntime);
}

export function buildMessageBubbleHandlers({
  onReact,
  onShowContextMenu,
  onRetry,
  onStartCall,
  onViewContact,
  interactions,
}) {
  return {
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
  };
}

export function buildMessageBubbleRenderInput({
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
