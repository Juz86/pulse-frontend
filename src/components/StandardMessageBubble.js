import React from 'react';
import MessageReactionBar from './MessageReactionBar';
import TextMessageCard from './TextMessageCard';

export default function StandardMessageBubble({
  presentation,
  onContextMenu,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onRetry,
  onReact,
  onShowContextMenu,
}) {
  const {
    msg,
    isOwn,
    isFocused,
    isGroup,
    currentUid,
    renderedContent,
    status,
    receiptSummaryLabel,
  } = presentation;
  const hasReactions = !!msg.reactions && Object.values(msg.reactions).some((uids) => uids?.length > 0);

  return (
    <div
      className={`msg-group ${isOwn ? 'out' : 'in'}${hasReactions ? ' has-reactions' : ''}`}
      role="listitem"
      ref={isFocused ? el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
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
      />
      <MessageReactionBar
        reactions={msg.reactions}
        currentUid={currentUid}
        onReact={onReact}
      />
    </div>
  );
}
