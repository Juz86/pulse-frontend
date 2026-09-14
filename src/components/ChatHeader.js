// src/components/ChatHeader.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Logout, MoreHoriz, Phone, User, Users, Video, XIcon } from '../components/Icons';
import {
  getServiceTransportFallbackBannerState,
  E2EE_TRANSPORT,
} from '../lib/e2ee/config';
import UserAvatar from '../components/UserAvatar';

const ChatHeader = React.memo(function ChatHeader({
  activeConv,
  onlineUsers,
  inactiveUsers,
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
  const moreActionsRef = useRef(null);
  const moreActionsHistoryPushedRef = useRef(false);
  const otherUid  = getOtherUid(activeConv);
  const isOnline  = otherUid && onlineUsers.has(otherUid);
  const isActive  = isOnline && !inactiveUsers.has(otherUid);

  const totalUnread = useMemo(() =>
    Object.entries(unreadCounts)
      .filter(([id]) => id !== activeConv?.id)
      .reduce((sum, [, n]) => sum + n, 0),
    [unreadCounts, activeConv?.id]
  );

  const serviceFallbackBannerState = getServiceTransportFallbackBannerState({
    transport: E2EE_TRANSPORT,
    serviceTransportReady,
  });

  useEffect(() => {
    if (!moreActionsOpen) return;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (moreActionsHistoryPushedRef.current) {
        moreActionsHistoryPushedRef.current = false;
        window.history.back();
        return;
      }
      setMoreActionsOpen(false);
    };
    const onPopState = () => {
      moreActionsHistoryPushedRef.current = false;
      setMoreActionsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('popstate', onPopState);
    if (!moreActionsHistoryPushedRef.current) {
      window.history.pushState({ pulseSheet: 'chat-header-actions' }, '');
      moreActionsHistoryPushedRef.current = true;
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
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

  function closeMoreActions() {
    if (moreActionsHistoryPushedRef.current) {
      moreActionsHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setMoreActionsOpen(false);
  }

  return (
    <>
      <div className="chat-header">
        <button type="button" className="chat-header-back-btn" onClick={onBack} title="Terug" aria-label={totalUnread > 0 ? `Terug, ${totalUnread} ongelezen ${totalUnread === 1 ? 'bericht' : 'berichten'} in andere gesprekken` : 'Terug'} style={{ position: 'relative' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {totalUnread > 0 && (
            <span aria-hidden="true" className="chat-header-back-badge">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>

        <div
          className="chat-header-contact"
          role="button"
          tabIndex={0}
          aria-label={activeConv.isGroup ? `Open groepsinfo van ${getConvName(activeConv)}` : `Open profiel van ${getConvName(activeConv)}`}
          onClick={openHeaderDetails}
          onKeyDown={handleProfileKeyDown}
        >
          <div className="chat-header-avatar-wrap">
            <UserAvatar photoURL={getConvPhoto(activeConv)} displayName={getConvName(activeConv)} className="sm chat-header-avatar" decorative />
            {isOnline && <span className={`online-dot${inactiveUsers.has(otherUid) ? ' inactive' : ''}`} aria-hidden="true" />}
          </div>
          <div className="chat-header-copy">
            <div className="chat-header-name">{getConvName(activeConv)}</div>
            {isOnline ? <div className="chat-header-online">{isActive ? 'Online' : 'Afwezig'}</div> : null}
          </div>
        </div>

        <div className="chat-header-actions" ref={moreActionsRef}>
          {!activeConv.isGroup && !parentBlockedOtherUid && callsAvailable ? (
            <div className="chat-header-call-pill">
              <button
                type="button"
                className="chat-header-action-btn"
                aria-label="Videobellen"
                title="Videobellen"
                onClick={() => onInitiateCall(true, activeConv)}
              >
                <Video size={26} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="chat-header-action-btn"
                aria-label="Bellen"
                title="Bellen"
                onClick={() => onInitiateCall(false, activeConv)}
              >
                <Phone size={24} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="chat-header-action-btn chat-header-menu-btn"
              aria-label="Meer acties"
              aria-haspopup="menu"
              aria-expanded={moreActionsOpen}
              title="Meer acties"
              onClick={() => {
                if (activeConv.isGroup) {
                  onShowGroupInfo?.();
                  return;
                }
                setMoreActionsOpen((prev) => !prev);
              }}
            >
              <MoreHoriz size={18} aria-hidden="true" />
            </button>
          )}
          {moreActionsOpen && (
            <div
              className="pulse-sheet-backdrop pulse-sheet-backdrop--header-actions"
              onClick={closeMoreActions}
            >
              <div
                className="pulse-sheet pulse-sheet--header-actions"
                role="menu"
                aria-label="Meer acties in gesprek"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="pulse-sheet-handle" aria-hidden="true" />
                <div className="pulse-sheet-header pulse-sheet-header--header-actions">
                  <div className="pulse-sheet-title pulse-sheet-title--header-actions">Gespreksopties</div>
                  <button
                    type="button"
                    className="pulse-sheet-close pulse-sheet-close--header-actions"
                    aria-label="Sluiten"
                    onClick={closeMoreActions}
                  >
                    <XIcon size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="pulse-sheet-list pulse-sheet-list--header-actions">
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
                  ) : null}
                </div>
              </div>
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
    </>
  );
});

export default ChatHeader;
