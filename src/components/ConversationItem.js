// src/components/ConversationItem.js
import React from 'react';
import { Pin, MoreHoriz } from '../components/Icons';
import { buildConversationPreviewPresentation } from '../lib/e2ee/conversationSummaries';
import UserAvatar from '../components/UserAvatar';
import { formatConversationListTime } from '../utils';

function ConversationItemBase({
  conv,
  isActive,
  otherUid,
  isOnline,
  isInactive,
  unread,
  manuallyUnread,
  typingName,
  draftPreview,
  isPinned,
  currentUid,
  selectionMode,
  isSelected,
  isSwipedOpen,
  onRequestSwipeOpen,
  onRequestSwipeClose,
  onToggleSelect,
  onOpen,
  onSwipeMoreActions,
}) {
  const SWIPE_ACTION_WIDTH = 92;
  const SWIPE_OPEN_THRESHOLD = 42;
  const SWIPE_CLOSE_THRESHOLD = 28;
  const [swipeOffset, setSwipeOffset] = React.useState(0);
  const pointerStateRef = React.useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffset: 0,
    dragging: false,
    lockAxis: null,
    moved: false,
  });
  const conversationPreview = buildConversationPreviewPresentation(conv);
  const reactionPreviewText = React.useMemo(() => {
    if (!conv.lastReactionEmoji || !conv.lastReactionReactorId) return '';
    const reactorName = conv.lastReactionReactorId === currentUid
      ? 'Je'
      : (conv.memberNames?.[conv.lastReactionReactorId] || 'Iemand');
    const targetText = String(conv.lastMessage || 'een bericht')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 72);
    return `${reactorName} reageerde met ${conv.lastReactionEmoji} op: “${targetText || 'een bericht'}”`;
  }, [conv.lastMessage, conv.lastReactionEmoji, conv.lastReactionReactorId, conv.memberNames, currentUid]);
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  const handleOpen = () => {
    if (pointerStateRef.current.moved) {
      pointerStateRef.current.moved = false;
      return;
    }
    if (isSwipedOpen) {
      onRequestSwipeClose?.();
      return;
    }
    if (selectionMode) {
      onToggleSelect?.(conv.id);
      return;
    }
    onOpen();
  };

  React.useEffect(() => {
    if (selectionMode && isSwipedOpen) onRequestSwipeClose?.();
  }, [selectionMode, isSwipedOpen, onRequestSwipeClose]);

  React.useEffect(() => {
    setSwipeOffset(isSwipedOpen ? -SWIPE_ACTION_WIDTH : 0);
  }, [isSwipedOpen]);

  const onPointerDown = (event) => {
    if (selectionMode) return;
    pointerStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: swipeOffset,
      dragging: false,
      lockAxis: null,
      moved: false,
    };
  };

  const onPointerMove = (event) => {
    const state = pointerStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.lockAxis) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 8 && absY < 8) return;
      state.lockAxis = absX > absY ? 'x' : 'y';
    }
    if (state.lockAxis !== 'x') return;
    state.dragging = true;
    state.moved = true;
    const next = Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, state.startOffset + dx));
    setSwipeOffset(next);
  };

  const closeSwipe = () => {
    onRequestSwipeClose?.();
  };

  const onPointerUp = (event) => {
    const state = pointerStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    pointerStateRef.current.active = false;
    if (!state.dragging) return;
    const shouldOpen = swipeOffset <= -SWIPE_OPEN_THRESHOLD || (isSwipedOpen && swipeOffset <= -SWIPE_CLOSE_THRESHOLD);
    if (shouldOpen) {
      onRequestSwipeOpen?.();
    } else {
      closeSwipe();
    }
    pointerStateRef.current.moved = true;
  };

  const onPointerCancel = (event) => {
    const state = pointerStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    pointerStateRef.current.active = false;
    if (!isSwipedOpen) setSwipeOffset(0);
  };

  return (
    <div
      className={`conv-item-swipe-shell ${isSwipedOpen ? 'swiped-open' : ''}`}
    >
      <div className="conv-item-swipe-actions" aria-hidden={!isSwipedOpen}>
        <button
          type="button"
          className="conv-swipe-action-btn conv-swipe-more-btn"
          aria-label={`Meer acties voor ${conv.name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            closeSwipe();
            onSwipeMoreActions?.();
          }}
        >
          <MoreHoriz size={20} aria-hidden="true" />
        </button>
      </div>
      <div
      className={`conv-item ${isActive ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      style={{ transform: `translateX(${swipeOffset}px)` }}
    >
      {selectionMode && (
        <label
          style={{ display: 'flex', alignItems: 'center', marginRight: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect?.(conv.id)}
            aria-label={`${conv.name} selecteren`}
          />
        </label>
      )}
      <div className="avatar-wrap">
        <UserAvatar photoURL={conv.photoURL || null} displayName={conv.name || conv.id} decorative />
        {isOnline && <span className={`online-dot${isInactive ? ' inactive' : ''}`} aria-hidden="true" />}
      </div>
      <div className="conv-info">
        <div className="conv-name-row">
          <div className="conv-name">
            {conv.name}
            {isPinned && <span aria-hidden="true"><Pin size={11} style={{ color: 'var(--accent,#7c3aed)', flexShrink: 0, opacity: 0.7 }} /></span>}
          </div>
          <div className="conv-meta">
            {(conv.updatedAt || conv.lastMessageAt) && (
              <span className="conv-meta-time">{formatConversationListTime(conv.updatedAt || conv.lastMessageAt)}</span>
            )}
            {manuallyUnread && (
              <span className="unread-badge unread-badge--marked" aria-label="Gemarkeerd als ongelezen" />
            )}
          </div>
        </div>
        <div className="conv-preview">
          {draftPreview ? (
            <span className="conv-draft-preview" aria-label={`Concept: ${draftPreview}`}>
              <span className="conv-draft-label">Concept:</span>
              <span className="conv-preview-text">{draftPreview}</span>
            </span>
          ) : typingName ? (
            <span className="conv-typing-pill" aria-label={`${typingName} typt`}>
              <span className="conv-typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </span>
          ) : (
            <>
              <span className={`conv-preview-text${reactionPreviewText ? ' conv-reaction-preview' : ''}`}>
                {reactionPreviewText || conversationPreview.previewText || conv.lastMessage || 'Start een gesprek…'}
              </span>
              {conversationPreview.showRemoteAttachmentBadge && (
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
                    {conversationPreview.storageShortLabel}
                  </span>
                  {conversationPreview.mimeLabel && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        color: 'var(--text3)',
                        opacity: 0.9,
                      }}
                    >
                      {conversationPreview.mimeLabel}
                    </span>
                  )}
                  {conversationPreview.strategyHintLabel && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        color: 'var(--text3)',
                        opacity: 0.9,
                      }}
                    >
                      {conversationPreview.strategyHintLabel}
                    </span>
                  )}
                  {conversationPreview.availabilityHintLabel && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        color: 'var(--text3)',
                        opacity: 0.82,
                      }}
                    >
                      {conversationPreview.availabilityHintLabel}
                    </span>
                  )}
                  {(conversationPreview.storageDetail || conversationPreview.keyContractDetail) && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        color: 'var(--text3)',
                        opacity: 0.82,
                      }}
                      title={[conversationPreview.storageDetail, conversationPreview.keyContractDetail].filter(Boolean).join(' · ')}
                    >
                      {conversationPreview.keyContractDetail ? 'key-contract' : 'envelope'}
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {!manuallyUnread && unread > 0 && (
        <span className="unread-badge" aria-label={`${unread} ongelezen ${unread === 1 ? 'bericht' : 'berichten'}`}>{unread}</span>
      )}
      </div>
    </div>
  );
}

const ConversationItem = React.memo(ConversationItemBase, (prev, next) =>
  prev.conv.id          === next.conv.id          &&
  prev.conv.lastMessage === next.conv.lastMessage  &&
  prev.conv.lastMessageType === next.conv.lastMessageType &&
  prev.conv.lastAttachmentTransfer === next.conv.lastAttachmentTransfer &&
  prev.conv.lastAttachmentStrategyKey === next.conv.lastAttachmentStrategyKey &&
  prev.conv.lastAttachmentEncoding === next.conv.lastAttachmentEncoding &&
  prev.conv.lastAttachmentEnvelopeKind === next.conv.lastAttachmentEnvelopeKind &&
  prev.conv.lastAttachmentName === next.conv.lastAttachmentName &&
  prev.conv.lastAttachmentOriginalMimeType === next.conv.lastAttachmentOriginalMimeType &&
  prev.conv.lastAttachmentExpectedPayloadSha256 === next.conv.lastAttachmentExpectedPayloadSha256 &&
  prev.conv.lastAttachmentMediaKeyId === next.conv.lastAttachmentMediaKeyId &&
  prev.conv.lastAttachmentKeyWrapAlg === next.conv.lastAttachmentKeyWrapAlg &&
  prev.conv.lastAttachmentWrappedMediaKeyDigest === next.conv.lastAttachmentWrappedMediaKeyDigest &&
  prev.conv.updatedAt   === next.conv.updatedAt    &&
  prev.conv.lastMessageAt === next.conv.lastMessageAt &&
  prev.conv.lastReactionMessageId === next.conv.lastReactionMessageId &&
  prev.conv.lastReactionEmoji === next.conv.lastReactionEmoji &&
  prev.conv.lastReactionReactorId === next.conv.lastReactionReactorId &&
  prev.conv.photoURL    === next.conv.photoURL     &&
  prev.isActive         === next.isActive          &&
  prev.isOnline         === next.isOnline          &&
  prev.isInactive       === next.isInactive        &&
  prev.unread           === next.unread            &&
  prev.manuallyUnread   === next.manuallyUnread    &&
  prev.typingName       === next.typingName        &&
  prev.draftPreview     === next.draftPreview      &&
  prev.isPinned         === next.isPinned          &&
  prev.isSwipedOpen     === next.isSwipedOpen      &&
  prev.selectionMode    === next.selectionMode     &&
  prev.isSelected       === next.isSelected
);

export default ConversationItem;
