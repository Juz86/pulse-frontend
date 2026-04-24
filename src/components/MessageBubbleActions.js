import React, { useEffect, useState } from 'react';

const QUICK_EMOJI = ['❤️', '👍', '😂', '😮', '😢', '👎'];

export default function MessageBubbleActions({
  onReact,
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const close = () => setEmojiPickerOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [emojiPickerOpen]);

  return (
    <div
      className="msg-actions"
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={() => setEmojiPickerOpen(false)}
    >
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="msg-action-btn"
          aria-label="Reageren"
          onClick={(e) => { e.stopPropagation(); setEmojiPickerOpen((v) => !v); }}
        >
          <span aria-hidden="true">😊</span>
        </button>
        {emojiPickerOpen && (
          <div className="msg-emoji-picker">
            {QUICK_EMOJI.map((emoji) => (
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
