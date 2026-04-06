import React from 'react';
import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import MessageBubbleGroup from './MessageBubbleGroup';
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

function buildAttachmentMessageRenderConfig(card) {
  return {
    component: AttachmentMessageCard,
    props: {
      presentation: card.presentation,
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

function buildCallMessageRenderConfig(card, handlers) {
  return {
    component: CallMessageCard,
    props: {
      presentation: card.presentation,
      onStartCall: handlers.onStartCall,
      onActionCardKeyDown: handlers.onActionCardKeyDown,
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

function buildDefaultMessageRenderConfig(runtime) {
  return buildTextMessageRenderConfig(runtime.card, runtime.handlers);
}

const MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS = {
  system: ({ card }) => buildSystemMessageRenderConfig(card),
  attachment: ({ card }) => buildAttachmentMessageRenderConfig(card),
  contact: ({ card, handlers }) => buildContactMessageRenderConfig(card, handlers),
  call: ({ card, handlers }) => buildCallMessageRenderConfig(card, handlers),
  text: buildDefaultMessageRenderConfig,
};

export function buildMessageBubbleCardRenderConfig(runtime) {
  return (
    MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS[runtime.card.type]
    || buildDefaultMessageRenderConfig
  )(runtime);
}

function renderMessageBubbleCardContent(renderConfig) {
  const CardComponent = renderConfig.component;
  return <CardComponent {...renderConfig.props} />;
}

function renderWrappedMessageBubbleCard(runtime, content) {
  return <MessageBubbleGroup isOwn={runtime.message.isOwn}>{content}</MessageBubbleGroup>;
}

export function renderMessageBubbleCard(runtime) {
  const renderConfig = buildMessageBubbleCardRenderConfig(runtime);
  if (!renderConfig) return null;

  const content = renderMessageBubbleCardContent(renderConfig);

  if (!renderConfig.wrapInGroup) {
    return content;
  }

  return renderWrappedMessageBubbleCard(runtime, content);
}
