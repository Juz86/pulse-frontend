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
    presentation: {
      title: message.msg.text || (message.msg.callKind === 'outgoing_unanswered'
        ? 'Geen antwoord'
        : message.msg.callKind?.endsWith('_declined')
          ? (message.msg.isVideo || message.msg.mediaType === 'video' ? 'Video-oproep geweigerd' : 'Oproep geweigerd')
          : (message.msg.isVideo || message.msg.mediaType === 'video' ? 'Gemiste video-oproep' : 'Gemiste spraakoproep')),
      subtitle: message.msg.callKind?.startsWith('outgoing_')
        ? 'Tikken om opnieuw te bellen'
        : 'Tikken om terug te bellen',
      kind: message.msg.callKind || (message.msg.direction === 'outgoing' ? 'outgoing_unanswered' : 'missed_incoming'),
      isVideo: !!message.msg.isVideo || message.msg.mediaType === 'video',
      createdAt: message.msg.createdAt,
    },
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
  onOpenReactionPicker,
  reactionPickerOpen,
  onCloseReactionPicker,
  onRetry,
  onViewContact,
  onStartAudioCall,
  onStartVideoCall,
  interactions,
}) {
  return {
    onReact,
    onShowContextMenu,
    onOpenReactionPicker,
    reactionPickerOpen,
    onCloseReactionPicker,
    onRetry,
    onViewContact,
    onStartAudioCall,
    onStartVideoCall,
    onContextMenu: interactions.handleContextMenu,
    onTouchStart: interactions.handleTouchStart,
    onTouchEnd: interactions.handleTouchEnd,
    onTouchMove: interactions.handleTouchMove,
    onTouchCancel: interactions.handleTouchCancel,
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
