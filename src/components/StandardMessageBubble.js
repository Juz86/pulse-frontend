import React, { useMemo } from 'react';
import MessageReactionBar from './MessageReactionBar';
import TextMessageCard from './TextMessageCard';
import { normalizeSingleUserReaction } from '../lib/e2ee/messageReactions';

export default function StandardMessageBubble({
  presentation,
  onContextMenu,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onTouchCancel,
  onRetry,
  onReact,
  onShowContextMenu,
  onOpenReactionPicker,
  reactionPickerOpen,
  onCloseReactionPicker,
}) {
  const {
    msg,
    isOwn,
    isFocused,
    isGroup,
    contacts,
    currentUid,
    currentUser,
    memberNames,
    renderedContent,
    status,
    receiptSummaryLabel,
  } = presentation;
  const visibleReactions = useMemo(
    () => normalizeSingleUserReaction(msg.reactions, currentUid),
    [msg.reactions, currentUid],
  );
  const hasReactions = Object.values(visibleReactions).some((uids) => uids?.length > 0);

  return (
    <div
      className={`msg-group ${isOwn ? 'out' : 'in'}${hasReactions ? ' has-reactions' : ''}`}
      role="listitem"
      ref={isFocused ? el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchCancel={onTouchCancel}
    >
      {!isOwn && isGroup && <div className="msg-sender">{msg.senderName}</div>}
      <TextMessageCard
        msg={msg}
        isOwn={isOwn}
        isFocused={isFocused}
        renderedContent={renderedContent}
        status={status}
        receiptSummaryLabel={receiptSummaryLabel}
        onRetry={onRetry}
        onReact={onReact}
        onShowContextMenu={onShowContextMenu}
        onOpenReactionPicker={onOpenReactionPicker}
        reactionPickerOpen={reactionPickerOpen}
        onCloseReactionPicker={onCloseReactionPicker}
      />
      <MessageReactionBar
        reactions={visibleReactions}
        currentUid={currentUid}
        currentUser={currentUser}
        contacts={contacts}
        memberNames={memberNames}
        onReact={onReact}
      />
    </div>
  );
}
