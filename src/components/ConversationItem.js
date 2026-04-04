// src/components/ConversationItem.js
import React from 'react';
import { Pin, InfoIcon } from '../components/Icons';
import { getAttachmentContractPresentation } from '../lib/e2ee/attachmentPresentation';
import { getConversationPreview } from '../lib/e2ee/messageModel';
import UserAvatar from '../components/UserAvatar';
import { callPreview } from '../utils';

function convTime(val) {
  if (!val) return '';
  const d = val?.toDate ? val.toDate() : new Date(val);
  if (isNaN(d)) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  if (isYesterday) return 'Gisteren';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

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
  onMoreActionsEnter,
  onMoreActionsLeave,
}) {
  const attachmentPresentation = getAttachmentContractPresentation({
    transfer: conv.lastAttachmentTransfer,
    contentEncoding: conv.lastAttachmentEncoding,
    originalMimeType: conv.lastAttachmentOriginalMimeType,
    expectedPayloadSha256: conv.lastAttachmentExpectedPayloadSha256,
  });
  const showRemoteAttachmentBadge = conv.lastMessageType === 'attachment' && attachmentPresentation.isRemote;
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
          {conv.updatedAt && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)', fontWeight: 400, flexShrink: 0 }}>{convTime(conv.updatedAt)}</span>}
        </div>
        <div className="conv-preview">
          {conv.lastCallDirection ? callPreview(conv, currentUid) : (
            <>
              <span>{getConversationPreview(conv) || conv.lastMessage || 'Start een gesprek…'}</span>
              {showRemoteAttachmentBadge && (
                <>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                      opacity: 0.9,
                    }}
                  >
                    {attachmentPresentation.storageShortLabel}
                  </span>
                  {attachmentPresentation.mimeLabel && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        color: 'var(--text3)',
                        opacity: 0.9,
                      }}
                    >
                      {attachmentPresentation.mimeLabel}
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {unread > 0 && <span className="unread-badge" aria-label={`${unread} ongelezen ${unread === 1 ? 'bericht' : 'berichten'}`}>{unread}</span>}
      <button
        type="button"
        className="icon-btn"
        aria-label={`Meer acties voor ${conv.name}`}
        title="Meer acties"
        onClick={e => e.stopPropagation()}
        onMouseEnter={e => { e.stopPropagation(); onMoreActionsEnter?.(e.currentTarget); }}
        onMouseLeave={e => { e.stopPropagation(); onMoreActionsLeave?.(); }}
        onFocus={e => { e.stopPropagation(); onMoreActionsEnter?.(e.currentTarget); }}
      >
        <InfoIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

const ConversationItem = React.memo(ConversationItemBase, (prev, next) =>
  prev.conv.id          === next.conv.id          &&
  prev.conv.lastMessage === next.conv.lastMessage  &&
  prev.conv.lastMessageType === next.conv.lastMessageType &&
  prev.conv.lastAttachmentTransfer === next.conv.lastAttachmentTransfer &&
  prev.conv.lastAttachmentEncoding === next.conv.lastAttachmentEncoding &&
  prev.conv.lastAttachmentOriginalMimeType === next.conv.lastAttachmentOriginalMimeType &&
  prev.conv.lastAttachmentExpectedPayloadSha256 === next.conv.lastAttachmentExpectedPayloadSha256 &&
  prev.conv.updatedAt   === next.conv.updatedAt    &&
  prev.conv.photoURL    === next.conv.photoURL     &&
  prev.isActive         === next.isActive          &&
  prev.isOnline         === next.isOnline          &&
  prev.isInactive       === next.isInactive        &&
  prev.unread           === next.unread            &&
  prev.isPinned         === next.isPinned
);

export default ConversationItem;
