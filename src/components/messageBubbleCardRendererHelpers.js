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

export function buildMessageBubbleCardRenderConfig(runtime) {
  const {
    card,
    message: {
      msg,
    },
    handlers,
  } = runtime;

  if (card.type === 'system') {
    return buildSystemMessageRenderConfig(card);
  }

  if (card.type === 'attachment') {
    return buildAttachmentMessageRenderConfig(card, msg);
  }

  if (card.type === 'contact') {
    return buildContactMessageRenderConfig(card, handlers);
  }

  if (card.type === 'call') {
    return buildCallMessageRenderConfig(card, msg, handlers);
  }

  return buildTextMessageRenderConfig(card, handlers);
}
