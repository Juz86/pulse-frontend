import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QUICK_REACTION_EMOJI } from './messageReactionConstants';

const PICKER_WIDTH = 248;
const VIEWPORT_GAP = 12;

const MessageBubbleActions = React.memo(function MessageBubbleActions({
  onReact,
  isOpen = false,
  onOpen,
  onClose,
  isOwn = false,
}) {
  const wrapRef = useRef(null);
  const pickerRef = useRef(null);
  const [pickerPlacement, setPickerPlacement] = useState(() => ({
    horizontal: isOwn ? 'left' : 'right',
    vertical: 'center',
    offsetX: 0,
  }));

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsidePointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) onClose?.();
    }

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const closeOnScroll = () => onClose?.();

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen || !wrapRef.current || typeof window === 'undefined') return;

    const rect = wrapRef.current.getBoundingClientRect();
    const pickerWidth = pickerRef.current?.offsetWidth || PICKER_WIDTH;
    const roomRight = window.innerWidth - rect.right - VIEWPORT_GAP;
    const roomLeft = rect.left - VIEWPORT_GAP;
    const preferredHorizontal = isOwn ? 'left' : 'right';
    const fallbackHorizontal = preferredHorizontal === 'right' ? 'left' : 'right';
    const canRenderPreferred = preferredHorizontal === 'right' ? roomRight >= pickerWidth : roomLeft >= pickerWidth;
    const canRenderFallback = fallbackHorizontal === 'right' ? roomRight >= pickerWidth : roomLeft >= pickerWidth;
    const chosenHorizontal = canRenderPreferred
      ? preferredHorizontal
      : (canRenderFallback ? fallbackHorizontal : (roomLeft >= roomRight ? 'left' : 'right'));
    let offsetX = 0;

    if (chosenHorizontal === 'right') {
      const overflowRight = pickerWidth - roomRight;
      if (overflowRight > 0) offsetX = -overflowRight;
    } else {
      const overflowLeft = pickerWidth - roomLeft;
      if (overflowLeft > 0) offsetX = overflowLeft;
    }

    setPickerPlacement({
      horizontal: chosenHorizontal,
      vertical: 'center',
      offsetX,
    });
  }, [isOpen, isOwn]);

  const pickerClassName = `msg-emoji-picker${isOpen ? ' open' : ''} ${pickerPlacement.horizontal} ${pickerPlacement.vertical}`;

  return (
    <div
      className={`msg-actions${isOpen ? ' picker-open' : ''}`}
      ref={wrapRef}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="msg-actions-anchor">
        <button
          type="button"
          className="msg-action-btn"
          aria-label="Reageren"
          aria-haspopup="true"
          aria-expanded={isOpen}
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) onClose?.();
            else onOpen?.();
          }}
        >
          <span aria-hidden="true">😊</span>
        </button>
        <div
          ref={pickerRef}
          className={pickerClassName}
          role="group"
          aria-label="Snelle reacties"
          aria-hidden={!isOpen}
          style={{ '--picker-offset-x': `${pickerPlacement.offsetX}px` }}
        >
          {QUICK_REACTION_EMOJI.map((emoji, index) => (
            <button
              type="button"
              key={emoji}
              aria-label={`Reageer met ${emoji}`}
              style={{ '--reaction-pop-delay': `${index * 18}ms` }}
              tabIndex={isOpen ? 0 : -1}
              onClick={() => {
                onReact(emoji);
                onClose?.();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default MessageBubbleActions;
