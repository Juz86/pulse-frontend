// src/components/ChatHeader.js
import React, { useMemo } from 'react';
import { Phone, Video } from '../components/Icons';
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
  onShowGroupInfo,
  onShowContactProfile,
  setRenameValue,
  getConvName,
  getOtherUid,
  getConvPhoto,
  getContactNickname,
  serviceTransportReady,
  conversationMuted = false,
  onToggleConversationMute,
  onEnterMessageSelection,
  messageSelectionMode = false,
  onShowStarredMsgs,
  onLeaveGroup,
  callLaunchPending = false,
  audioCallingAvailable = false,
  videoCallingAvailable = false,
  onStartAudioCall,
  onStartVideoCall,
  onClearChat,
  onDeleteChat,
}) {
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

        <div className="chat-header-actions">
          {!activeConv.isGroup && (
            <>
              <button
                type="button"
                className="chat-header-action-btn chat-header-menu-btn"
                aria-label={`Videobel ${getConvName(activeConv)}`}
                title="Videobellen"
                disabled={callLaunchPending || !videoCallingAvailable}
                onClick={onStartVideoCall}
              >
                <Video size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="chat-header-action-btn chat-header-menu-btn"
                aria-label={`Bel ${getConvName(activeConv)}`}
                title="Bellen"
                disabled={callLaunchPending || !audioCallingAvailable}
                onClick={onStartAudioCall}
              >
                <Phone size={20} aria-hidden="true" />
              </button>
            </>
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
