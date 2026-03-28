// src/components/MsgContextMenu.js
import React from 'react';
import {
  Reply, Copy, Share, Pin, StarFilled, StarOutline,
  MagicEdit, Delete, Refresh, ErrorIcon,
} from './Icons';

export default function MsgContextMenu({
  msg, isOwn, position, starred, pinned,
  onClose, onReply, onCopy, onForward, onPin, onStar, onEdit,
  onDeleteRequest, onRetry,
}) {
  const menuWidth     = 234;
  const menuEstHeight = 290;

  let left = position.x;
  let top  = position.y;
  if (left + menuWidth > window.innerWidth - 8)     left = window.innerWidth - menuWidth - 8;
  if (left < 8)                                      left = 8;
  if (top + menuEstHeight > window.innerHeight - 8)  top = Math.max(8, window.innerHeight - menuEstHeight - 8);

  const isText = !msg.type;

  function doAndClose(fn) {
    return () => { fn(); onClose(); };
  }

  return (
    <>
      <div className="msg-ctx-backdrop" aria-hidden="true" onClick={e => { e.stopPropagation(); onClose(); }} />
      <div className="msg-ctx-menu" role="menu" aria-label="Berichtopties" style={{ left, top }} onClick={e => e.stopPropagation()}>

        {isOwn && msg.failed && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onRetry)}>
            <Refresh size={18} className="msg-ctx-icon" style={{ color: '#f87171' }} />
            <span>Opnieuw versturen</span>
          </button>
        )}

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onReply)}>
          <Reply size={18} className="msg-ctx-icon" />
          <span>Beantwoorden</span>
        </button>

        {isText && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onCopy)}>
            <Copy size={18} className="msg-ctx-icon" />
            <span>Kopiëren</span>
          </button>
        )}

        {isText && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onForward)}>
            <Share size={18} className="msg-ctx-icon" />
            <span>Doorsturen</span>
          </button>
        )}

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onPin)}>
          <Pin size={18} className="msg-ctx-icon" style={{ transform: pinned ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }} />
          <span>{pinned ? 'Losmaken' : 'Vastzetten'}</span>
        </button>

        <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onStar)}>
          {starred
            ? <StarFilled  size={18} className="msg-ctx-icon" style={{ color: '#f59e0b' }} />
            : <StarOutline size={18} className="msg-ctx-icon" />}
          <span>{starred ? 'Ster verwijderen' : 'Met ster markeren'}</span>
        </button>

        {isOwn && isText && (
          <button type="button" role="menuitem" className="msg-ctx-item" onClick={doAndClose(onEdit)}>
            <MagicEdit size={18} className="msg-ctx-icon" />
            <span>Bewerken</span>
          </button>
        )}

        <div className="msg-ctx-divider" />

        <button type="button" role="menuitem" className="msg-ctx-item danger" onClick={doAndClose(onDeleteRequest)}>
          <Delete size={18} className="msg-ctx-icon" />
          <span>Verwijderen</span>
        </button>
      </div>
    </>
  );
}
