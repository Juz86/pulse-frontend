import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import SharedContactMessageCard from './SharedContactMessageCard';
import StandardMessageBubble from './StandardMessageBubble';
import SystemMessageNote from './SystemMessageNote';

function buildSystemMessageRenderConfig(card) {
  return {
    component: SystemMessageNote,
    props: {
      text: card.presentation.text,
    },
    wrapInGroup: false,
  };
}

function buildAttachmentMessageRenderConfig(card, msg) {
  return {
    component: AttachmentMessageCard,
    props: {
      presentation: card.presentation,
      createdAt: msg.createdAt,
    },
    wrapInGroup: true,
  };
}

function buildContactMessageRenderConfig(card, handlers) {
  if (!card.presentation) return null;

  return {
    component: SharedContactMessageCard,
    props: {
      presentation: card.presentation,
      onViewContact: handlers.onViewContact,
      onActionCardKeyDown: handlers.onActionCardKeyDown,
    },
    wrapInGroup: true,
  };
}

function buildCallMessageRenderConfig(card, msg, handlers) {
  return {
    component: CallMessageCard,
    props: {
      presentation: card.presentation,
      onStartCall: handlers.onStartCall,
      onActionCardKeyDown: handlers.onActionCardKeyDown,
      createdAt: msg.createdAt,
    },
    wrapInGroup: false,
  };
}

function buildTextMessageRenderConfig(card, handlers) {
  return {
    component: StandardMessageBubble,
    props: {
      presentation: card.presentation,
      onContextMenu: handlers.onContextMenu,
      onTouchStart: handlers.onTouchStart,
      onTouchEnd: handlers.onTouchEnd,
      onTouchMove: handlers.onTouchMove,
      onRetry: handlers.onRetry,
      onReact: handlers.onReact,
      onShowContextMenu: handlers.onShowContextMenu,
    },
    wrapInGroup: false,
  };
}

const MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS = {
  system: ({ card }) => buildSystemMessageRenderConfig(card),
  attachment: ({ card, message }) => buildAttachmentMessageRenderConfig(card, message.msg),
  contact: ({ card, handlers }) => buildContactMessageRenderConfig(card, handlers),
  call: ({ card, message, handlers }) => buildCallMessageRenderConfig(card, message.msg, handlers),
};

export function buildMessageBubbleCardRenderConfig(runtime) {
  const builder = MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS[runtime.card.type];

  if (builder) {
    return builder(runtime);
  }

  return buildTextMessageRenderConfig(runtime.card, runtime.handlers);
}
