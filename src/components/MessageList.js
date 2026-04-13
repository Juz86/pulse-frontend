// src/components/MessageList.js
import React, { useMemo, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import { formatDateLabel } from '../utils';

const MessageList = React.memo(function MessageList({
  user,
  messages,
  activeConv,
  currentUid,
  chatSearch,
  chatSearchIdx,
  chatBg,
  chatFading,
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
  onRetry,
  onStartCall,
  onViewContact,
  jumpToMsgId,
  selectionMode = false,
  selectedMessageIds = [],
  onToggleMessageSelection,
}) {
  const focusedMsgId = useMemo(() => {
    if (jumpToMsgId) return jumpToMsgId;
    if (!chatSearch.trim()) return null;
    const matches = messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase()));
    return matches[chatSearchIdx % (matches.length || 1)]?.id ?? null;
  }, [messages, chatSearch, chatSearchIdx, jumpToMsgId]);

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

      const isOwn     = msg.senderId === currentUid;
      const isFocused = msg.id === focusedMsgId;

      result.push(
        <div
          key={msg._key || msg.id || i}
          className={`message-select-wrap${selectionMode ? ' selection-mode' : ''}${selectedMessageIds.includes(msg.id) ? ' selected' : ''}`}
          onClick={selectionMode ? () => onToggleMessageSelection?.(msg.id) : undefined}
          role={selectionMode ? 'button' : undefined}
          tabIndex={selectionMode ? 0 : undefined}
          onKeyDown={selectionMode ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggleMessageSelection?.(msg.id);
            }
          } : undefined}
          aria-pressed={selectionMode ? selectedMessageIds.includes(msg.id) : undefined}
        >
          {selectionMode && (
            <span className={`message-select-indicator${selectedMessageIds.includes(msg.id) ? ' selected' : ''}`} aria-hidden="true">
              {selectedMessageIds.includes(msg.id) ? '✓' : ''}
            </span>
          )}
          <MessageBubble
            msg={msg}
            isOwn={isOwn}
            isFocused={isFocused}
            isGroup={!!activeConv.isGroup}
            memberNames={activeConv.memberNames}
            currentUid={currentUid}
            user={user}
            chatSearch={chatSearch}
            onReact={emoji => onReact(msg.id, emoji)}
            onShowContextMenu={selectionMode ? (() => {}) : (e => onShowContextMenu(e, msg))}
            onRetry={() => onRetry(msg)}
            onStartCall={isVideo => onStartCall?.({ toUid: msg.senderId, convId: activeConv.id, name: msg.senderName, isVideo })}
            onViewContact={sc => onViewContact(sc)}
          />
        </div>
      );
    });

    return result;
  }, [messages, activeConv, currentUid, user, chatSearch, focusedMsgId,
      onReact, onShowContextMenu, onRetry, onStartCall, onViewContact, selectionMode, selectedMessageIds, onToggleMessageSelection]);

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
      className={`messages-area${chatFading ? ' chat-fading' : ''}`}
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
        <div className="msg-skeleton-wrap">
          {[80, 55, 70, 40, 65].map((w, i) => (
            <div key={i} className={`msg-skeleton ${i % 2 === 0 ? 'out' : 'in'}`} aria-hidden="true">
              <div className="skeleton-bubble" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : items}

      <div ref={msgEndRef} />
    </div>
    </div>
  );
});

export default MessageList;
