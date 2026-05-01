// src/components/ConversationList.js
import React, { useMemo } from 'react';
import ConversationItem from './ConversationItem';
import { toMs } from '../utils';

const ConversationList = React.memo(function ConversationList({
  conversations,
  activeConv,
  loadingConvs,
  searchQuery,
  chatFilter,
  selectedGroupId,
  convLabels,
  pinnedContacts,
  unreadCounts,
  typingByConv,
  onlineUsers,
  inactiveUsers,
  currentUid,
  selectionMode,
  selectedConversationIds,
  onToggleSelectConversation,
  getConvName,
  getOtherUid,
  getConvPhoto,
  onOpen,
  onMoreActionsEnter,
  onSwipeMoreActions,
  setLabelMenuConvId,
}) {
  const [swipedConvId, setSwipedConvId] = React.useState(null);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const pinnedUidSet = useMemo(() => new Set(pinnedContacts), [pinnedContacts]);

  const filtered = useMemo(() => {
    return conversations
      .filter(conv => {
        const matchSearch = !normalizedSearch ||
          getConvName(conv).toLowerCase().includes(normalizedSearch) ||
          (conv.lastMessage || '').toLowerCase().includes(normalizedSearch);
        const matchFilter = chatFilter === 'all'
          || (chatFilter === 'groepen' && conv.isGroup && (!selectedGroupId || conv.id === selectedGroupId))
          || convLabels[conv.id] === chatFilter;
        return matchSearch && matchFilter;
      })
      .sort((a, b) => {
        const aPinned = pinnedUidSet.has(getOtherUid(a));
        const bPinned = pinnedUidSet.has(getOtherUid(b));
        if (aPinned !== bPinned) return bPinned - aPinned;
        return toMs(b.updatedAt || b.lastMessageAt || b.createdAt) - toMs(a.updatedAt || a.lastMessageAt || a.createdAt);
      })
      .map(conv => ({
        ...conv,
        name:     getConvName(conv),
        photoURL: getConvPhoto(conv),
      }));
  }, [conversations, normalizedSearch, chatFilter, selectedGroupId, convLabels, pinnedUidSet, getConvName, getOtherUid, getConvPhoto]);

  return (
    <div className="conv-list" aria-busy={loadingConvs} onClick={() => setLabelMenuConvId(null)}>
      {loadingConvs && [0, 1, 2, 3].map(i => (
        <div key={i} className="conv-item skeleton-item" aria-hidden="true">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line wide" />
            <div className="skeleton-line narrow" />
          </div>
        </div>
      ))}

      {!loadingConvs && conversations.length === 0 && (
        <div className="empty-convs" role="status" aria-live="polite">
          <p>Start een gesprek.</p>
        </div>
      )}

      {!loadingConvs && conversations.length > 0 && filtered.length === 0 && (
        <div className="empty-convs" role="status" aria-live="polite">
          <p>Geen gesprekken gevonden.</p>
          <p>
            {searchQuery.trim()
              ? `Er zijn geen resultaten voor "${searchQuery}".`
              : 'Er zijn geen gesprekken die bij het gekozen filter passen.'}
          </p>
        </div>
      )}

      {filtered.map(conv => {
        const otherUid  = getOtherUid(conv);
        const isOnline  = !!(otherUid && onlineUsers.has(otherUid));
        const isInactive = isOnline && inactiveUsers.has(otherUid);
        const unread    = unreadCounts[conv.id] || 0;
        const isPinned  = pinnedUidSet.has(otherUid);
        return (
          <ConversationItem
            key={conv.id}
            conv={conv}
            isActive={activeConv?.id === conv.id}
            otherUid={otherUid}
            isOnline={isOnline}
            isInactive={isInactive}
            unread={unread}
            typingName={typingByConv?.[conv.id] || ''}
            isPinned={isPinned}
            currentUid={currentUid}
            selectionMode={selectionMode}
            isSelected={selectedConversationIds?.includes(conv.id)}
            isSwipedOpen={swipedConvId === conv.id}
            onRequestSwipeOpen={() => setSwipedConvId(conv.id)}
            onRequestSwipeClose={() => setSwipedConvId((prev) => (prev === conv.id ? null : prev))}
            onToggleSelect={onToggleSelectConversation}
            onOpen={() => onOpen(conv)}
            onMoreActionsEnter={el => onMoreActionsEnter?.(conv, otherUid, el)}
            onSwipeMoreActions={() => {
              setSwipedConvId(null);
              onSwipeMoreActions?.(conv, otherUid);
            }}
          />
        );
      })}
    </div>
  );
});

export default ConversationList;
