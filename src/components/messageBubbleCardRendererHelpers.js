import AttachmentMessageCard from './AttachmentMessageCard';
import CallMessageCard from './CallMessageCard';
import SharedContactMessageCard from './SharedContactMessageCard';
import StandardMessageBubble from './StandardMessageBubble';
import SystemMessageNote from './SystemMessageNote';

export function buildMessageBubbleCardRenderConfig(runtime) {
  const {
    card,
    msg,
    onReact,
    onShowContextMenu,
    onRetry,
    onStartCall,
    onViewContact,
    onContextMenu,
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onActionCardKeyDown,
  } = runtime;

  if (card.type === 'system') {
    return {
      component: SystemMessageNote,
      props: {
        text: card.presentation.text,
      },
      wrapInGroup: false,
    };
  }

  if (card.type === 'attachment') {
    return {
      component: AttachmentMessageCard,
      props: {
        presentation: card.presentation,
        createdAt: msg.createdAt,
      },
      wrapInGroup: true,
    };
  }

  if (card.type === 'contact') {
    if (!card.presentation) return null;

    return {
      component: SharedContactMessageCard,
      props: {
        presentation: card.presentation,
        onViewContact,
        onActionCardKeyDown,
      },
      wrapInGroup: true,
    };
  }

  if (card.type === 'call') {
    return {
      component: CallMessageCard,
      props: {
        presentation: card.presentation,
        onStartCall,
        onActionCardKeyDown,
        createdAt: msg.createdAt,
      },
      wrapInGroup: false,
    };
  }

  return {
    component: StandardMessageBubble,
    props: {
      presentation: card.presentation,
      onContextMenu,
      onTouchStart,
      onTouchEnd,
      onTouchMove,
      onRetry,
      onReact,
      onShowContextMenu,
    },
    wrapInGroup: false,
  };
}
