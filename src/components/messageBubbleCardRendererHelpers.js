import React from 'react';
import AttachmentMessageCard from './AttachmentMessageCard';
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

function buildSystemMessageCardRenderProps(text) {
  return {
    text,
  };
}

function buildSystemMessageCardRenderConfig(text) {
  return buildMessageBubbleCardRenderConfig(
    SystemMessageNote,
    buildSystemMessageCardRenderProps(text),
  );
}

function buildAttachmentMessageCardRenderProps() {
  return {};
}

function buildAttachmentMessageCardRenderConfig(presentation) {
  return buildGroupedPresentationCardRenderConfig(
    AttachmentMessageCard,
    presentation,
    buildAttachmentMessageCardRenderProps(),
  );
}

function buildContactMessageCardRenderProps(handlers) {
  return {
    onViewContact: handlers.onViewContact,
    onActionCardKeyDown: handlers.onActionCardKeyDown,
  };
}

function buildContactMessageCardRenderConfig(presentation, handlers) {
  if (!presentation) return null;

  return buildGroupedPresentationCardRenderConfig(
    SharedContactMessageCard,
    presentation,
    buildContactMessageCardRenderProps(handlers),
  );
}

function buildTextMessageCardRenderProps(handlers) {
  return {
    onContextMenu: handlers.onContextMenu,
    onTouchStart: handlers.onTouchStart,
    onTouchEnd: handlers.onTouchEnd,
    onTouchMove: handlers.onTouchMove,
    onTouchCancel: handlers.onTouchCancel,
    onRetry: handlers.onRetry,
    onReact: handlers.onReact,
    onShowContextMenu: handlers.onShowContextMenu,
    onOpenReactionPicker: handlers.onOpenReactionPicker,
    reactionPickerOpen: handlers.reactionPickerOpen,
    onCloseReactionPicker: handlers.onCloseReactionPicker,
  };
}

function buildTextMessageCardRenderConfig(presentation, handlers) {
  return buildPresentationCardRenderConfig(
    StandardMessageBubble,
    presentation,
    buildTextMessageCardRenderProps(handlers),
  );
}

const MESSAGE_BUBBLE_RENDER_CONFIG_BUILDERS = {
  system: ({ card }) => buildSystemMessageCardRenderConfig(card.presentation.text),
  attachment: ({ card }) => buildAttachmentMessageCardRenderConfig(card.presentation),
  contact: ({ card, handlers }) => buildContactMessageCardRenderConfig(card.presentation, handlers),
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

function buildResolvedMessageBubbleRenderState(runtime) {
  const renderRuntime = buildMessageBubbleRenderRuntime(runtime);
  return {
    renderRuntime,
    renderConfig: resolveMessageBubbleRenderConfigBuilder(renderRuntime.card.type)(renderRuntime),
  };
}

function renderMessageBubbleCardContent(renderConfig) {
  const CardComponent = renderConfig.component;
  return <CardComponent {...renderConfig.props} />;
}

function renderGroupedMessageBubbleCardOutput(content, isOwn) {
  return <MessageBubbleGroup isOwn={isOwn}>{content}</MessageBubbleGroup>;
}

function renderDirectMessageBubbleCardOutput(content) {
  return content;
}

function shouldSkipMessageBubbleCardRender(renderConfig) {
  return !renderConfig;
}

function buildMessageBubbleCardOutputState(renderConfig) {
  return {
    content: renderMessageBubbleCardContent(renderConfig),
    isGrouped: renderConfig.wrapInGroup,
  };
}

function resolveMessageBubbleCardOutputRenderer(isGrouped) {
  return isGrouped
    ? renderGroupedMessageBubbleCardOutput
    : renderDirectMessageBubbleCardOutput;
}

function renderMessageBubbleCardOutput(renderConfig, isOwn) {
  const outputState = buildMessageBubbleCardOutputState(renderConfig);
  const renderOutput = resolveMessageBubbleCardOutputRenderer(outputState.isGrouped);

  return renderOutput(outputState.content, isOwn);
}

function buildMessageBubbleCardRenderResult(runtime) {
  const { renderRuntime, renderConfig } = buildResolvedMessageBubbleRenderState(runtime);
  if (shouldSkipMessageBubbleCardRender(renderConfig)) {
    return null;
  }

  return renderMessageBubbleCardOutput(renderConfig, renderRuntime.isOwn);
}

export function renderMessageBubbleCard(runtime) {
  return buildMessageBubbleCardRenderResult(runtime);
}
