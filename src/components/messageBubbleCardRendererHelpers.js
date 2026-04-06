import React from 'react';
import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import MessageBubbleGroup from './MessageBubbleGroup';
import SharedContactMessageCard from './SharedContactMessageCard';
import StandardMessageBubble from './StandardMessageBubble';
import SystemMessageNote from './SystemMessageNote';

const MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS = {
  system: ({ card }) => ({
    component: SystemMessageNote,
    props: {
      text: card.presentation.text,
    },
    wrapInGroup: false,
  }),
  attachment: ({ card }) => ({
    component: AttachmentMessageCard,
    props: {
      presentation: card.presentation,
    },
    wrapInGroup: true,
  }),
  contact: ({ card, handlers }) => {
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
  },
  call: ({ card, handlers }) => ({
    component: CallMessageCard,
    props: {
      presentation: card.presentation,
      onStartCall: handlers.onStartCall,
      onActionCardKeyDown: handlers.onActionCardKeyDown,
    },
    wrapInGroup: false,
  }),
  text: ({ card, handlers }) => ({
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
  }),
};

function resolveMessageBubbleRenderConfigBuilder(cardType) {
  return MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS[cardType]
    || MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS.text;
}

export function renderMessageBubbleCard(runtime) {
  const renderRuntime = {
    card: runtime.card,
    handlers: runtime.handlers,
    isOwn: runtime.message.isOwn,
  };
  const renderConfig = resolveMessageBubbleRenderConfigBuilder(renderRuntime.card.type)(
    renderRuntime,
  );
  if (!renderConfig) return null;

  const CardComponent = renderConfig.component;
  const content = <CardComponent {...renderConfig.props} />;

  if (!renderConfig.wrapInGroup) {
    return content;
  }

  return <MessageBubbleGroup isOwn={renderRuntime.isOwn}>{content}</MessageBubbleGroup>;
}
