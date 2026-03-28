// src/components/ChatHeader.js
import React, { useMemo } from 'react';
import { Phone, Video, Users } from '../components/Icons';
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

  const searchMatches = useMemo(() =>
    chatSearch.trim()
      ? messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase()))
      : [],
    [messages, chatSearch]
  );

  const searchTotal   = searchMatches.length;
  const searchCurrent = searchTotal > 0 ? chatSearchIdx % searchTotal : 0;

  function openContactProfile() {
    if (!activeConv.isGroup) {
      setRenameValue(getContactNickname(otherUid) || getConvName(activeConv));
      onShowContactProfile();
    }
  }

  function handleProfileKeyDown(event) {
    if (activeConv.isGroup) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openContactProfile();
    }
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
          role={!activeConv.isGroup ? 'button' : undefined}
          tabIndex={!activeConv.isGroup ? 0 : undefined}
          aria-label={!activeConv.isGroup ? `Open profiel van ${getConvName(activeConv)}` : undefined}
          style={{ cursor: !activeConv.isGroup ? 'pointer' : 'default' }}
          onClick={openContactProfile}
          onKeyDown={handleProfileKeyDown}
        >
          <UserAvatar photoURL={getConvPhoto(activeConv)} displayName={getConvName(activeConv)} className="sm" />
          {isOnline && <span className={`online-dot sm${inactiveUsers.has(otherUid) ? ' inactive' : ''}`} aria-hidden="true" />}
        </div>

        {/* Naam + status */}
        <div
          className="chat-header-info"
          role={!activeConv.isGroup ? 'button' : undefined}
          tabIndex={!activeConv.isGroup ? 0 : undefined}
          aria-label={!activeConv.isGroup ? `Open profiel van ${getConvName(activeConv)}` : undefined}
          style={{ cursor: !activeConv.isGroup ? 'pointer' : 'default' }}
          onClick={openContactProfile}
          onKeyDown={handleProfileKeyDown}
        >
          <div className="chat-header-name">{getConvName(activeConv)}</div>
          {typing
            ? <div className="chat-header-typing" aria-live="polite"><span aria-hidden="true">● </span>{typingName} typt…</div>
            : isOnline
              ? <div className="chat-header-online">{isActive ? 'Online' : 'Inactief'}</div>
              : null
          }
        </div>

        {/* Actieknoppen */}
        <div className="chat-header-actions">
          {!activeConv.isGroup && (
            <>
              <button type="button" className="call-btn voice" aria-label={`Bel ${getConvName(activeConv)}`} onClick={() => onInitiateCall(false)} title="Bellen"><Phone size={18} aria-hidden="true" /></button>
              <button type="button" className="call-btn video" aria-label={`Videobel ${getConvName(activeConv)}`} onClick={() => onInitiateCall(true)} title="Videobellen"><Video size={18} aria-hidden="true" /></button>
            </>
          )}
          {activeConv.isGroup && (
            <button type="button" className="icon-btn" aria-label={`Open groepsinformatie voor ${getConvName(activeConv)}`} onClick={onShowGroupInfo} title="Groepsinformatie"><Users size={18} aria-hidden="true" /></button>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label={`Zoek in gesprek met ${getConvName(activeConv)}`}
            aria-controls="chat-search-region"
            aria-expanded={showChatSearch}
            title="Zoeken"
            onClick={() => { setShowChatSearch(s => !s); setChatSearch(''); setChatSearchIdx(0); setTimeout(() => chatSearchRef.current?.focus(), 50); }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Zoekbalk in gesprek */}
      <div id="chat-search-region" className={`chat-search-bar${showChatSearch ? ' visible' : ''}`} role="search" aria-label={`Zoeken in gesprek met ${getConvName(activeConv)}`}>
        <input
          ref={chatSearchRef}
          aria-label={`Zoeken in gesprek met ${getConvName(activeConv)}`}
          aria-controls="chat-messages-log"
          aria-describedby={chatSearch.trim() ? 'chat-search-results-status' : undefined}
          value={chatSearch}
          onChange={e => { setChatSearch(e.target.value); setChatSearchIdx(0); }}
          placeholder="Zoeken in gesprek…"
          style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 12px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
          onKeyDown={e => {
            if (e.key === 'Enter') setChatSearchIdx(i => (i + 1) % (searchTotal || 1));
            if (e.key === 'Escape') { setShowChatSearch(false); setChatSearch(''); }
          }}
        />
        {chatSearch.trim() && (
          <span id="chat-search-results-status" aria-live="polite" style={{ fontSize: '13px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
            {searchTotal === 0 ? 'Geen resultaten' : `${searchCurrent + 1} / ${searchTotal}`}
          </span>
        )}
        {searchTotal > 1 && (
          <>
            <button type="button" aria-label="Vorig resultaat" aria-controls="chat-messages-log" className="icon-btn" style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setChatSearchIdx(i => (i - 1 + searchTotal) % searchTotal)}><span aria-hidden="true">↑</span></button>
            <button type="button" aria-label="Volgend resultaat" aria-controls="chat-messages-log" className="icon-btn" style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setChatSearchIdx(i => (i + 1) % searchTotal)}><span aria-hidden="true">↓</span></button>
          </>
        )}
        <button type="button" aria-label="Zoeken sluiten" className="icon-btn" style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setShowChatSearch(false); setChatSearch(''); }}><span aria-hidden="true">✕</span></button>
      </div>
    </>
  );
});

export default ChatHeader;
