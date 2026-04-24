import React, { useEffect, useState } from 'react';
import { QUICK_REACTION_EMOJI } from './messageReactionConstants';

export default function MessageBubbleActions({
  onReact,
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const closeOnOutsideClick = () => setEmojiPickerOpen(false);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setEmojiPickerOpen(false);
    };

    document.addEventListener('click', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('click', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [emojiPickerOpen]);

  return (
    <div
      className={`msg-actions${emojiPickerOpen ? ' picker-open' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="msg-action-btn"
          aria-label="Reageren"
          aria-haspopup="true"
          aria-expanded={emojiPickerOpen}
          onClick={(e) => { e.stopPropagation(); setEmojiPickerOpen((v) => !v); }}
        >
          <span aria-hidden="true">😊</span>
        </button>
        {emojiPickerOpen && (
          <div className="msg-emoji-picker" role="group" aria-label="Snelle reacties">
            {QUICK_REACTION_EMOJI.map((emoji) => (
              <button
                type="button"
                key={emoji}
                aria-label={`Reageer met ${emoji}`}
                onClick={() => { onReact(emoji); setEmojiPickerOpen(false); }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
