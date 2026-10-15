// src/components/MessageList.js
import React, { useMemo, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';
import { formatDateLabel } from '../utils';

const NOOP = () => {};

const MessageListRow = React.memo(function MessageListRow({
  msg,
  isFocused,
  activeConv,
  currentUid,
  contacts,
  currentUser,
  user,
  chatSearch,
  selectionMode,
  isSelected,
  onToggleMessageSelection,
  onReact,
  onShowContextMenu,
  onOpenReactionPicker,
  reactionPickerOpen,
  onCloseReactionPicker,
  onRetry,
  onViewContact,
  onStartAudioCall,
  onStartVideoCall,
}) {
  const isOwn = msg.senderId === currentUid;

  const handleSelect = useCallback(() => {
    onToggleMessageSelection?.(msg.id);
  }, [msg.id, onToggleMessageSelection]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleMessageSelection?.(msg.id);
    }
  }, [msg.id, onToggleMessageSelection]);

  const handleReact = useCallback((emoji) => {
    onReact(msg.id, emoji);
  }, [msg.id, onReact]);

  const handleShowContextMenu = useCallback((event) => {
    onShowContextMenu(event, msg);
  }, [msg, onShowContextMenu]);

  const handleOpenReactionPicker = useCallback(() => {
    onOpenReactionPicker?.(msg.id);
  }, [msg.id, onOpenReactionPicker]);

  const handleCloseReactionPicker = useCallback(() => {
    onCloseReactionPicker?.();
  }, [onCloseReactionPicker]);

  const handleRetry = useCallback(() => {
    onRetry(msg);
  }, [msg, onRetry]);

  return (
    <div
      className={`message-select-wrap${selectionMode ? ' selection-mode' : ''}${isSelected ? ' selected' : ''}`}
      onClick={selectionMode ? handleSelect : undefined}
      role={selectionMode ? 'button' : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onKeyDown={selectionMode ? handleKeyDown : undefined}
      aria-pressed={selectionMode ? isSelected : undefined}
    >
      {selectionMode && (
        <span className={`message-select-indicator${isSelected ? ' selected' : ''}`} aria-hidden="true">
          {isSelected ? '✓' : ''}
        </span>
      )}
      <MessageBubble
        msg={msg}
        isOwn={isOwn}
        isFocused={isFocused}
        isGroup={!!activeConv.isGroup}
        memberNames={activeConv.memberNames}
        contacts={contacts}
        currentUid={currentUid}
        currentUser={currentUser}
        user={user}
        chatSearch={chatSearch}
        onReact={handleReact}
        onShowContextMenu={selectionMode ? NOOP : handleShowContextMenu}
        onOpenReactionPicker={selectionMode ? undefined : handleOpenReactionPicker}
        reactionPickerOpen={reactionPickerOpen}
        onCloseReactionPicker={handleCloseReactionPicker}
        onRetry={handleRetry}
        onViewContact={onViewContact}
        onStartAudioCall={onStartAudioCall}
        onStartVideoCall={onStartVideoCall}
      />
    </div>
  );
});

const MessageList = React.memo(function MessageList({
  user,
  contacts = [],
  currentUserPhotoURL = null,
  messages,
  activeConv,
  currentUid,
  chatSearch,
  chatSearchIdx,
  chatBg,
  hasMore,
  loadingMore,
  loadingMsgs,
  showChatSearch,
  msgsAreaRef,
  msgEndRef,
  onLoadMore,
  onCloseSearch,
  onReact,
  onShowContextMenu,
  onOpenReactionPicker,
  reactionPickerMsgId,
  onCloseReactionPicker,
  onRetry,
  onViewContact,
  onStartAudioCall,
  onStartVideoCall,
  jumpToMsgId,
  typing = false,
  typingName = '',
  selectionMode = false,
  selectedMessageIds = [],
  onToggleMessageSelection,
}) {
  const currentUser = useMemo(() => ({
    displayName: user.displayName || user.email,
    email: user.email,
    photoURL: currentUserPhotoURL || user.photoURL || null,
  }), [currentUserPhotoURL, user.displayName, user.email, user.photoURL]);
  const normalizedChatSearch = chatSearch.trim().toLowerCase();
  const selectedMessageIdSet = useMemo(() => new Set(selectedMessageIds), [selectedMessageIds]);
  const searchMatches = useMemo(() => {
    if (!normalizedChatSearch) return [];
    return messages.filter((message) => getMessageDisplayText(message).toLowerCase().includes(normalizedChatSearch));
  }, [messages, normalizedChatSearch]);

  const focusedMsgId = useMemo(() => {
    if (jumpToMsgId) return jumpToMsgId;
    if (searchMatches.length === 0) return null;
    return searchMatches[chatSearchIdx % searchMatches.length]?.id ?? null;
  }, [searchMatches, chatSearchIdx, jumpToMsgId]);

  const items = useMemo(() => {
    if (!activeConv) return [];
    const result = [];
    let lastDate = null;

    messages.forEach((msg, i) => {
      const label = formatDateLabel(msg.createdAt);
      if (label && label !== lastDate && msg.type !== 'call' && msg.type !== 'contact') {
        lastDate = label;
        result.push(<div key={`date-${i}`} className="msg-date-sep" role="separator" aria-label={`Berichten van ${label}`}><span>{label}</span></div>);
      } else if (label && label !== lastDate) {
        lastDate = label;
      }

      const isFocused = msg.id === focusedMsgId;

      result.push(
        <MessageListRow
          key={msg._key || msg.id || i}
          msg={msg}
          isFocused={isFocused}
          activeConv={activeConv}
          currentUid={currentUid}
          contacts={contacts}
          currentUser={currentUser}
          user={user}
          chatSearch={chatSearch}
          selectionMode={selectionMode}
          isSelected={selectedMessageIdSet.has(msg.id)}
          onToggleMessageSelection={onToggleMessageSelection}
          onReact={onReact}
          onShowContextMenu={onShowContextMenu}
          onOpenReactionPicker={onOpenReactionPicker}
          reactionPickerOpen={reactionPickerMsgId === msg.id}
          onCloseReactionPicker={onCloseReactionPicker}
          onRetry={onRetry}
          onViewContact={onViewContact}
          onStartAudioCall={selectionMode ? undefined : onStartAudioCall}
          onStartVideoCall={selectionMode ? undefined : onStartVideoCall}
        />
      );
    });

    return result;
  }, [messages, activeConv, currentUid, currentUser, user, contacts, chatSearch, focusedMsgId, selectedMessageIdSet,
      onReact, onShowContextMenu, onOpenReactionPicker, reactionPickerMsgId, onCloseReactionPicker,
      onRetry, onViewContact, onStartAudioCall, onStartVideoCall, selectionMode, onToggleMessageSelection]);

  const bgStyle = useMemo(() => {
    if (chatBg?.type === 'photo') return {
      backgroundImage: `url(${chatBg.url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
    if (chatBg?.type === 'color') return { background: chatBg.value };
    return {};
  }, [chatBg]);

  const handleAreaClick = useCallback(() => {
    if (showChatSearch) onCloseSearch();
  }, [showChatSearch, onCloseSearch]);

  return (
    <div className={`messages-area-wrap${chatBg ? ' has-chat-bg' : ''}`} style={bgStyle}>
    <div
      id="chat-messages-log"
      className="messages-area"
      role="log"
      aria-label={activeConv ? `Berichten in gesprek met ${activeConv.isGroup ? (activeConv.name || 'groep') : (activeConv.name || activeConv.memberNames?.[activeConv.members?.find(m => m !== currentUid)] || 'contact')}` : 'Berichten'}
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
      aria-busy={loadingMsgs || loadingMore}
      ref={msgsAreaRef}
      onClick={handleAreaClick}
    >
      {hasMore && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <button type="button" className="load-more-btn" aria-controls="chat-messages-log" aria-busy={loadingMore} aria-label={loadingMore ? 'Oudere berichten laden' : 'Laad meer berichten'} onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Laden…' : <><span aria-hidden="true">↑ </span>Meer berichten laden</>}
          </button>
        </div>
      )}

      {loadingMsgs ? (
        <div className="msg-loading-state" role="status" aria-live="polite">
          Berichten laden...
        </div>
      ) : items.length === 0 ? (
        <div className="msg-empty-state" role="status" aria-live="polite">
          Nog geen berichten. Stuur het eerste bericht wanneer je zover bent.
        </div>
      ) : items}

      {typing && !loadingMsgs && (
        <div className="msg-group in typing-indicator-group" role="status" aria-live="polite" aria-label={`${typingName || 'Iemand'} typt`}>
          <div className="msg-bubble-wrap">
            <div className="msg-bubble msg-typing-bubble">
              <span className="sr-only">{typingName || 'Iemand'} typt…</span>
              <span className="msg-typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={msgEndRef} />
    </div>
    </div>
  );
});

export default MessageList;
