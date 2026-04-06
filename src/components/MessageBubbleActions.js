import React, { useEffect, useState } from 'react';

const QUICK_EMOJI = ['❤️', '👍', '😂', '😮', '😢', '👎'];

export default function MessageBubbleActions({
  onReact,
  onShowContextMenu,
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const close = () => setEmojiPickerOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [emojiPickerOpen]);

  return (
    <div className="msg-actions" onClick={(e) => e.stopPropagation()}>
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
      <button
        type="button"
        className="msg-action-btn"
        aria-label="Berichtopties"
        onClick={(e) => { e.stopPropagation(); onShowContextMenu(e); }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
    </div>
  );
}
