// src/components/ChatHeader.js
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, Logout, MoreHoriz, Phone, StarOutline, Trash2, User, Users, Video, XIcon } from '../components/Icons';
import {
  getServiceTransportFallbackBannerState,
  E2EE_TRANSPORT,
} from '../lib/e2ee/config';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';
import UserAvatar from '../components/UserAvatar';

const ChatHeader = React.memo(function ChatHeader({
  activeConv,
  onlineUsers,
  inactiveUsers,
  typing,
  typingName,
  unreadCounts,
  onBack,
  onInitiateCall,
  onShowGroupInfo,
  onShowContactProfile,
  parentBlockedOtherUid,
  setRenameValue,
  getConvName,
  getOtherUid,
  getConvPhoto,
  getContactNickname,
  showChatSearch,
  setShowChatSearch,
  chatSearch,
  setChatSearch,
  chatSearchIdx,
  setChatSearchIdx,
  messages,
  chatSearchRef,
  serviceTransportReady,
  callsAvailable = true,
  conversationMuted = false,
  onToggleConversationMute,
  onEnterMessageSelection,
  messageSelectionMode = false,
  onShowStarredMsgs,
  onLeaveGroup,
  onClearChat,
  onDeleteChat,
}) {
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 12 });
  const moreActionsRef = useRef(null);
  const moreActionsButtonRef = useRef(null);
  const otherUid  = getOtherUid(activeConv);
  const isOnline  = otherUid && onlineUsers.has(otherUid);
  const isActive  = isOnline && !inactiveUsers.has(otherUid);

  const totalUnread = useMemo(() =>
    Object.entries(unreadCounts)
      .filter(([id]) => id !== activeConv?.id)
      .reduce((sum, [, n]) => sum + n, 0),
    [unreadCounts, activeConv?.id]
  );

  const searchMatches = useMemo(() =>
    chatSearch.trim()
      ? messages.filter(m => getMessageDisplayText(m).toLowerCase().includes(chatSearch.toLowerCase()))
      : [],
    [messages, chatSearch]
  );

  const searchTotal   = searchMatches.length;
  const searchCurrent = searchTotal > 0 ? chatSearchIdx % searchTotal : 0;
  const serviceFallbackBannerState = getServiceTransportFallbackBannerState({
    transport: E2EE_TRANSPORT,
    serviceTransportReady,
  });

  useEffect(() => {
    if (!moreActionsOpen) return;
    function handleClickOutside(event) {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target)) {
        setMoreActionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreActionsOpen]);

  useLayoutEffect(() => {
    if (!moreActionsOpen || !moreActionsButtonRef.current) return;
    function updateMenuPosition() {
      const rect = moreActionsButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [moreActionsOpen]);

  function openContactProfile() {
    if (!activeConv.isGroup) {
      setRenameValue(getContactNickname(otherUid) || getConvName(activeConv));
      onShowContactProfile();
    }
  }

  function openHeaderDetails() {
    if (activeConv.isGroup) {
      onShowGroupInfo?.();
      return;
    }
    openContactProfile();
  }

  function handleProfileKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openHeaderDetails();
    }
  }

  function openChatSearch() {
    setShowChatSearch(true);
    setChatSearch('');
    setChatSearchIdx(0);
    setTimeout(() => chatSearchRef.current?.focus(), 50);
  }

  function closeChatSearch() {
    if (typeof document !== 'undefined' && document.activeElement === chatSearchRef.current) {
      chatSearchRef.current.blur();
    }
    setShowChatSearch(false);
    setChatSearch('');
    setChatSearchIdx(0);
  }

  function toggleChatSearch() {
    if (showChatSearch) {
      closeChatSearch();
      return;
    }
    openChatSearch();
  }

  function closeMoreActions() {
    setMoreActionsOpen(false);
  }

  return (
    <>
      <div className="chat-header">
        {/* Terug-knop met ongelezen badge */}
        <button type="button" className="back-btn" onClick={onBack} title="Terug" aria-label={totalUnread > 0 ? `Terug, ${totalUnread} ongelezen ${totalUnread === 1 ? 'bericht' : 'berichten'} in andere gesprekken` : 'Terug'} style={{ position: 'relative' }}>
          <span aria-hidden="true">←</span>
          {totalUnread > 0 && (
            <span aria-hidden="true" style={{
              position: 'absolute', top: -6, right: -6,
              background: '#25d366', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: 1,
              minWidth: 16, height: 16, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px', pointerEvents: 'none',
            }}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>

        {/* Avatar */}
        <div
          className="avatar-wrap"
          role="button"
          tabIndex={0}
          aria-label={activeConv.isGroup ? `Open groepsinfo van ${getConvName(activeConv)}` : `Open profiel van ${getConvName(activeConv)}`}
          style={{ cursor: 'pointer' }}
          onClick={openHeaderDetails}
          onKeyDown={handleProfileKeyDown}
        >
          <UserAvatar photoURL={getConvPhoto(activeConv)} displayName={getConvName(activeConv)} className="sm" decorative />
          {isOnline && <span className={`online-dot sm${inactiveUsers.has(otherUid) ? ' inactive' : ''}`} aria-hidden="true" />}
        </div>

        {/* Naam + status */}
        <div
          className="chat-header-info"
          role="button"
          tabIndex={0}
          aria-label={activeConv.isGroup ? `Open groepsinfo van ${getConvName(activeConv)}` : `Open profiel van ${getConvName(activeConv)}`}
          style={{ cursor: 'pointer' }}
          onClick={openHeaderDetails}
          onKeyDown={handleProfileKeyDown}
        >
          <div className="chat-header-name">{getConvName(activeConv)}</div>
          {isOnline ? <div className="chat-header-online">{isActive ? 'Online' : 'Afwezig'}</div> : null}
        </div>

        {/* Actieknoppen */}
        <div className="chat-header-actions" ref={moreActionsRef}>
          <button
            type="button"
            className="icon-btn"
            ref={moreActionsButtonRef}
            aria-label="Meer acties"
            aria-haspopup="menu"
            aria-expanded={moreActionsOpen}
            title="Meer acties"
            onClick={() => setMoreActionsOpen((prev) => !prev)}
          >
            <MoreHoriz size={18} aria-hidden="true" />
          </button>
          {moreActionsOpen && (
            <div
              className="chat-header-menu"
              role="menu"
              aria-label="Meer acties in gesprek"
              style={{ top: menuPosition.top, right: menuPosition.right }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="chat-header-menu-item"
                onClick={() => {
                  closeMoreActions();
                  activeConv.isGroup ? onShowGroupInfo?.() : openContactProfile();
                }}
              >
                {activeConv.isGroup ? <Users size={16} aria-hidden="true" /> : <User size={16} aria-hidden="true" />}
                <span>{activeConv.isGroup ? 'Groepsinfo' : 'Profiel'}</span>
              </button>
              {!activeConv.isGroup && !parentBlockedOtherUid && callsAvailable && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="chat-header-menu-item"
                    onClick={() => {
                      closeMoreActions();
                      onInitiateCall(false);
                    }}
                  >
                    <Phone size={16} aria-hidden="true" />
                    <span>Bellen</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="chat-header-menu-item"
                    onClick={() => {
                      closeMoreActions();
                      onInitiateCall(true);
                    }}
                  >
                    <Video size={16} aria-hidden="true" />
                    <span>Videobellen</span>
                  </button>
                </>
              )}
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={conversationMuted}
                className={`chat-header-menu-item${conversationMuted ? ' active' : ''}`}
                onClick={() => {
                  closeMoreActions();
                  onToggleConversationMute?.();
                }}
              >
                {conversationMuted ? <BellOff size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
                <span>{conversationMuted ? 'Meldingen aanzetten' : 'Meldingen dempen'}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="chat-header-menu-item"
                onClick={() => {
                  closeMoreActions();
                  onEnterMessageSelection?.();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h10v2H4v-2z" />
                </svg>
                <span>{messageSelectionMode ? 'Berichten selecteren stoppen' : 'Berichten selecteren'}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="chat-header-menu-item"
                onClick={() => {
                  closeMoreActions();
                  onShowStarredMsgs?.();
                }}
              >
                <StarOutline size={16} aria-hidden="true" />
                <span>Berichten met ster</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={`chat-header-menu-item${showChatSearch ? ' active' : ''}`}
                aria-controls="chat-search-region"
                aria-expanded={showChatSearch}
                onClick={() => {
                  closeMoreActions();
                  toggleChatSearch();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
                <span>{showChatSearch ? 'Zoeken sluiten' : 'Zoeken'}</span>
              </button>
              {activeConv.isGroup ? (
                <>
                  <div className="chat-header-menu-divider" />
                  <button
                    type="button"
                    role="menuitem"
                    className="chat-header-menu-item danger"
                    onClick={() => {
                      closeMoreActions();
                      onLeaveGroup?.();
                    }}
                  >
                    <Logout size={16} aria-hidden="true" />
                    <span>Groep verlaten</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="chat-header-menu-divider" />
                  <button
                    type="button"
                    role="menuitem"
                    className="chat-header-menu-item danger"
                    onClick={() => {
                      closeMoreActions();
                      onClearChat?.();
                    }}
                  >
                    <XIcon size={16} aria-hidden="true" />
                    <span>Chat wissen</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="chat-header-menu-item danger"
                    onClick={() => {
                      closeMoreActions();
                      onDeleteChat?.();
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    <span>Chat verwijderen</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {serviceFallbackBannerState.visible && (
        <div
          className="chat-service-fallback-banner"
          role="status"
          aria-live="polite"
          style={{
            margin: '0 12px 10px',
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.28)',
            color: 'var(--text2)',
            fontSize: 12,
          }}
        >
          {serviceFallbackBannerState.text}
        </div>
      )}

      {/* Zoekbalk in gesprek */}
      <div id="chat-search-region" className={`chat-search-bar${showChatSearch ? ' visible' : ''}`} role="search" aria-label={`Zoeken in gesprek met ${getConvName(activeConv)}`}>
        <input
          ref={chatSearchRef}
          aria-label={`Zoeken in gesprek met ${getConvName(activeConv)}`}
          aria-controls="chat-messages-log"
          aria-describedby={chatSearch.trim() ? 'chat-search-results-status' : undefined}
          tabIndex={showChatSearch ? 0 : -1}
          value={chatSearch}
          onChange={e => { setChatSearch(e.target.value); setChatSearchIdx(0); }}
          placeholder="Zoeken in gesprek…"
          style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
          onKeyDown={e => {
            if (e.key === 'Enter') setChatSearchIdx(i => (i + 1) % (searchTotal || 1));
            if (e.key === 'Escape') closeChatSearch();
          }}
        />
        {chatSearch.trim() && (
          <span id="chat-search-results-status" aria-live="polite" style={{ fontSize: '13px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
            {searchTotal === 0 ? 'Geen resultaten' : `${searchCurrent + 1} / ${searchTotal}`}
          </span>
        )}
        {searchTotal > 1 && (
          <>
            <button type="button" aria-label="Vorig resultaat" aria-controls="chat-messages-log" tabIndex={showChatSearch ? 0 : -1} className="icon-btn" style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setChatSearchIdx(i => (i - 1 + searchTotal) % searchTotal)}><span aria-hidden="true">↑</span></button>
            <button type="button" aria-label="Volgend resultaat" aria-controls="chat-messages-log" tabIndex={showChatSearch ? 0 : -1} className="icon-btn" style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setChatSearchIdx(i => (i + 1) % searchTotal)}><span aria-hidden="true">↓</span></button>
          </>
        )}
        <button type="button" aria-label="Zoeken sluiten" tabIndex={showChatSearch ? 0 : -1} className="icon-btn" style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeChatSearch}><span aria-hidden="true">✕</span></button>
      </div>
    </>
  );
});

export default ChatHeader;
