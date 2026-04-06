import React from 'react';
import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import MessageBubbleGroup from './MessageBubbleGroup';
import SharedContactMessageCard from './SharedContactMessageCard';
import StandardMessageBubble from './StandardMessageBubble';
import SystemMessageNote from './SystemMessageNote';

function buildMessageBubbleCardRenderConfig(component, props, wrapInGroup = false) {
  return {
    component,
    props,
    wrapInGroup,
  };
}

function buildPresentationCardRenderConfig(component, presentation, extraProps = {}, wrapInGroup = false) {
  return buildMessageBubbleCardRenderConfig(
    component,
    {
      presentation,
      ...extraProps,
    },
    wrapInGroup,
  );
}

function buildGroupedPresentationCardRenderConfig(component, presentation, extraProps = {}) {
  return buildPresentationCardRenderConfig(component, presentation, extraProps, true);
}

function buildSystemMessageCardRenderConfig(text) {
  return buildMessageBubbleCardRenderConfig(
    SystemMessageNote,
    {
      text,
    },
  );
}

function buildAttachmentMessageCardRenderConfig(presentation) {
  return buildGroupedPresentationCardRenderConfig(
    AttachmentMessageCard,
    presentation,
  );
}

function buildContactMessageCardRenderConfig(presentation, handlers) {
  if (!presentation) return null;

  return buildGroupedPresentationCardRenderConfig(
    SharedContactMessageCard,
    presentation,
    {
      onViewContact: handlers.onViewContact,
      onActionCardKeyDown: handlers.onActionCardKeyDown,
    },
  );
}

function buildCallMessageCardRenderConfig(presentation, handlers) {
  return buildPresentationCardRenderConfig(
    CallMessageCard,
    presentation,
    {
      onStartCall: handlers.onStartCall,
      onActionCardKeyDown: handlers.onActionCardKeyDown,
    },
  );
}

function buildTextMessageCardRenderConfig(presentation, handlers) {
  return buildPresentationCardRenderConfig(
    StandardMessageBubble,
    presentation,
    {
      onContextMenu: handlers.onContextMenu,
      onTouchStart: handlers.onTouchStart,
      onTouchEnd: handlers.onTouchEnd,
      onTouchMove: handlers.onTouchMove,
      onRetry: handlers.onRetry,
      onReact: handlers.onReact,
      onShowContextMenu: handlers.onShowContextMenu,
    },
  );
}

const MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS = {
  system: ({ card }) => buildSystemMessageCardRenderConfig(card.presentation.text),
  attachment: ({ card }) => buildAttachmentMessageCardRenderConfig(card.presentation),
  contact: ({ card, handlers }) => buildContactMessageCardRenderConfig(card.presentation, handlers),
  call: ({ card, handlers }) => buildCallMessageCardRenderConfig(card.presentation, handlers),
  text: ({ card, handlers }) => buildTextMessageCardRenderConfig(card.presentation, handlers),
};

function resolveMessageBubbleRenderConfigBuilder(cardType) {
  return MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS[cardType]
    || MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS.text;
}

function buildMessageBubbleRenderRuntime(runtime) {
  return {
    card: runtime.card,
    handlers: runtime.handlers,
    isOwn: runtime.message.isOwn,
  };
}

function renderMessageBubbleCardContent(renderConfig) {
  const CardComponent = renderConfig.component;
  return <CardComponent {...renderConfig.props} />;
}

function renderMessageBubbleCardOutput(renderConfig, isOwn) {
  const content = renderMessageBubbleCardContent(renderConfig);
  if (!renderConfig.wrapInGroup) {
    return content;
  }

  return <MessageBubbleGroup isOwn={isOwn}>{content}</MessageBubbleGroup>;
}

export function renderMessageBubbleCard(runtime) {
  const renderRuntime = buildMessageBubbleRenderRuntime(runtime);
  const renderConfig = resolveMessageBubbleRenderConfigBuilder(renderRuntime.card.type)(
    renderRuntime,
  );
  if (!renderConfig) return null;

  return renderMessageBubbleCardOutput(renderConfig, renderRuntime.isOwn);
}
