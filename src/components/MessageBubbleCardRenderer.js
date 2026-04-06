import React from 'react';
import MessageBubbleGroup from './MessageBubbleGroup';
import { buildMessageBubbleCardRenderConfig } from './messageBubbleCardRendererHelpers';

export default function MessageBubbleCardRenderer({ runtime }) {
  const renderConfig = buildMessageBubbleCardRenderConfig(runtime);
  if (!renderConfig) return null;

  const CardComponent = renderConfig.component;
  const content = <CardComponent {...renderConfig.props} />;

  if (!renderConfig.wrapInGroup) {
    return content;
  }

  return <MessageBubbleGroup isOwn={runtime.isOwn}>{content}</MessageBubbleGroup>;
}
