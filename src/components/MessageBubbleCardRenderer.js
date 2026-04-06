import React from 'react';
import MessageBubbleGroup from './MessageBubbleGroup';

export default function MessageBubbleCardRenderer({ runtime }) {
  const { renderConfig } = runtime;
  if (!renderConfig) return null;

  const CardComponent = renderConfig.component;
  const content = <CardComponent {...renderConfig.props} />;

  if (!renderConfig.wrapInGroup) {
    return content;
  }

  return <MessageBubbleGroup isOwn={runtime.message.isOwn}>{content}</MessageBubbleGroup>;
}
