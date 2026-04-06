import { buildMessageBubbleCardRenderConfig } from './messageBubbleCardRendererHelpers';

export default function useMessageBubbleRenderConfig({ card, message, handlers }) {
  return buildMessageBubbleCardRenderConfig({
    card,
    message,
    handlers,
  });
}
