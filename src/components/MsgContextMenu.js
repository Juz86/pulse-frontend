// src/components/MsgContextMenu.js
import React, { useState } from 'react';
import { canEditMessage } from '../lib/e2ee/policy';
import {
  InfoIcon, Reply, Copy, Smile, Forward, Pin, StarFilled, StarOutline,
  MagicEdit, Delete, Refresh,
} from './Icons';

const QUICK_EMOJI = ['❤️', '👍', '😂', '😮', '😢', '👎'];

export default function MsgContextMenu({
  msg, isOwn, position, starred, pinned,
  onClose, onInfo, onReply, onCopy, onReact, onForward, onPin, onStar, onEdit,
  onDeleteRequest, onRetry,
}) {
  const menuWidth     = 234;
  const menuEstHeight = 380;
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  let left = position.x;
  let top  = position.y;
  if (left + menuWidth > window.innerWidth - 8)     left = window.innerWidth - menuWidth - 8;
  if (left < 8)                                      left = 8;
  if (top + menuEstHeight > window.innerHeight - 8)  top = Math.max(8, window.innerHeight - menuEstHeight - 8);

  const isText = !msg.type;

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
            <Refresh size={18} className="msg-ctx-icon" style={{ color: '#f87171' }} aria-hidden="true" />
            <span>Opnieuw versturen</span>
          </button>
        )}

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onInfo)}>
          <InfoIcon size={18} className="msg-ctx-icon" aria-hidden="true" />
          <span>Berichtinformatie</span>
        </button>

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onReply)}>
          <Reply size={18} className="msg-ctx-icon" aria-hidden="true" />
          <span>Beantwoorden</span>
        </button>

        {isText && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onCopy)}>
            <Copy size={18} className="msg-ctx-icon" aria-hidden="true" />
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
          <Smile size={18} className="msg-ctx-icon" aria-hidden="true" />
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

        {isText && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onForward)}>
            <Forward size={18} className="msg-ctx-icon" aria-hidden="true" />
            <span>Doorsturen</span>
          </button>
        )}

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onPin)}>
          <Pin size={18} className="msg-ctx-icon" style={{ transform: pinned ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true" />
          <span>{pinned ? 'Losmaken' : 'Vastzetten'}</span>
        </button>

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onStar)}>
          {starred
            ? <StarFilled  size={18} className="msg-ctx-icon" style={{ color: '#f59e0b' }} aria-hidden="true" />
            : <StarOutline size={18} className="msg-ctx-icon" aria-hidden="true" />}
          <span>{starred ? 'Ster verwijderen' : 'Met ster markeren'}</span>
        </button>

        {isOwn && isText && canEditMessage(msg) && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onEdit)}>
            <MagicEdit size={18} className="msg-ctx-icon" aria-hidden="true" />
            <span>Bewerken</span>
          </button>
        )}

        <div className="msg-ctx-divider" />

        <button type="button" role="menuitem" className="msg-ctx-item danger" onClick={doAndClose(onDeleteRequest)}>
          <Delete size={18} className="msg-ctx-icon" aria-hidden="true" />
          <span>Verwijderen</span>
        </button>
      </div>
    </>
  );
}
