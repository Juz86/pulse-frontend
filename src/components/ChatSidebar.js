// src/components/ChatSidebar.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Phone, Video, Search, Message, Users, Bell, BellOff, Shield, Logout, Pin, MoreHoriz, Plus, XIcon, Trash2, StarOutline, Handshake } from '../components/Icons';
import PulseLogo from '../components/PulseLogo';
import UserAvatar from '../components/UserAvatar';
import ConversationList from './ConversationList';

export default function ChatSidebar({
  user,
  onlineUsers,
  inactiveUsers,
  dnd,
  onToggleDnd,
  missedCallAlert,
  callLogRead,
  getCallLog,
  onCallLogRead,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  chatFilter,
  setChatFilter,
  selectedGroupId,
  setSelectedGroupId,
  friendRequests,
  sentFriendRequests,
  showFriendRequestsPanel,
  setShowFriendRequestsPanel,
  contactSuccess,
  contacts,
  conversations,
  activeConv,
  loadingConvs,
  convLabels,
  pinnedContacts,
  unreadCounts,
  typingByConv = {},
  photoPreview,
  isParent,
  parentActivityBadge,
  onOpenDashboard,
  setLabelMenuConvId,
  // modal openers
  onNewChat,
  onNewGroup,
  onShowCallModal,
  onShowAddContact,
  onOpenProfile,
  setConfirmDialog,
  // contact actions
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemindFriendRequest,
  onCancelFriendRequest,
  onTogglePin,
  onViewContact,
  onStartChat,
  onCallContact,
  onRemoveContact,
  onBlockContact,
  onUnblockContact,
  blockedContacts,
  parentBlockedUids,
  // conv actions
  onOpenConversation,
  onCallFromConv,
  onClearConversation,
  onHardDeleteConversation,
  onToggleConversationMute,
  onShowGroupInfo,
  onEnterMessageSelectionForConversation,
  onShowStarredForConversation,
  onLeaveGroup,
  mutedConversationIds = [],
  selectionMode,
  selectedConversationIds,
  onToggleConversationSelection,
  onEnterConversationSelection,
  onCancelConversationSelection,
  onDeleteSelectedConversations,
  // helpers
  getConvName,
  getOtherUid,
  getConvPhoto,
  getContactDisplayName,
  callsAvailable = true,
}) {
  const sidebarRef = useRef(null);
  const sidebarHeaderRef = useRef(null);
  const sidebarFooterRef = useRef(null);
  const sidebarFooterTabbarRef = useRef(null);
  const [contactMenu, setContactMenu] = useState(null);
  const [convMenu, setConvMenu]       = useState(null); // { conv, otherUid, direction, top, left }
  const [convActionsSheet, setConvActionsSheet] = useState(null); // { conv, otherUid }
  const [moreActionsMenuOpen, setMoreActionsMenuOpen] = useState(false);
  const moreActionsMenuRef = useRef(null);
  const convSheetHistoryPushedRef = useRef(false);
  const moreActionsSheetHistoryPushedRef = useRef(false);
  const contactSheetHistoryPushedRef = useRef(false);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredContacts = useMemo(() => contacts.filter((contact) => (
    !normalizedSearch
      || contact.displayName?.toLowerCase().includes(normalizedSearch)
      || contact.email?.toLowerCase().includes(normalizedSearch)
  )), [contacts, normalizedSearch]);

  useEffect(() => {
    if (!moreActionsMenuOpen) return;
    function handleClickOutside(e) {
      if (e.target?.closest?.('[data-sidebar-actions-menu]')) return;
      if (moreActionsMenuRef.current && !moreActionsMenuRef.current.contains(e.target)) {
        setMoreActionsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreActionsMenuOpen]);

  useEffect(() => {
    if (!moreActionsMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (moreActionsSheetHistoryPushedRef.current) {
        moreActionsSheetHistoryPushedRef.current = false;
        window.history.back();
        return;
      }
      setMoreActionsMenuOpen(false);
    };
    const onPopState = () => {
      moreActionsSheetHistoryPushedRef.current = false;
      setMoreActionsMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('popstate', onPopState);
    if (!moreActionsSheetHistoryPushedRef.current) {
      window.history.pushState({ pulseSheet: 'sidebar-actions' }, '');
      moreActionsSheetHistoryPushedRef.current = true;
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
    };
  }, [moreActionsMenuOpen]);

  useEffect(() => {
    if (!convMenu && !contactMenu) return;
    function handleClickOutside(e) {
      const target = e.target;
      if (target?.closest?.('[data-sidebar-actions-menu]')) return;
      if (target?.closest?.('[data-sidebar-actions-trigger]')) return;
      setConvMenu(null);
      setContactMenu(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [convMenu, contactMenu]);

  useEffect(() => {
    if (!convActionsSheet) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (convSheetHistoryPushedRef.current) {
        convSheetHistoryPushedRef.current = false;
        window.history.back();
        return;
      }
      setConvActionsSheet(null);
    };
    const onPopState = () => {
      convSheetHistoryPushedRef.current = false;
      setConvActionsSheet(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('popstate', onPopState);
    if (!convSheetHistoryPushedRef.current) {
      window.history.pushState({ pulseSheet: 'conv-actions' }, '');
      convSheetHistoryPushedRef.current = true;
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
    };
  }, [convActionsSheet]);

  useEffect(() => {
    if (!contactMenu) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (contactSheetHistoryPushedRef.current) {
        contactSheetHistoryPushedRef.current = false;
        window.history.back();
        return;
      }
      setContactMenu(null);
    };
    const onPopState = () => {
      contactSheetHistoryPushedRef.current = false;
      setContactMenu(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('popstate', onPopState);
    if (!contactSheetHistoryPushedRef.current) {
      window.history.pushState({ pulseSheet: 'contact-actions' }, '');
      contactSheetHistoryPushedRef.current = true;
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
    };
  }, [contactMenu]);

  useEffect(() => {
    const root = document.documentElement;
    const updateSidebarSheetBounds = () => {
      if (!sidebarRef.current || !sidebarHeaderRef.current || !sidebarFooterRef.current || !sidebarFooterTabbarRef.current) return;
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const headerRect = sidebarHeaderRef.current.getBoundingClientRect();
      const footerRect = sidebarFooterRef.current.getBoundingClientRect();
      const footerTabbarRect = sidebarFooterTabbarRef.current.getBoundingClientRect();

      root.style.setProperty('--sidebar-sheet-left', `${Math.round(sidebarRect.left)}px`);
      root.style.setProperty('--sidebar-sheet-right', `${Math.round(sidebarRect.right)}px`);
      root.style.setProperty('--sidebar-sheet-top', `${Math.round(headerRect.bottom - 2)}px`);
      root.style.setProperty('--sidebar-sheet-bottom', `${Math.round(footerRect.top)}px`);
      root.style.setProperty('--sidebar-sheet-anchor-bottom', `${Math.round(footerTabbarRect.top)}px`);
    };

    updateSidebarSheetBounds();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateSidebarSheetBounds())
      : null;

    if (resizeObserver) {
      resizeObserver.observe(sidebarRef.current);
      resizeObserver.observe(sidebarHeaderRef.current);
      resizeObserver.observe(sidebarFooterRef.current);
      resizeObserver.observe(sidebarFooterTabbarRef.current);
    }

    window.addEventListener('resize', updateSidebarSheetBounds);
    window.addEventListener('orientationchange', updateSidebarSheetBounds);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSidebarSheetBounds);
      window.removeEventListener('orientationchange', updateSidebarSheetBounds);
    };
  }, []);

  const hasMissedCall = callsAvailable && (((!callLogRead && getCallLog().some(e => e.direction === 'missed')) || missedCallAlert));

  function openContactMenu(contactUid, anchorEl) {
    setContactMenu(prev => prev?.uid === contactUid ? null : { uid: contactUid });
  }

  function handleOpenConversation(conv) {
    setConvMenu(null);
    setContactMenu(null);
    setConvActionsSheet(null);
    onOpenConversation(conv);
  }
  const openConvActionsSheet = useCallback((conv, otherUid) => {
    setConvMenu(null);
    setContactMenu(null);
    setConvActionsSheet({ conv, otherUid });
  }, []);
  const closeConvActionsSheet = useCallback(() => {
    if (convSheetHistoryPushedRef.current) {
      convSheetHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setConvActionsSheet(null);
  }, []);
  const closeMoreActionsSheet = useCallback(() => {
    if (moreActionsSheetHistoryPushedRef.current) {
      moreActionsSheetHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setMoreActionsMenuOpen(false);
  }, []);
  const closeContactActionsSheet = useCallback(() => {
    if (contactSheetHistoryPushedRef.current) {
      contactSheetHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setContactMenu(null);
  }, []);

  const renderConvActions = useCallback((conv, otherUid, onDone) => {
    const contact = contacts.find(c => c.uid === otherUid);
    const isParentBlocked = parentBlockedUids?.includes(otherUid);
    const isProtectedParentContact = !isParent && contact?.role === 'parent';
    const isPinned = pinnedContacts.includes(otherUid);
    const isMuted = mutedConversationIds.includes(conv.id);
    return (
      <>
        {conv.isGroup && (
          <button type="button" role="menuitem" className="chat-header-menu-item"
            onClick={() => { onShowGroupInfo?.(conv); onDone?.(); }} title="Groepsinfo">
            <Users size={14} aria-hidden="true" />
            <span>Groepsinfo</span>
          </button>
        )}
        {!conv.isGroup && contact && (
          <button type="button" role="menuitem" className="chat-header-menu-item"
            onClick={() => { onViewContact(contact); onDone?.(); }} title="Profiel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z" /></svg>
            <span>Profiel</span>
          </button>
        )}
        {!isParentBlocked && <>
          {!conv.isGroup && <button type="button" role="menuitem" className="chat-header-menu-item"
            onClick={() => { onOpenConversation(conv); onDone?.(); }} title="Bericht sturen">
            <Message size={14} aria-hidden="true" />
            <span>Bericht sturen</span>
          </button>}
          {!conv.isGroup && callsAvailable && (
            <>
              <button type="button" role="menuitem" className="chat-header-menu-item"
                onClick={() => { onCallFromConv(conv, false); onDone?.(); }} title="Bellen">
                <Phone size={14} aria-hidden="true" />
                <span>Bellen</span>
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item"
                onClick={() => { onCallFromConv(conv, true); onDone?.(); }} title="Videobellen">
                <Video size={14} aria-hidden="true" />
                <span>Videobellen</span>
              </button>
            </>
          )}
          {!conv.isGroup && otherUid && (
            <button type="button" role="menuitem" className={`chat-header-menu-item${isPinned ? ' active' : ''}`}
              onClick={() => { onTogglePin(otherUid); onDone?.(); }} title={isPinned ? 'Losmaken' : 'Vastzetten'}>
              <Pin size={14} aria-hidden="true" />
              <span>{isPinned ? 'Losmaken' : 'Vastzetten'}</span>
            </button>
          )}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isMuted}
            className={`chat-header-menu-item${isMuted ? ' active' : ''}`}
            onClick={() => { onToggleConversationMute?.(conv.id); onDone?.(); }}
            title={isMuted ? 'Meldingen aanzetten' : 'Meldingen dempen'}
          >
            {isMuted ? <BellOff size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
            <span>{isMuted ? 'Meldingen aanzetten' : 'Meldingen dempen'}</span>
          </button>
          {conv.isGroup && (
            <>
              <button
                type="button"
                role="menuitem"
                className="chat-header-menu-item"
                onClick={() => { onEnterMessageSelectionForConversation?.(conv); onDone?.(); }}
                title="Berichten selecteren"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h10v2H4v-2z" />
                </svg>
                <span>Berichten selecteren</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="chat-header-menu-item"
                onClick={() => { onShowStarredForConversation?.(conv); onDone?.(); }}
                title="Berichten met ster"
              >
                <StarOutline size={14} aria-hidden="true" />
                <span>Berichten met ster</span>
              </button>
            </>
          )}
        </>}
        <div className="chat-header-menu-divider" />
        {conv.isGroup ? (
          <button
            type="button"
            role="menuitem"
            className="chat-header-menu-item danger"
            onClick={() => { onLeaveGroup?.(conv); onDone?.(); }}
            title="Groep verlaten"
          >
            <Logout size={14} aria-hidden="true" />
            <span>Groep verlaten</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              role="menuitem"
              className="chat-header-menu-item danger"
              onClick={() => { onClearConversation?.(conv); onDone?.(); }}
              title="Chat wissen"
            >
              <XIcon size={14} aria-hidden="true" />
              <span>Chat wissen</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="chat-header-menu-item danger"
              onClick={() => { onHardDeleteConversation?.(conv); onDone?.(); }}
              title="Chat verwijderen"
            >
              <Trash2 size={14} aria-hidden="true" />
              <span>Chat verwijderen</span>
            </button>
            {contact && !isProtectedParentContact && (
              <button type="button" role="menuitem" className="chat-header-menu-item danger"
                onClick={() => { onBlockContact(contact); onDone?.(); }} title="Blokkeren">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
                <span>Blokkeren</span>
              </button>
            )}
          </>
        )}
      </>
    );
  }, [contacts, parentBlockedUids, isParent, pinnedContacts, mutedConversationIds, onShowGroupInfo, onViewContact, onOpenConversation, callsAvailable, onCallFromConv, onTogglePin, onToggleConversationMute, onEnterMessageSelectionForConversation, onShowStarredForConversation, onLeaveGroup, onClearConversation, onHardDeleteConversation, onBlockContact]);

  return (
    <aside className="sidebar" ref={sidebarRef} onClick={() => { setConvMenu(null); setContactMenu(null); }}>
      {/* Header */}
      <div className="sidebar-header" ref={sidebarHeaderRef}>
        <div className="sidebar-top">
          <PulseLogo size={30} textSize={20} color="#fff" />
          <div className="search-box search-box--top">
            <Search size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
            <input aria-label={activeTab === 'chats' ? 'Zoeken in gesprekken' : 'Zoeken in contacten'} placeholder="Zoeken…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        <button type="button" className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`} aria-pressed={activeTab === 'chats'} onClick={() => { setActiveTab('chats'); setSearchQuery(''); }}>
          <Message size={15} aria-hidden="true" /> Chats
        </button>
        <button type="button" className={`sidebar-tab ${activeTab === 'contacts' ? 'active' : ''}`} aria-pressed={activeTab === 'contacts'} onClick={() => { setActiveTab('contacts'); setSearchQuery(''); }}>
          <Users size={15} aria-hidden="true" /> Contacten
          {friendRequests.length > 0 && <span className="unread-badge" aria-label={`${friendRequests.length} openstaande ${friendRequests.length === 1 ? 'uitnodiging' : 'uitnodigingen'}`} style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px' }}>{friendRequests.length}</span>}
        </button>
      </div>

      {/* Filters */}
      {activeTab === 'chats' && (
        <div className="chat-filters" role="group" aria-label="Chatfilters">
          {['all', 'familie', 'vrienden'].map(f => (
            <button key={f} className={`chat-filter-chip${chatFilter === f ? ' active' : ''}`}
              type="button"
              aria-pressed={chatFilter === f}
              onClick={() => { setChatFilter(f); setSelectedGroupId(null); }}>
              {f === 'all' ? 'Alles' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button type="button" className={`chat-filter-chip${chatFilter === 'groepen' ? ' active' : ''}`}
            aria-pressed={chatFilter === 'groepen'}
            onClick={() => { setChatFilter('groepen'); setSelectedGroupId(null); }}>
            Groepen
          </button>
        </div>
      )}

      {/* Chats tab */}
      {activeTab === 'chats' && (
        <>
          {selectionMode && (
            <div style={{ padding: '0 18px 12px' }}>
              <div className="chat-selection-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                <div className="chat-selection-count" style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {`${selectedConversationIds.length} geselecteerd`}
                </div>
                <button type="button" className="btn-danger chat-selection-delete-btn" style={{ padding: '4px 7px', fontSize: 10, minWidth: 0 }} disabled={selectedConversationIds.length === 0} onClick={onDeleteSelectedConversations}>Verwijderen</button>
                <button
                  type="button"
                  className="icon-btn chat-selection-close-btn"
                  aria-label="Selectie sluiten"
                  title="Sluiten"
                  style={{ width: 30, height: 30, flexShrink: 0 }}
                  onClick={onCancelConversationSelection}
                >
                  <XIcon size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
          <ConversationList
            conversations={conversations}
            activeConv={activeConv}
            loadingConvs={loadingConvs}
            searchQuery={searchQuery}
            chatFilter={chatFilter}
            selectedGroupId={selectedGroupId}
            convLabels={convLabels}
            pinnedContacts={pinnedContacts}
            unreadCounts={unreadCounts}
            typingByConv={typingByConv}
            onlineUsers={onlineUsers}
            inactiveUsers={inactiveUsers}
            currentUid={user.uid}
            selectionMode={selectionMode}
            selectedConversationIds={selectedConversationIds}
            onToggleSelectConversation={onToggleConversationSelection}
            getConvName={getConvName}
            getOtherUid={getOtherUid}
            getConvPhoto={getConvPhoto}
            onOpen={handleOpenConversation}
            onSwipeMoreActions={openConvActionsSheet}
            setLabelMenuConvId={setLabelMenuConvId}
          />
        </>
      )}

      {/* Contacten tab */}
      {activeTab === 'contacts' && (
        <div className="conv-list">
          {contactSuccess && (
            <div style={{ padding: '0 18px 12px' }}>
              <div role="status" aria-live="polite" style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '8px', color: '#4ade80', fontSize: '13px' }}>
                <span aria-hidden="true">✅ </span>{contactSuccess}
              </div>
            </div>
          )}

          {contacts.length === 0 && friendRequests.length === 0 && sentFriendRequests.length === 0 && (
            <div className="empty-convs">
              <p>Nog geen contacten.</p>
              <p>Voeg iemand toe via e-mailadres.</p>
            </div>
          )}

          {filteredContacts.map(contact => (
            <div key={contact.uid} className="sidebar-contact-card" aria-label={`Contact ${getContactDisplayName(contact)}${contact.email ? `, ${contact.email}` : ''}`}>
              <div className="sidebar-contact-row">
                <div className="avatar-wrap" aria-hidden="true">
                  <UserAvatar photoURL={contact.photoURL} displayName={contact.displayName} decorative />
                  {onlineUsers.has(contact.uid) && <span className={`online-dot${inactiveUsers.has(contact.uid) ? ' inactive' : ''}`} aria-hidden="true" />}
                </div>
                <div className="conv-info" style={{ flex: 1, minWidth: 0 }} aria-hidden="true">
                  <div className="conv-name">{getContactDisplayName(contact)}</div>
                  <div className="conv-preview">{contact.email}</div>
                </div>
                <div
                  style={{ position: 'relative' }}
                >
                  <button
                    type="button"
                    className="icon-btn sidebar-item-actions-btn"
                    aria-label={`Meer acties voor ${getContactDisplayName(contact)}`}
                    data-sidebar-actions-trigger
                    onClick={(e) => { e.stopPropagation(); openContactMenu(contact.uid, e.currentTarget); }}
                    title="Meer acties"
                    style={parentBlockedUids?.includes(contact.uid) ? { color: 'var(--danger, #ef4444)' } : undefined}
                  >
                    <MoreHoriz size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {contacts.length > 0 && normalizedSearch && filteredContacts.length === 0 && (
            <div className="empty-convs" role="status" aria-live="polite">
              <p>Geen contacten gevonden.</p>
              <p>Er zijn geen resultaten voor "{searchQuery}".</p>
            </div>
          )}

        </div>
      )}

      {convMenu && (() => {
        const { conv, otherUid } = convMenu;
        return (
          <div
            role="menu"
            aria-label={`Acties voor ${conv.name}`}
            data-sidebar-actions-menu
            onClick={e => e.stopPropagation()}
            className="chat-header-menu"
            style={{
              position: 'fixed', zIndex: 3000,
              top: convMenu.top, left: convMenu.left,
              minWidth: 160, gap: 2,
            }}
          >
            {renderConvActions(conv, otherUid, () => setConvMenu(null))}
          </div>
        );
      })()}

      {convActionsSheet && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--contact-actions"
          onClick={closeConvActionsSheet}
          role="presentation"
        >
          <div
            className="pulse-sheet pulse-sheet--contact-actions"
            role="menu"
            aria-label={`Acties voor ${convActionsSheet.conv.name}`}
            data-sidebar-actions-menu
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--contact-actions">
              <div className="pulse-sheet-title pulse-sheet-title--contact-actions">{convActionsSheet.conv.name}</div>
              <button
                type="button"
                className="pulse-sheet-close pulse-sheet-close--contact-actions"
                aria-label="Sluiten"
                onClick={closeConvActionsSheet}
              >
                <XIcon size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="pulse-sheet-list pulse-sheet-list--contact-actions">
              {renderConvActions(convActionsSheet.conv, convActionsSheet.otherUid, closeConvActionsSheet)}
            </div>
          </div>
        </div>
      )}

      {contactMenu && (() => {
        const contact = contacts.find(c => c.uid === contactMenu.uid);
        if (!contact) return null;
        const isParentBlocked = parentBlockedUids?.includes(contact.uid);
        const isProtectedParentContact = !isParent && contact?.role === 'parent';
        return (
          <div
            className="pulse-sheet-backdrop pulse-sheet-backdrop--contact-actions"
            onClick={closeContactActionsSheet}
          >
            <div
              className="pulse-sheet pulse-sheet--contact-actions"
              role="menu"
              aria-label={`Acties voor ${getContactDisplayName(contact)}`}
              data-sidebar-actions-menu
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pulse-sheet-handle" aria-hidden="true" />
              <div className="pulse-sheet-header pulse-sheet-header--contact-actions">
                <div className="pulse-sheet-title pulse-sheet-title--contact-actions">{getContactDisplayName(contact)}</div>
                <button type="button" className="pulse-sheet-close pulse-sheet-close--contact-actions" aria-label="Sluiten" onClick={closeContactActionsSheet}>
                  <XIcon size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="pulse-sheet-list pulse-sheet-list--contact-actions">
                <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { onViewContact(contact); closeContactActionsSheet(); }} title="Profiel">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z" /></svg>
                  <span>Profiel</span>
                </button>
                {!isParentBlocked && <>
                  <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { onStartChat(contact); closeContactActionsSheet(); }} title="Bericht sturen">
                    <Message size={14} aria-hidden="true" />
                    <span>Bericht sturen</span>
                  </button>
                  {callsAvailable && (
                    <>
                      <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { onCallContact(contact, false); closeContactActionsSheet(); }} title="Bellen">
                        <Phone size={14} aria-hidden="true" />
                        <span>Bellen</span>
                      </button>
                      <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { onCallContact(contact, true); closeContactActionsSheet(); }} title="Videobellen">
                        <Video size={14} aria-hidden="true" />
                        <span>Videobellen</span>
                      </button>
                    </>
                  )}
                  <button type="button" role="menuitem" className={`chat-header-menu-item${pinnedContacts.includes(contact.uid) ? ' active' : ''}`} onClick={() => { onTogglePin(contact.uid); closeContactActionsSheet(); }} title={pinnedContacts.includes(contact.uid) ? 'Losmaken' : 'Vastzetten'}>
                    <Pin size={14} aria-hidden="true" />
                    <span>{pinnedContacts.includes(contact.uid) ? 'Losmaken' : 'Vastzetten'}</span>
                  </button>
                </>}
                {!isProtectedParentContact && <div className="chat-header-menu-divider" />}
                {!isProtectedParentContact && !isParentBlocked && (
                  <button type="button" role="menuitem" className="chat-header-menu-item danger" onClick={() => { onBlockContact(contact); closeContactActionsSheet(); }} title="Blokkeren">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
                    <span>Blokkeren</span>
                  </button>
                )}
                {!isProtectedParentContact && (
                  <button type="button" role="menuitem" className="chat-header-menu-item danger" onClick={() => { onRemoveContact(contact.uid); closeContactActionsSheet(); }} title="Verwijderen">
                    <Trash2 size={14} aria-hidden="true" />
                    <span>Verwijderen</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {moreActionsMenuOpen && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--sidebar-actions"
          onClick={closeMoreActionsSheet}
        >
          <div
            className="pulse-sheet pulse-sheet--sidebar-actions"
            role="menu"
            aria-label="Meer acties"
            data-sidebar-actions-menu
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--sidebar-actions">
              <div className="pulse-sheet-title pulse-sheet-title--sidebar-actions">Meer opties</div>
              <button
                type="button"
                className="pulse-sheet-close pulse-sheet-close--sidebar-actions"
                aria-label="Sluiten"
                onClick={closeMoreActionsSheet}
              >
                <XIcon size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="pulse-sheet-list pulse-sheet-list--sidebar-actions">
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { closeMoreActionsSheet(); onNewChat?.(); }}>
                <Message size={18} aria-hidden="true" />
                <span>Nieuwe chat</span>
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { closeMoreActionsSheet(); setActiveTab('contacts'); onShowAddContact(); }}>
                <Plus size={18} aria-hidden="true" />
                <span>Nieuw contact</span>
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { closeMoreActionsSheet(); onNewGroup(); }}>
                <Users size={18} aria-hidden="true" />
                <span>Nieuwe groep</span>
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { closeMoreActionsSheet(); setActiveTab('contacts'); setShowFriendRequestsPanel(true); }}>
                <Handshake size={18} aria-hidden="true" />
                <span>Verzoeken</span>
                {(friendRequests.length + sentFriendRequests.length) > 0 && (
                  <span className="unread-badge" style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px' }}>{friendRequests.length + sentFriendRequests.length}</span>
                )}
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { closeMoreActionsSheet(); if (selectionMode) onCancelConversationSelection?.(); else { setActiveTab('chats'); onEnterConversationSelection?.(); } }}>
                <Message size={18} aria-hidden="true" />
                <span>{selectionMode ? 'Selectie stoppen' : 'Chats selecteren'}</span>
              </button>
              <button type="button" role="menuitem" className={`chat-header-menu-item${dnd ? ' active' : ''}`} onClick={() => { onToggleDnd(); }}>
                {dnd ? <BellOff size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
                <span>Meldingen {dnd ? 'aan' : 'uit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-footer" ref={sidebarFooterRef}>
        <div className="sidebar-footer-tabbar" ref={sidebarFooterTabbarRef} role="navigation" aria-label="Sidebar navigatie">
          <button
            type="button"
            className="sidebar-footer-tab sidebar-footer-tab-profile"
            aria-label={`Open profielinstellingen voor ${user.displayName || user.email?.split('@')[0] || 'gebruiker'}, online`}
            onClick={onOpenProfile}
            title="Jij"
          >
            <span className="sidebar-footer-profile-avatar" aria-hidden="true">
              <UserAvatar photoURL={photoPreview || user.photoURL} displayName={user.displayName || user.email} className="sm" decorative />
              <span className="sidebar-footer-profile-dot" />
            </span>
            <span className="sidebar-footer-tab-label">Jij</span>
          </button>

          <button
            type="button"
            className={`sidebar-footer-tab ${activeTab === 'chats' ? 'active' : ''}`}
            aria-label="Chats"
            onClick={() => {
              setActiveTab('chats');
              onNewChat();
            }}
            title="Chats"
          >
            <span className="sidebar-footer-tab-wrap">
              <span className="sidebar-footer-tab-icon" aria-hidden="true">
                <Message size={26} aria-hidden="true" />
              </span>
              {hasMissedCall && !callsAvailable && <span className="sidebar-footer-tab-badge" aria-hidden="true" />}
            </span>
            <span className="sidebar-footer-tab-label">Chats</span>
          </button>

          {callsAvailable && (
            <button
              type="button"
              className="sidebar-footer-tab"
              aria-label="Oproepen"
              onClick={onShowCallModal}
              title="Oproepen"
            >
              <span className="sidebar-footer-tab-wrap">
                <span className="sidebar-footer-tab-icon" aria-hidden="true">
                  <Phone size={26} aria-hidden="true" />
                </span>
                {hasMissedCall && <span className="sidebar-footer-tab-badge" aria-hidden="true" />}
              </span>
              <span className="sidebar-footer-tab-label">Bellen</span>
            </button>
          )}

          {isParent && (
            <button
              type="button"
              className="sidebar-footer-tab"
              aria-label={parentActivityBadge > 0 ? `Open ouderportaal, ${parentActivityBadge > 9 ? 'meer dan 9' : parentActivityBadge} nieuwe activiteiten` : 'Open ouderportaal'}
              onClick={onOpenDashboard}
              title="Ouderportaal"
            >
              <span className="sidebar-footer-tab-wrap">
                <span className="sidebar-footer-tab-icon" aria-hidden="true">
                  <Shield size={26} aria-hidden="true" />
                </span>
                {parentActivityBadge > 0 && <span className="sidebar-footer-tab-count" aria-hidden="true">{parentActivityBadge > 9 ? '9+' : parentActivityBadge}</span>}
              </span>
              <span className="sidebar-footer-tab-label">Portaal</span>
            </button>
          )}

          <div className="sidebar-footer-tab-slot" ref={moreActionsMenuRef}>
            <button
              type="button"
              className="sidebar-footer-tab sidebar-footer-tab-more"
              aria-label="Meer acties"
              aria-expanded={moreActionsMenuOpen}
              onClick={() => setMoreActionsMenuOpen((prev) => !prev)}
              title="Meer acties"
            >
              <span className="sidebar-footer-tab-icon" aria-hidden="true">
                <MoreHoriz size={22} aria-hidden="true" />
              </span>
              <span className="sidebar-footer-tab-label">Meer</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
