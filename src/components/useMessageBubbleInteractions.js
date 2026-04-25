import { useRef } from 'react';

const LONG_PRESS_DELAY_MS = 420;

export default function useMessageBubbleInteractions(onShowContextMenu, onOpenReactionPicker) {
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  function clearLongPressTimer() {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function handleTouchStart(event) {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onOpenReactionPicker?.();
    }, LONG_PRESS_DELAY_MS);
  }

  function handleTouchEnd(event) {
    clearLongPressTimer();
    if (longPressFired.current) event.preventDefault();
  }

  function handleTouchMove() {
    clearLongPressTimer();
  }

  function handleTouchCancel() {
    clearLongPressTimer();
  }

  function handleContextMenu(event) {
    event.preventDefault();
    onShowContextMenu(event);
  }

  function handleActionCardKeyDown(event, action) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }

  return {
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleTouchCancel,
    handleContextMenu,
    handleActionCardKeyDown,
  };
}
