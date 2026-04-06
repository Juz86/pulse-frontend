import { useRef } from 'react';

export default function useMessageBubbleInteractions(onShowContextMenu) {
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  function handleTouchStart(event) {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      const touch = event.touches[0];
      onShowContextMenu({
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => {},
      });
    }, 500);
  }

  function handleTouchEnd(event) {
    clearTimeout(longPressTimer.current);
    if (longPressFired.current) event.preventDefault();
  }

  function handleTouchMove() {
    clearTimeout(longPressTimer.current);
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
    handleContextMenu,
    handleActionCardKeyDown,
  };
}
