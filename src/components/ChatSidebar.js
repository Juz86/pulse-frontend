// src/components/ChatSidebar.js
import React, { useEffect, useRef, useState } from 'react';
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
  const [contactMenu, setContactMenu] = useState(null);
  const [convMenu, setConvMenu]       = useState(null); // { conv, otherUid, direction, top, left }
  const [moreActionsMenuOpen, setMoreActionsMenuOpen] = useState(false);
  const moreActionsMenuRef = useRef(null);

  useEffect(() => {
    if (!moreActionsMenuOpen) return;
    function handleClickOutside(e) {
      if (moreActionsMenuRef.current && !moreActionsMenuRef.current.contains(e.target)) {
        setMoreActionsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const hasMissedCall = callsAvailable && (((!callLogRead && getCallLog().some(e => e.direction === 'missed')) || missedCallAlert));

  function openContactMenu(contactUid, anchorEl) {
    const rect = anchorEl?.getBoundingClientRect?.();
    if (!rect) return;
    const menuWidth = 160;
    const menuHeight = 320;
    const spacing = 8;
    const direction = rect.top < 420 ? 'down' : 'up';
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    const top = direction === 'down'
      ? Math.min(rect.bottom + spacing, window.innerHeight - menuHeight - 12)
      : Math.max(12, rect.top - menuHeight - spacing);
    setContactMenu(prev => prev?.uid === contactUid ? null : { uid: contactUid, direction, top, left });
  }

  function openConvMenu(conv, otherUid, anchorEl) {
    const rect = anchorEl?.getBoundingClientRect?.();
    if (!rect) return;
    const menuWidth = 188;
    const menuHeight = 280;
    const spacing = 8;
    const direction = rect.top < 420 ? 'down' : 'up';
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    const top = direction === 'down'
      ? Math.min(rect.bottom + spacing, window.innerHeight - menuHeight - 12)
      : Math.max(12, rect.top - menuHeight - spacing);
    setConvMenu(prev => prev?.conv?.id === conv.id ? null : { conv, otherUid, direction, top, left });
  }

  function handleOpenConversation(conv) {
    setConvMenu(null);
    setContactMenu(null);
    onOpenConversation(conv);
  }

  return (
    <aside className="sidebar" onClick={() => { setConvMenu(null); setContactMenu(null); }}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-top">
          <PulseLogo size={30} textSize={20} color="#fff" />
          <div style={{ display: 'flex', gap: '6px', position: 'relative' }}>
            <button
              type="button"
              className="icon-btn"
              aria-label="Nieuw bericht"
              onClick={onNewChat}
              title="Nieuw bericht"
              style={{ width: 34, height: 34 }}
            >
              <Message size={16} aria-hidden="true" />
            </button>
            {callsAvailable && (
              <button
                type="button"
                className="icon-btn"
                aria-label="Oproepen"
                onClick={onShowCallModal}
                title="Oproepen"
                style={{ position: 'relative', width: 34, height: 34 }}
              >
                <Phone size={16} aria-hidden="true" />
                {hasMissedCall && (
                  <span aria-hidden="true" style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--surface)' }} />
                )}
              </button>
            )}
          </div>
        </div>
        <div className="search-box">
          <Search size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
          <input aria-label={activeTab === 'chats' ? 'Zoeken in gesprekken' : 'Zoeken in contacten'} placeholder="Zoeken…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
            onMoreActionsEnter={(conv, otherUid, el) => openConvMenu(conv, otherUid, el)}
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

          {contacts.filter(c =>
            !searchQuery.trim() ||
            c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase())
          ).map(contact => (
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

          {contacts.length > 0 && searchQuery.trim() && contacts.filter(c =>
            c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase())
          ).length === 0 && (
            <div className="empty-convs" role="status" aria-live="polite">
              <p>Geen contacten gevonden.</p>
              <p>Er zijn geen resultaten voor "{searchQuery}".</p>
            </div>
          )}

        </div>
      )}

      {convMenu && (() => {
        const { conv, otherUid } = convMenu;
        const contact = contacts.find(c => c.uid === otherUid);
        const isParentBlocked = parentBlockedUids?.includes(otherUid);
        const isProtectedParentContact = !isParent && contact?.role === 'parent';
        const isPinned = pinnedContacts.includes(otherUid);
        const isMuted = mutedConversationIds.includes(conv.id);
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
            {conv.isGroup && (
              <button type="button" role="menuitem" className="chat-header-menu-item"
                onClick={() => { onShowGroupInfo?.(conv); setConvMenu(null); }} title="Groepsinfo">
                <Users size={14} aria-hidden="true" />
                <span>Groepsinfo</span>
              </button>
            )}
            {!conv.isGroup && contact && (
              <button type="button" role="menuitem" className="chat-header-menu-item"
                onClick={() => { onViewContact(contact); setConvMenu(null); }} title="Profiel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z" /></svg>
                <span>Profiel</span>
              </button>
            )}
            {!isParentBlocked && <>
              {!conv.isGroup && <button type="button" role="menuitem" className="chat-header-menu-item"
                onClick={() => { onOpenConversation(conv); setConvMenu(null); }} title="Bericht sturen">
                <Message size={14} aria-hidden="true" />
                <span>Bericht sturen</span>
              </button>}
              {!conv.isGroup && callsAvailable && (
                <>
                  <button type="button" role="menuitem" className="chat-header-menu-item"
                    onClick={() => { onCallFromConv(conv, false); setConvMenu(null); }} title="Bellen">
                    <Phone size={14} aria-hidden="true" />
                    <span>Bellen</span>
                  </button>
                  <button type="button" role="menuitem" className="chat-header-menu-item"
                    onClick={() => { onCallFromConv(conv, true); setConvMenu(null); }} title="Videobellen">
                    <Video size={14} aria-hidden="true" />
                    <span>Videobellen</span>
                  </button>
                </>
              )}
              {!conv.isGroup && otherUid && (
                <button type="button" role="menuitem" className={`chat-header-menu-item${isPinned ? ' active' : ''}`}
                  onClick={() => { onTogglePin(otherUid); setConvMenu(null); }} title={isPinned ? 'Losmaken' : 'Vastzetten'}>
                  <Pin size={14} aria-hidden="true" />
                  <span>{isPinned ? 'Losmaken' : 'Vastzetten'}</span>
                </button>
              )}
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isMuted}
                className={`chat-header-menu-item${isMuted ? ' active' : ''}`}
                onClick={() => { onToggleConversationMute?.(conv.id); setConvMenu(null); }}
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
                    onClick={() => { onEnterMessageSelectionForConversation?.(conv); setConvMenu(null); }}
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
                    onClick={() => { onShowStarredForConversation?.(conv); setConvMenu(null); }}
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
                onClick={() => { onLeaveGroup?.(conv); setConvMenu(null); }}
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
                  onClick={() => { onClearConversation?.(conv); setConvMenu(null); }}
                  title="Chat wissen"
                >
                  <XIcon size={14} aria-hidden="true" />
                  <span>Chat wissen</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="chat-header-menu-item danger"
                  onClick={() => { onHardDeleteConversation?.(conv); setConvMenu(null); }}
                  title="Chat verwijderen"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Chat verwijderen</span>
                </button>
                {contact && !isProtectedParentContact && (
                  <button type="button" role="menuitem" className="chat-header-menu-item danger"
                    onClick={() => { onBlockContact(contact); setConvMenu(null); }} title="Blokkeren">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
                    <span>Blokkeren</span>
                  </button>
                )}
              </>
            )}
          </div>
        );
      })()}

      {contactMenu && (() => {
        const contact = contacts.find(c => c.uid === contactMenu.uid);
        if (!contact) return null;
        const isParentBlocked = parentBlockedUids?.includes(contact.uid);
        const isProtectedParentContact = !isParent && contact?.role === 'parent';
        return (
          <div
            role="menu"
            aria-label={`Acties voor ${getContactDisplayName(contact)}`}
            data-sidebar-actions-menu
            onClick={e => e.stopPropagation()}
            className="chat-header-menu"
            style={{
              position: 'fixed', zIndex: 3000,
              top: contactMenu.top, left: contactMenu.left,
              minWidth: 160, gap: 2,
            }}
          >
            <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { onViewContact(contact); setContactMenu(null); }} title="Profiel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z" /></svg>
              <span>Profiel</span>
            </button>
            {!isParentBlocked && <>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { onStartChat(contact); setContactMenu(null); }} title="Bericht sturen">
                <Message size={14} aria-hidden="true" />
                <span>Bericht sturen</span>
              </button>
              {callsAvailable && (
                <>
                  <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { onCallContact(contact, false); setContactMenu(null); }} title="Bellen">
                    <Phone size={14} aria-hidden="true" />
                    <span>Bellen</span>
                  </button>
                  <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { onCallContact(contact, true); setContactMenu(null); }} title="Videobellen">
                    <Video size={14} aria-hidden="true" />
                    <span>Videobellen</span>
                  </button>
                </>
              )}
              <button type="button" role="menuitem" className={`chat-header-menu-item${pinnedContacts.includes(contact.uid) ? ' active' : ''}`} onClick={() => { onTogglePin(contact.uid); setContactMenu(null); }} title={pinnedContacts.includes(contact.uid) ? 'Losmaken' : 'Vastzetten'}>
                <Pin size={14} aria-hidden="true" />
                <span>{pinnedContacts.includes(contact.uid) ? 'Losmaken' : 'Vastzetten'}</span>
              </button>
            </>}
            {!isProtectedParentContact && <div className="chat-header-menu-divider" />}
            {!isProtectedParentContact && !isParentBlocked && (
              <button type="button" role="menuitem" className="chat-header-menu-item danger" onClick={() => { onBlockContact(contact); setContactMenu(null); }} title="Blokkeren">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
                <span>Blokkeren</span>
              </button>
            )}
            {!isProtectedParentContact && (
              <button type="button" role="menuitem" className="chat-header-menu-item danger" onClick={() => { onRemoveContact(contact.uid); setContactMenu(null); }} title="Verwijderen">
                <Trash2 size={14} aria-hidden="true" />
                <span>Verwijderen</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* Footer */}
      <div className="sidebar-footer">
        <button type="button" className="user-chip" style={{ cursor: 'pointer' }} aria-label={`Open profielinstellingen voor ${user.displayName || user.email?.split('@')[0] || 'gebruiker'}, online`} onClick={onOpenProfile}>
          <div className="avatar-wrap" style={{ flexShrink: 0 }} aria-hidden="true">
            <UserAvatar photoURL={photoPreview || user.photoURL} displayName={user.displayName || user.email} className="sm" decorative />
          </div>
          <div className="user-chip-info" aria-hidden="true">
            <div className="user-chip-name">{user.displayName || user.email?.split('@')[0] || 'Gebruiker'}</div>
            <div className="user-chip-status">Online</div>
          </div>
        </button>
        {isParent && (
          <button type="button" className="icon-btn parent-dashboard-btn" aria-label={parentActivityBadge > 0 ? `Open ouderlijk toezicht, ${parentActivityBadge > 9 ? 'meer dan 9' : parentActivityBadge} nieuwe activiteiten` : 'Open ouderlijk toezicht'} onClick={onOpenDashboard} title="Ouderlijk toezicht" style={{ position: 'relative' }}>
            <Shield size={18} aria-hidden="true" />
            {parentActivityBadge > 0 && <span className="parent-badge" aria-hidden="true">{parentActivityBadge > 9 ? '9+' : parentActivityBadge}</span>}
          </button>
        )}
        <div style={{ position: 'relative' }} ref={moreActionsMenuRef}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Meer acties"
            aria-expanded={moreActionsMenuOpen}
            onClick={() => setMoreActionsMenuOpen((prev) => !prev)}
            title="Meer acties"
            style={{ position: 'relative' }}
          >
            <MoreHoriz size={18} aria-hidden="true" />
            {hasMissedCall && (
              <span aria-hidden="true" style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--surface)' }} />
            )}
          </button>
          {moreActionsMenuOpen && (
            <div
              role="menu"
              aria-label="Meer acties"
              className="chat-header-menu"
              style={{
                position: 'absolute',
                bottom: 42,
                right: 0,
                zIndex: 500,
              }}
            >
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { setMoreActionsMenuOpen(false); setActiveTab('contacts'); onShowAddContact(); }}>
                <Plus size={15} aria-hidden="true" />
                <span>Nieuw contact</span>
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { setMoreActionsMenuOpen(false); onNewGroup(); }}>
                <Users size={15} aria-hidden="true" />
                <span>Nieuwe groep</span>
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { setMoreActionsMenuOpen(false); setActiveTab('contacts'); setShowFriendRequestsPanel(true); }}>
                <Handshake size={15} aria-hidden="true" />
                <span>Verzoeken</span>
                {(friendRequests.length + sentFriendRequests.length) > 0 && (
                  <span className="unread-badge" style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px' }}>{friendRequests.length + sentFriendRequests.length}</span>
                )}
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { setMoreActionsMenuOpen(false); if (selectionMode) onCancelConversationSelection?.(); else { setActiveTab('chats'); onEnterConversationSelection?.(); } }}>
                <Message size={15} aria-hidden="true" />
                <span>{selectionMode ? 'Chats selecteren stoppen' : 'Chats selecteren'}</span>
              </button>
              <button type="button" role="menuitem" className={`chat-header-menu-item${dnd ? ' active' : ''}`} onClick={() => { setMoreActionsMenuOpen(false); onToggleDnd(); }}>
                {dnd ? <BellOff size={15} aria-hidden="true" /> : <Bell size={15} aria-hidden="true" />}
                <span>Meldingen {dnd ? 'aan' : 'uit'}</span>
              </button>
              {callsAvailable && (
                <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => { setMoreActionsMenuOpen(false); onShowCallModal(); }}>
                  <Phone size={15} aria-hidden="true" />
                  <span>Oproepen</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
