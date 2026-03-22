// src/components/ConversationItem.js
import React from 'react';
import { Phone, Video, Delete, Pin } from '../components/Icons';
import UserAvatar from '../components/UserAvatar';
import { callPreview } from '../utils';

const ConversationItem = React.memo(function ConversationItem({
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
}) {
  return (
    <div
      className={`conv-item ${isActive ? 'active' : ''}`}
      onClick={onOpen}
    >
      <div className="avatar-wrap">
        <UserAvatar photoURL={conv.photoURL || null} displayName={conv.name || conv.id} />
        {isOnline && <span className={`online-dot${isInactive ? ' inactive' : ''}`} />}
      </div>
      <div className="conv-info">
        <div className="conv-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {conv.name}
          {isPinned && <Pin size={11} style={{ color: 'var(--accent,#7c3aed)', flexShrink: 0, opacity: 0.7 }} />}
        </div>
        <div className="conv-preview">
          {conv.lastCallDirection ? callPreview(conv, currentUid) : (conv.lastMessage || 'Start een gesprek…')}
        </div>
      </div>
      {unread > 0 && <span className="unread-badge">{unread}</span>}
      {!conv.isGroup && (
        <>
          <button className="call-btn voice" onClick={onCallVoice} title="Bellen"><Phone size={16} /></button>
          <button className="call-btn video" onClick={onCallVideo} title="Videobellen"><Video size={16} /></button>
        </>
      )}
      <button className="conv-delete-btn" onClick={onDelete} title="Verwijderen"><Delete size={16} /></button>
    </div>
  );
});

export default ConversationItem;
