// src/components/ConversationItem.js
import React from 'react';
import { Phone, Video, Delete, Pin, InfoIcon } from '../components/Icons';
import UserAvatar from '../components/UserAvatar';
import { callPreview } from '../utils';

function ConversationItemBase({
  conv,
  isActive,
  otherUid,
  isOnline,
  isInactive,
  unread,
  isPinned,
  currentUid,
  onOpen,
  onCallVoice,
  onCallVideo,
  onDelete,
  onInfo,
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      className={`conv-item ${isActive ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="avatar-wrap">
        <UserAvatar photoURL={conv.photoURL || null} displayName={conv.name || conv.id} decorative />
        {isOnline && <span className={`online-dot${isInactive ? ' inactive' : ''}`} aria-hidden="true" />}
      </div>
      <div className="conv-info">
        <div className="conv-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {conv.name}
          {isPinned && <span aria-hidden="true"><Pin size={11} style={{ color: 'var(--accent,#7c3aed)', flexShrink: 0, opacity: 0.7 }} /></span>}
        </div>
        <div className="conv-preview">
          {conv.lastCallDirection ? callPreview(conv, currentUid) : (conv.lastMessage || 'Start een gesprek…')}
        </div>
      </div>
      {unread > 0 && <span className="unread-badge" aria-label={`${unread} ongelezen ${unread === 1 ? 'bericht' : 'berichten'}`}>{unread}</span>}
      {!conv.isGroup && (
        <>
          <button type="button" className="icon-btn" aria-label={`Informatie over ${conv.name}`} onClick={onInfo} title="Informatie"><InfoIcon size={16} aria-hidden="true" /></button>
          <button type="button" className="call-btn voice" aria-label={`Bel ${conv.name}`} onClick={onCallVoice} title="Bellen"><Phone size={16} aria-hidden="true" /></button>
          <button type="button" className="call-btn video" aria-label={`Videobel ${conv.name}`} onClick={onCallVideo} title="Videobellen"><Video size={16} aria-hidden="true" /></button>
        </>
      )}
      <button type="button" className="conv-delete-btn" aria-label={`Verwijder gesprek met ${conv.name}`} onClick={onDelete} title="Verwijderen"><Delete size={16} aria-hidden="true" /></button>
    </div>
  );
}

const ConversationItem = React.memo(ConversationItemBase, (prev, next) =>
  prev.conv.id          === next.conv.id          &&
  prev.conv.lastMessage === next.conv.lastMessage  &&
  prev.conv.updatedAt   === next.conv.updatedAt    &&
  prev.conv.photoURL    === next.conv.photoURL     &&
  prev.isActive         === next.isActive          &&
  prev.isOnline         === next.isOnline          &&
  prev.isInactive       === next.isInactive        &&
  prev.unread           === next.unread            &&
  prev.isPinned         === next.isPinned
);

export default ConversationItem;
