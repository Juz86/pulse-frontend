// src/components/MsgContextMenu.js
import React, { useState } from 'react';
import { canEditMessage } from '../lib/e2ee/policy';
import {
  Reply, Copy, Smile, Forward, Pin, StarFilled, StarOutline,
  MagicEdit, Delete, Refresh,
} from './Icons';

const QUICK_EMOJI = ['❤️', '👍', '😂', '😮', '😢', '👎'];
const MENU_ICON_SIZE = 14;

export default function MsgContextMenu({
  msg, isOwn, position, anchorRect, starred, pinned,
  onClose, onReply, onCopy, onReact, onForward, onPin, onStar, onEdit,
  onDeleteRequest, onRetry,
}) {
  const menuWidth     = 220;
  const menuEstHeight = 380;
  const menuGap       = 8;
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  const chatBounds = document.querySelector('.messages-area-wrap')?.getBoundingClientRect();
  const bounds = chatBounds || { left: 8, right: window.innerWidth - 8, top: 8, bottom: window.innerHeight - 8 };
  const minLeft = bounds.left + menuGap;
  const maxLeft = bounds.right - menuWidth - menuGap;
  const minTop = bounds.top + menuGap;
  const maxTop = bounds.bottom - menuEstHeight - menuGap;

  let left = position.x;
  let top  = position.y;

  if (anchorRect) {
    const preferredLeft = isOwn
      ? anchorRect.left - menuWidth - menuGap
      : anchorRect.right + menuGap;
    const fallbackLeft = isOwn
      ? anchorRect.right + menuGap
      : anchorRect.left - menuWidth - menuGap;
    const preferredFits = preferredLeft >= minLeft && preferredLeft <= maxLeft;
    const fallbackFits = fallbackLeft >= minLeft && fallbackLeft <= maxLeft;

    if (preferredFits || fallbackFits) {
      left = preferredFits ? preferredLeft : fallbackLeft;
      top = anchorRect.top;
    } else {
      left = isOwn ? anchorRect.right - menuWidth : anchorRect.left;
      top = anchorRect.bottom + menuGap;
      if (top + menuEstHeight > bounds.bottom - menuGap) {
        top = anchorRect.top - menuEstHeight - menuGap;
      }
    }
  }

  if (left > maxLeft) left = maxLeft;
  if (left < minLeft) left = minLeft;
  if (top > maxTop) top = Math.max(minTop, maxTop);
  if (top < minTop) top = minTop;

  const isText = !msg.type || msg.type === 'text';
  const canForward = msg.type !== 'system' && msg.type !== 'call';

  function doAndClose(fn) {
    return () => { fn(); onClose(); };
  }

  function handleReact(emoji) {
    onReact(emoji);
    onClose();
  }

  return (
    <>
      <div className="msg-ctx-backdrop" aria-hidden="true" onClick={e => { e.stopPropagation(); onClose(); }} />
      <div className="msg-ctx-menu" role="menu" aria-label="Berichtopties" style={{ left, top }} onClick={e => e.stopPropagation()}>

        {isOwn && msg.failed && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onRetry)}>
            <Refresh size={MENU_ICON_SIZE} className="msg-ctx-icon" style={{ color: '#f87171' }} aria-hidden="true" />
            <span>Opnieuw versturen</span>
          </button>
        )}

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onReply)}>
          <Reply size={MENU_ICON_SIZE} className="msg-ctx-icon" aria-hidden="true" />
          <span>Beantwoorden</span>
        </button>

        {isText && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onCopy)}>
            <Copy size={MENU_ICON_SIZE} className="msg-ctx-icon" aria-hidden="true" />
            <span>Kopiëren</span>
          </button>
        )}

        <button
          type="button"
          role="menuitem"
          className={`msg-ctx-item${reactionPickerOpen ? ' active' : ''}`}
          aria-expanded={reactionPickerOpen}
          onClick={() => setReactionPickerOpen((open) => !open)}
        >
          <Smile size={MENU_ICON_SIZE} className="msg-ctx-icon" aria-hidden="true" />
          <span>Reageren</span>
        </button>

        {reactionPickerOpen && (
          <div className="msg-ctx-emoji-row" role="group" aria-label="Snelle reacties">
            {QUICK_EMOJI.map((emoji) => (
              <button
                type="button"
                key={emoji}
                className="msg-ctx-emoji"
                aria-label={`Reageer met ${emoji}`}
                onClick={() => handleReact(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {canForward && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onForward)}>
            <Forward size={MENU_ICON_SIZE} className="msg-ctx-icon" aria-hidden="true" />
            <span>Doorsturen</span>
          </button>
        )}

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onPin)}>
          <Pin size={MENU_ICON_SIZE} className="msg-ctx-icon" style={{ transform: pinned ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true" />
          <span>{pinned ? 'Losmaken' : 'Vastzetten'}</span>
        </button>

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onStar)}>
          {starred
            ? <StarFilled  size={MENU_ICON_SIZE} className="msg-ctx-icon" style={{ color: '#f59e0b' }} aria-hidden="true" />
            : <StarOutline size={MENU_ICON_SIZE} className="msg-ctx-icon" aria-hidden="true" />}
          <span>{starred ? 'Ster verwijderen' : 'Met ster markeren'}</span>
        </button>

        {isOwn && isText && canEditMessage(msg) && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onEdit)}>
            <MagicEdit size={MENU_ICON_SIZE} className="msg-ctx-icon" aria-hidden="true" />
            <span>Bewerken</span>
          </button>
        )}

        <div className="msg-ctx-divider" />

        <button type="button" role="menuitem" className="msg-ctx-item danger" onClick={doAndClose(onDeleteRequest)}>
          <Delete size={MENU_ICON_SIZE} className="msg-ctx-icon" aria-hidden="true" />
          <span>Verwijderen</span>
        </button>
      </div>
    </>
  );
}
