// src/components/ConversationList.js
import React, { useMemo, useCallback } from 'react';
import { Message } from '../components/Icons';
import ConversationItem from './ConversationItem';

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
  onlineUsers,
  inactiveUsers,
  currentUid,
  getConvName,
  getOtherUid,
  getConvPhoto,
  onOpen,
  onCallVoice,
  onCallVideo,
  onDelete,
  setLabelMenuConvId,
}) {
  const filtered = useMemo(() => {
    return conversations
      .filter(conv => {
        const matchSearch = !searchQuery.trim() ||
          getConvName(conv).toLowerCase().includes(searchQuery.toLowerCase()) ||
          (conv.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchFilter = chatFilter === 'all'
          || (chatFilter === 'groepen' && conv.isGroup && (!selectedGroupId || conv.id === selectedGroupId))
          || convLabels[conv.id] === chatFilter;
        return matchSearch && matchFilter;
      })
      .sort((a, b) => {
        const aPinned = pinnedContacts.includes(getOtherUid(a));
        const bPinned = pinnedContacts.includes(getOtherUid(b));
        return bPinned - aPinned;
      })
      .map(conv => ({
        ...conv,
        name:     getConvName(conv),
        photoURL: getConvPhoto(conv),
      }));
  }, [conversations, searchQuery, chatFilter, selectedGroupId, convLabels, pinnedContacts, getConvName, getOtherUid, getConvPhoto]);

  const handleDelete = useCallback((e, convId) => {
    onDelete(e, convId);
  }, [onDelete]);

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
          <p>Nog geen gesprekken.</p>
          <p>Klik op het <span aria-hidden="true"><Message size={14} color="#ffffff" style={{ verticalAlign: 'middle', margin: '0 2px' }} /></span> om een nieuwe chat te starten.</p>
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
        const isPinned  = pinnedContacts.includes(otherUid);
        return (
          <ConversationItem
            key={conv.id}
            conv={conv}
            isActive={activeConv?.id === conv.id}
            otherUid={otherUid}
            isOnline={isOnline}
            isInactive={isInactive}
            unread={unread}
            isPinned={isPinned}
            currentUid={currentUid}
            onOpen={() => onOpen(conv)}
            onCallVoice={e => { e.stopPropagation(); onCallVoice(conv, false); }}
            onCallVideo={e => { e.stopPropagation(); onCallVideo(conv, true); }}
            onDelete={e => handleDelete(e, conv.id)}
          />
        );
      })}
    </div>
  );
});

export default ConversationList;
