// src/components/ChatSidebar.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, Video, Search, Message, Users, Bell, BellOff, Shield, Logout, Pin, MoreHoriz, Plus, XIcon, Trash2, StarOutline, Handshake, User, Clock, Palette, Cancel, Heart, Check, Camera, EyeOn, EyeOff, ImageIcon, ColorCircle, LayoutTemplate } from '../components/Icons';
import PulseLogo from '../components/PulseLogo';
import { ProfilePageHero, ProfilePageShell } from '../components/ProfilePageShell';
import UserAvatar from '../components/UserAvatar';
import ConversationList from './ConversationList';
import ParentDashboard from '../screens/ParentDashboard';
import { formatTime, getInitials, HISTORY_RETENTION_OPTIONS, normalizeHistoryRules } from '../utils';
import chatDefaultPattern from '../assets/chatachtergrond.jpeg';

function SidebarHistorySelect({ ariaLabel, value, options, onChange, disabled = false, style }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedOption = options.find((option) => String(option.value) === String(value)) || options[0];
  const resolvedTextColor = 'rgba(255,255,255,0.96)';

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        style={{
          ...style,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ color: resolvedTextColor, fontWeight: 700 }}>{selectedOption?.label || ''}</span>
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 50,
            padding: '8px',
            borderRadius: 20,
            border: '1px solid rgba(140, 122, 214, 0.14)',
            background: 'linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(244,239,255,.98) 100%)',
            boxShadow: '0 18px 36px rgba(106, 87, 180, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  minHeight: 42,
                  borderRadius: 14,
                  border: isSelected ? '1px solid rgba(173, 141, 255, 0.22)' : '1px solid rgba(140,122,214,0.08)',
                  background: isSelected
                    ? 'linear-gradient(135deg, #8374ff 0%, #a855f7 100%)'
                    : 'rgba(255,255,255,0.72)',
                  color: isSelected ? '#fff' : '#241741',
                  fontSize: '14px',
                  fontWeight: isSelected ? 700 : 600,
                  padding: '0 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 10px 24px rgba(106, 87, 180, 0.18)' : 'inset 0 1px 0 rgba(255,255,255,.72)',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  contacts,
  sharingContact = null,
  setSharingContact,
  shareRecipients = [],
  setShareRecipients,
  onShareContact,
  conversations,
  activeConv,
  loadingConvs,
  convLabels,
  pinnedContacts,
  unreadCounts,
  typingByConv = {},
  photoPreview,
  setPhotoPreview,
  isParent,
  parentActivityBadge,
  onOpenDashboard,
  showParentDashboard = false,
  setShowParentDashboard,
  onParentActivitiesViewed,
  setLabelMenuConvId,
  // modal openers
  showNewChat = false,
  setShowNewChat,
  searchEmail = '',
  setSearchEmail,
  searchErr,
  searchResult,
  searchUser,
  startConversationWith,
  showNewGroup = false,
  setShowNewGroup,
  groupName = '',
  setGroupName,
  groupMembers = [],
  toggleGroupMember,
  createGroup,
  onShowCallModal,
  showCallModal = false,
  setShowCallModal,
  showAddContact = false,
  setShowAddContact,
  contactEmail = '',
  setContactEmail,
  contactNickname = '',
  setContactNickname,
  contactRelation,
  setContactRelation,
  contactErr,
  contactLoading = false,
  addContact,
  clearPendingFriendRequestState,
  onOpenProfile,
  showProfile = false,
  contactProfileVisible = false,
  onCloseContactProfile,
  groupInfoVisible = false,
  onCloseGroupInfo,
  onShowChatsFromContextPanel,
  setShowProfile,
  profileTab = 'overview',
  setProfileTab,
  newName = '',
  setNewName,
  newUsername = '',
  showNewPassword = false,
  setShowNewPassword,
  newPassword = '',
  setNewPassword,
  confirmPassword = '',
  setConfirmPassword,
  passwordLoading = false,
  passwordMsg = '',
  profileMsg = '',
  profileLoading = false,
  historyRules,
  setHistoryRules,
  childHistoryRulesByUid,
  setChildHistoryRulesByUid,
  historyChildren = [],
  historySettingsLoading = false,
  historySettingsSavingTarget,
  historySettingsMsg = '',
  chatBgTab,
  setChatBgTab,
  chatBgMsg = '',
  chatBg,
  chatBgLoading = false,
  saveProfile,
  changePassword,
  saveHistorySettings,
  saveChildHistorySettings,
  uploadChatBgPhoto,
  saveChatBgColor,
  removeChatBg,
  handlePhotoChange,
  handleDeleteAccount,
  photoInputRef,
  bgInputRef,
  setShowAvatarBuilder,
  onProfileHistoryOpen,
  onRequestSettingsLogout,
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
  conversationActionsRequest,
  onConversationActionsRequestHandled,
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
  callContact,
  callContactFromRecent,
  callLogRateLimitUntil = 0,
}) {
  const sidebarRef = useRef(null);
  const sidebarHeaderRef = useRef(null);
  const sidebarTabsRef = useRef(null);
  const sidebarFooterRef = useRef(null);
  const sidebarFooterTabbarRef = useRef(null);
  const [contactMenu, setContactMenu] = useState(null);
  const [convMenu, setConvMenu]       = useState(null); // { conv, otherUid, direction, top, left }
  const [convActionsSheet, setConvActionsSheet] = useState(null); // { conv, otherUid }
  const [moreActionsMenuOpen, setMoreActionsMenuOpen] = useState(false);
  const [moreActionsMenuClosing, setMoreActionsMenuClosing] = useState(false);
  const [addContactSheetClosing, setAddContactSheetClosing] = useState(false);
  const [newChatSheetClosing, setNewChatSheetClosing] = useState(false);
  const [newGroupSheetClosing, setNewGroupSheetClosing] = useState(false);
  const [requestsSheetClosing, setRequestsSheetClosing] = useState(false);
  const [callSheetClosing, setCallSheetClosing] = useState(false);
  const [profileSheetClosing, setProfileSheetClosing] = useState(false);
  const [parentPortalSheetClosing, setParentPortalSheetClosing] = useState(false);
  const [parentPortalView, setParentPortalView] = useState('menu');
  const [callSearch, setCallSearch] = useState('');
  const [shareContactSearch, setShareContactSearch] = useState('');
  const [callActionMode, setCallActionMode] = useState(null);
  const [requestsTab, setRequestsTab] = useState('ontvangen');
  const [selectedHistoryChildUid, setSelectedHistoryChildUid] = useState('');
  const [pendingColor, setPendingColor] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const moreActionsMenuRef = useRef(null);
  const profilePanelRef = useRef(null);
  const parentPortalPanelRef = useRef(null);
  const moreActionsCloseTimeoutRef = useRef(null);
  const addContactSheetCloseTimeoutRef = useRef(null);
  const newChatSheetCloseTimeoutRef = useRef(null);
  const newGroupSheetCloseTimeoutRef = useRef(null);
  const requestsSheetCloseTimeoutRef = useRef(null);
  const callSheetCloseTimeoutRef = useRef(null);
  const profileSheetCloseTimeoutRef = useRef(null);
  const parentPortalSheetCloseTimeoutRef = useRef(null);
  const convSheetHistoryPushedRef = useRef(false);
  const moreActionsSheetHistoryPushedRef = useRef(false);
  const contactSheetHistoryPushedRef = useRef(false);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const moreActionsSheetVisible = moreActionsMenuOpen || moreActionsMenuClosing;
  const addContactSheetVisible = showAddContact || addContactSheetClosing;
  const newChatSheetVisible = showNewChat || newChatSheetClosing;
  const shareContactPageVisible = Boolean(sharingContact);
  const closeShareContactPage = () => {
    setSharingContact?.(null);
    setShareRecipients?.([]);
    setShareContactSearch('');
  };
  const newGroupSheetVisible = showNewGroup || newGroupSheetClosing;
  const requestsSheetVisible = showFriendRequestsPanel || requestsSheetClosing;
  const contactSheetVisible = !!contactMenu;
  const conversationSheetVisible = !!convActionsSheet;
  const callSheetVisible = showCallModal || callSheetClosing;
  const embeddedSettingsActive = showProfile && (profileTab === 'overview' || profileTab === 'account' || profileTab === 'geschiedenis' || profileTab === 'styling' || profileTab === 'geblokkeerd');
  const settingsSheetVisible = embeddedSettingsActive || profileSheetClosing;
  const settingsProfilePageVisible = embeddedSettingsActive && profileTab === 'overview';
  const accountProfilePageVisible = embeddedSettingsActive && profileTab === 'account';
  const historyProfilePageVisible = embeddedSettingsActive && profileTab === 'geschiedenis';
  const stylingProfilePageVisible = embeddedSettingsActive && profileTab === 'styling';
  const blockedProfilePageVisible = embeddedSettingsActive && profileTab === 'geblokkeerd';
  const parentPortalPageVisible = showParentDashboard || parentPortalSheetClosing;
  const callsProfilePageVisible = callSheetVisible;
  const contactActionsPageVisible = contactSheetVisible;
  const conversationActionsPageVisible = conversationSheetVisible;
  const footerClusterMode = (settingsProfilePageVisible || accountProfilePageVisible || historyProfilePageVisible || stylingProfilePageVisible || blockedProfilePageVisible || parentPortalPageVisible || callsProfilePageVisible || contactActionsPageVisible || conversationActionsPageVisible || moreActionsSheetVisible || newChatSheetVisible || shareContactPageVisible || addContactSheetVisible || newGroupSheetVisible || requestsSheetVisible) ? null : (settingsSheetVisible ? 'settings' : (contactSheetVisible ? 'contact' : (conversationSheetVisible ? 'conversation' : null)));
  const profileSections = useMemo(() => ([
    { id: 'account', icon: <User size={18} aria-hidden="true" />, label: 'Mijn account', description: 'Naam, foto en wachtwoord' },
    ...(isParent ? [{ id: 'geschiedenis', icon: <Clock size={18} aria-hidden="true" />, label: 'Privacy', description: 'Jij bepaalt' }] : []),
    { id: 'styling', icon: <Palette size={18} aria-hidden="true" />, label: 'Styling', description: 'Chatachtergrond en sfeer' },
    { id: 'geblokkeerd', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>, label: 'Geblokkeerd', description: 'Beheer geblokkeerde contacten' },
  ]), [isParent]);
  const activeProfileSection = profileSections.find((section) => section.id === profileTab) || null;
  const isChildAccount = !!user?.email?.endsWith('@pulse.internal');
  const primaryHistoryChild = historyChildren.find((child) => child.uid === selectedHistoryChildUid) || historyChildren[0] || null;
  const primaryHistoryRules = normalizeHistoryRules(primaryHistoryChild ? childHistoryRulesByUid?.[primaryHistoryChild.uid] : {});
  const canManagePrimaryHistoryChild = !!primaryHistoryChild?.canManageHistory;
  const historySettingRows = [
    { key: 'chatRetentionDays', label: 'Chats' },
    { key: 'callRetentionDays', label: 'Bellen' },
    { key: 'videoRetentionDays', label: 'Videobellen' },
  ];
  const settingsDisplayName = user.displayName || user.email?.split('@')[0] || 'Gebruiker';
  const settingsEmail = user.email || '';
  const isCurrentUserOnline = !!(user?.uid && onlineUsers?.has(user.uid));
  const isCurrentUserInactive = !!(user?.uid && inactiveUsers?.has(user.uid));
  const settingsStatusClass = isCurrentUserOnline
    ? (isCurrentUserInactive ? 'inactive' : 'online')
    : 'offline';
  const settingsStatusLabel = isCurrentUserOnline
    ? (isCurrentUserInactive ? 'Afwezig' : 'Online')
    : 'Offline';
  const historySelectStyle = {
    width: '100%',
    minHeight: 48,
    borderRadius: 18,
    border: '1px solid rgba(140, 122, 214, 0.14)',
    background: 'linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(244,239,255,.96) 100%)',
    boxShadow: '0 10px 22px rgba(106, 87, 180, 0.08)',
    color: '#241741',
    padding: '0 44px 0 14px',
    fontSize: '14px',
    fontWeight: 700,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236f5ef0' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    backgroundSize: '14px',
    display: 'flex',
    alignItems: 'center',
  };
  const renderSimpleSidebarActionList = (items) => (
    <div className="sidebar-settings-sheet-scroll">
      <div className="pulse-sheet-list pulse-sheet-list--sidebar-actions">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className={`chat-header-menu-item${item.active ? ' active' : ''}${item.danger ? ' danger' : ''}`}
            onClick={item.onClick}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.trailing || null}
          </button>
        ))}
      </div>
    </div>
  );
  const renderSettingsOverviewSheet = () => {
    const rowSections = profileSections;
    const renderOverviewRow = (section, extraClassName = '') => (
      <button
        key={section.id}
        type="button"
        className={`contact-profile-row-button${extraClassName ? ` ${extraClassName}` : ''}`}
        onClick={() => {
          setProfileTab?.(section.id);
          if (section.id === 'geschiedenis') onProfileHistoryOpen?.();
        }}
      >
        <span className="contact-profile-row-icon" aria-hidden="true">{section.icon}</span>
        <span className="contact-profile-row-copy">
          <span className="contact-profile-row-title">{section.label}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="contact-profile-row-arrow">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    );
    return (
      <ProfilePageShell
        panelRef={profilePanelRef}
        titleId="settings-profile-title"
        title="Instellingen"
        description="Bekijk en beheer je instellingen in dezelfde profielopbouw."
        onBack={dismissProfileOverviewSheet}
        backLabel="Instellingen sluiten"
        headerAction={(
          <button
            type="button"
            className="contact-profile-edit-btn contact-profile-close-btn"
            aria-label="Instellingen sluiten"
            title="Sluiten"
            onClick={dismissProfileOverviewSheet}
          >
            <XIcon size={20} aria-hidden="true" />
          </button>
        )}
        hero={(
          <ProfilePageHero
            avatar={(
              <UserAvatar
                photoURL={photoPreview || undefined}
                displayName={settingsDisplayName}
                className="profile-avatar-big contact-profile-avatar"
              />
            )}
            name={settingsDisplayName}
            subtitle={settingsEmail || null}
            status={(
              <div className={`profile-status-badge contact-profile-status ${settingsStatusClass}`}>
                <span className="profile-status-dot" aria-hidden="true" />
                {settingsStatusLabel}
              </div>
            )}
          />
        )}
      >
        <section className="contact-profile-card contact-profile-card--settings-actions">
          {rowSections.map((section) => renderOverviewRow(section))}
        </section>

        <section className="contact-profile-card contact-profile-card-danger contact-profile-card--profile-danger">
          <button
            type="button"
            className="contact-profile-row-button danger"
            onClick={() => {
              closeProfileOverviewSheet();
              onRequestSettingsLogout?.();
            }}
          >
            <span className="contact-profile-row-icon" aria-hidden="true">
              <Logout size={18} />
            </span>
            <span className="contact-profile-row-copy">
              <span className="contact-profile-row-title">Uitloggen</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="contact-profile-row-arrow">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </section>
      </ProfilePageShell>
    );
  };

  const renderMoreActionsPage = () => {
    const rowActions = [
      {
        id: 'new-chat',
        icon: <Message size={18} aria-hidden="true" />,
        label: 'Nieuwe chat',
        description: 'Start een nieuw gesprek.',
        onClick: () => {
          closeProfileOverviewSheet();
          closeAddContactSheet();
          closeCallSheet();
          closeNewGroupSheet();
          closeMoreActionsSheet();
          setShowNewChat?.(true);
        },
      },
      {
        id: 'new-contact',
        icon: <Plus size={18} aria-hidden="true" />,
        label: 'Nieuw contact',
        description: 'Voeg familie en vrienden toe.',
        onClick: () => {
          closeProfileOverviewSheet();
          closeNewChatSheet();
          closeCallSheet();
          closeNewGroupSheet();
          closeMoreActionsSheet();
          setActiveTab('contacts');
          setShowAddContact?.(true);
        },
      },
      {
        id: 'new-group',
        icon: <Users size={18} aria-hidden="true" />,
        label: 'Nieuwe groep',
        description: 'Start een groepsgesprek.',
        onClick: () => {
          closeProfileOverviewSheet();
          closeAddContactSheet();
          closeNewChatSheet();
          closeCallSheet();
          closeMoreActionsSheet();
          setShowNewGroup?.(true);
        },
      },
      {
        id: 'requests',
        icon: <Handshake size={18} aria-hidden="true" />,
        label: 'Verzoeken',
        description: 'Beheer vriendschapsverzoeken.',
        onClick: () => {
          closeProfileOverviewSheet();
          closeAddContactSheet();
          closeNewChatSheet();
          closeNewGroupSheet();
          closeCallSheet();
          closeMoreActionsSheet();
          setActiveTab('contacts');
          setShowFriendRequestsPanel?.(true);
        },
      },
      ...(!selectionMode ? [{
        id: 'selection',
        icon: <Message size={18} aria-hidden="true" />,
        label: 'Chats selecteren',
        description: 'Selecteer meerdere gesprekken tegelijk.',
        onClick: () => {
          closeMoreActionsSheet();
          setActiveTab('chats');
          onEnterConversationSelection?.();
        },
      }] : []),
      {
        id: 'dnd',
        icon: dnd ? <Bell size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />,
        label: `Meldingen ${dnd ? 'aan' : 'uit'}`,
        description: dnd ? 'Schakel meldingen weer in.' : 'Schakel meldingen tijdelijk uit.',
        danger: !dnd,
        onClick: () => {
          onToggleDnd();
        },
      },
    ];

    return (
      <ProfilePageShell
        panelRef={profilePanelRef}
        titleId="more-actions-title"
        title="Meer opties"
        description="Open extra acties vanuit dezelfde profielopbouw als instellingen."
        onBack={dismissMoreActionsSheet}
        backLabel="Meer opties sluiten"
        headerAction={(
          <button
            type="button"
            className="contact-profile-edit-btn contact-profile-close-btn"
            aria-label="Meer opties sluiten"
            title="Sluiten"
            onClick={dismissMoreActionsSheet}
          >
            <XIcon size={20} aria-hidden="true" />
          </button>
        )}
      >
        <section className="contact-profile-card contact-profile-card--more-actions">
          {rowActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`contact-profile-row-button${action.danger ? ' danger' : ''}`}
              onClick={action.onClick}
            >
              <span className="contact-profile-row-icon" aria-hidden="true">{action.icon}</span>
              <span className="contact-profile-row-copy">
                <span className="contact-profile-row-title">{action.label}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="contact-profile-row-arrow">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </section>
      </ProfilePageShell>
    );
  };

  const renderNewChatPage = () => (
    <ProfilePageShell
      panelRef={profilePanelRef}
      className="chat-side-panel contact-profile-panel new-chat-page-panel"
      titleId="new-chat-title"
      title="Nieuwe chat"
      description="Zoek een contact of start een gesprek vanuit dezelfde profielopbouw."
      onBack={() => navigateBackToMoreActions(closeNewChatSheet)}
      backLabel="Terug naar meer opties"
      headerAction={(
        <button
          type="button"
          className="contact-profile-edit-btn contact-profile-close-btn"
          aria-label="Nieuwe chat sluiten"
          title="Sluiten"
          onClick={dismissNewChatSheet}
        >
          <XIcon size={20} aria-hidden="true" />
        </button>
      )}
    >
      <div className="calls-dashboard-search new-chat-page-search">
        <div className="search-box search-box--top sidebar-call-search-box">
          <Search size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
          <input
            className="sidebar-call-search-input"
            placeholder="Naam of telefoonnummer zoeken"
            value={searchEmail}
            onChange={(e) => setSearchEmail?.(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUser?.()}
          />
          {searchEmail && (
            <button type="button" className="sidebar-call-search-clear" aria-label="Zoekopdracht wissen" onClick={() => setSearchEmail?.('')}>
              <Cancel size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        {searchErr && (
          <div className="contact-profile-field">
            <div className="auth-error">⚠️ {searchErr}</div>
          </div>
        )}
      </div>

      {(searchResult || contacts.length > 0) && (
        <section className="calls-dashboard-section calls-dashboard-section--contacts new-chat-page-directory">
          <div className="sidebar-call-list calls-dashboard-list calls-dashboard-list--contacts new-chat-contact-list">
            {searchResult && (
              <button type="button" className="sidebar-contact-card sidebar-contact-card--call-log new-chat-sheet-result new-chat-sheet-result--lookup" onClick={() => startConversationWith?.(searchResult)}>
                <div className="sidebar-contact-row sidebar-contact-row--call-log">
                  <UserAvatar photoURL={searchResult.photoURL} displayName={searchResult.displayName} className="sm" decorative />
                  <div className="conv-info call-log-picker-copy new-chat-sheet-result-copy">
                    <div className="conv-name">{searchResult.displayName}</div>
                    <div className="conv-preview">{searchResult.email}</div>
                  </div>
                </div>
              </button>
            )}
            {filteredNewChatContacts.map((contact) => (
              <button key={contact.uid} type="button" className="sidebar-contact-card sidebar-contact-card--call-log new-chat-sheet-result" onClick={() => startConversationWith?.(contact)}>
                <div className="sidebar-contact-row sidebar-contact-row--call-log">
                  <UserAvatar photoURL={contact.photoURL} displayName={contact.displayName} className="sm" decorative />
                  <div className="conv-info call-log-picker-copy new-chat-sheet-result-copy">
                    <div className="conv-name">{getContactDisplayName(contact)}</div>
                    <div className="conv-preview">{contact.email}</div>
                  </div>
                </div>
              </button>
            ))}
            {!searchResult && filteredNewChatContacts.length === 0 && (
              <div className="new-chat-sheet-empty">
                Geen contacten die overeenkomen met je zoekopdracht.
              </div>
            )}
          </div>
        </section>
      )}
    </ProfilePageShell>
  );

  const renderShareContactPage = () => {
    const sendSharedContact = () => {
      if (!sharingContact || shareRecipients.length === 0) return;
      shareRecipients.forEach((uid) => {
        const recipient = contacts.find((contact) => contact.uid === uid);
        if (recipient) onShareContact?.(recipient, sharingContact);
      });
      closeShareContactPage();
    };
    return (
      <ProfilePageShell
        className="chat-side-panel contact-profile-panel share-contact-page-panel"
        panelRef={profilePanelRef}
        titleId="share-contact-page-title"
        title="Contact delen"
        description="Kies contacten waarmee je deze contactpersoon wilt delen."
        onBack={closeShareContactPage}
        backLabel="Contact delen sluiten"
        headerAction={(
          <button
            type="button"
            className="contact-profile-edit-btn contact-profile-close-btn"
            aria-label="Contact delen sluiten"
            title="Sluiten"
            onClick={closeShareContactPage}
          >
            <XIcon size={20} aria-hidden="true" />
          </button>
        )}
      >
        <div className="calls-dashboard-search new-chat-page-search">
          <div className="search-box search-box--top sidebar-call-search-box">
            <Search size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
            <input
              className="sidebar-call-search-input"
              placeholder="Naam of e-mailadres zoeken"
              value={shareContactSearch}
              onChange={(event) => setShareContactSearch(event.target.value)}
            />
            {shareContactSearch && (
              <button type="button" className="sidebar-call-search-clear" aria-label="Zoekopdracht wissen" onClick={() => setShareContactSearch('')}>
                <Cancel size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <section className="calls-dashboard-section calls-dashboard-section--contacts new-chat-page-directory share-contact-page-directory">
          <div className="sidebar-call-list calls-dashboard-list calls-dashboard-list--contacts new-chat-contact-list">
            {filteredShareRecipients.map((contact) => {
              const selected = shareRecipients.includes(contact.uid);
              return (
                <button
                  key={contact.uid}
                  type="button"
                  className={`sidebar-contact-card sidebar-contact-card--call-log share-contact-page-row${selected ? ' selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setShareRecipients?.((current) => current.includes(contact.uid) ? current.filter((uid) => uid !== contact.uid) : [...current, contact.uid])}
                >
                  <div className="sidebar-contact-row sidebar-contact-row--call-log">
                    <span className="share-contact-page-selection" aria-hidden="true">
                      {selected && <Check size={18} className="share-contact-page-check" />}
                    </span>
                    <UserAvatar photoURL={contact.photoURL} displayName={contact.displayName} className="sm" decorative />
                    <div className="conv-info call-log-picker-copy">
                      <div className="conv-name">{getContactDisplayName(contact)}</div>
                      <div className="conv-preview">{contact.email}</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredShareRecipients.length === 0 && (
              <div className="new-chat-sheet-empty">Geen contacten die overeenkomen met je zoekopdracht.</div>
            )}
          </div>
        </section>

        <div className="share-contact-page-footer">
          <button type="button" className="btn-primary" disabled={shareRecipients.length === 0} onClick={sendSharedContact}>
            Versturen{shareRecipients.length > 1 ? ` (${shareRecipients.length})` : ''}
          </button>
        </div>
      </ProfilePageShell>
    );
  };

  const renderAddContactPage = () => (
    <ProfilePageShell
      panelRef={profilePanelRef}
      titleId="add-contact-title"
      title="Nieuw contact"
      description="Voeg familie en vrienden toe vanuit dezelfde profielopbouw."
      onBack={() => navigateBackToMoreActions(closeAddContactSheet)}
      backLabel="Terug naar meer opties"
      headerAction={(
        <button
          type="button"
          className="contact-profile-edit-btn contact-profile-close-btn"
          aria-label="Nieuw contact sluiten"
          title="Sluiten"
          onClick={dismissAddContactSheet}
        >
          <XIcon size={20} aria-hidden="true" />
        </button>
      )}
    >
      <section className="add-contact-sheet-body add-contact-page-section">
        <div className="contact-profile-field">
          <p id="add-contact-description" className="new-chat-sheet-sub">
            Voeg familie en vrienden toe via e-mailadres of naam<code>@pulse.internal</code>.
          </p>
        </div>
        <div className="contact-profile-field">
          <div className="contact-profile-field-label">E-mailadres of naam@pulse.internal</div>
          <div className="sheet-input-wrap">
            <input
              className="form-input sheet-form-input"
              placeholder="naam@voorbeeld.nl, kind@pulse.internal of gebruikersnaam"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail?.(e.target.value);
                clearPendingFriendRequestState?.();
              }}
              onKeyDown={(e) => e.key === 'Enter' && addContact?.()}
            />
          </div>
        </div>
        <div className="contact-profile-field">
          <div className="contact-profile-field-label">Relatie</div>
          <div className="label-chip-row">
            {['familie', 'vrienden'].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setContactRelation?.(contactRelation === label ? null : label)}
                className={`label-chip${contactRelation === label ? ' active' : ''}`}
              >
                {label === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
              </button>
            ))}
          </div>
        </div>
        {contactErr && (
          <div className="contact-profile-field">
            <div className="auth-error">⚠️ {contactErr}</div>
          </div>
        )}
        <div className="contact-profile-field">
          <div className="modal-actions add-contact-sheet-actions">
            <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => addContact?.()} disabled={contactLoading}>
              {contactLoading ? 'Verzenden…' : 'Verzoek sturen →'}
            </button>
          </div>
        </div>
      </section>
    </ProfilePageShell>
  );

  const renderNewGroupPage = () => (
    <ProfilePageShell
      panelRef={profilePanelRef}
      className="chat-side-panel contact-profile-panel new-group-page-panel"
      titleId="new-group-title"
      title="Nieuwe groep"
      description="Start een groepsgesprek vanuit dezelfde profielopbouw."
      onBack={() => navigateBackToMoreActions(closeNewGroupSheet)}
      backLabel="Terug naar meer opties"
      headerAction={(
        <button
          type="button"
          className="contact-profile-edit-btn contact-profile-close-btn"
          aria-label="Nieuwe groep sluiten"
          title="Sluiten"
          onClick={dismissNewGroupSheet}
        >
          <XIcon size={20} aria-hidden="true" />
        </button>
      )}
    >
      <section className="contact-profile-card new-group-page-section">
        <div className="contact-profile-field">
          <div className="contact-profile-field-label">Groepsnaam</div>
          <div className="sheet-input-wrap">
            <input
              className="form-input sheet-form-input"
              placeholder="Bijv. Familie, Werk…"
              value={groupName}
              onChange={(e) => setGroupName?.(e.target.value)}
              maxLength={50}
            />
          </div>
        </div>
      </section>

      <section className="contact-profile-card new-group-page-section">
        <div className="contact-profile-field-label">Kies deelnemers</div>
        {contacts.length === 0 && (
          <div className="contact-profile-field">
            <div className="auth-error">⚠️ Voeg eerst contacten toe.</div>
          </div>
        )}
        <div className="pulse-sheet-list pulse-sheet-list--new-chat new-group-contact-list">
          {contacts.map((contact) => {
            const selected = groupMembers.find((member) => member.uid === contact.uid);
            const contactTitle = getContactDisplayName(contact)
              || contact.displayName
              || contact.username
              || (contact.email ? contact.email.split('@')[0] : '')
              || 'Contactpersoon';
            return (
              <button
                key={contact.uid}
                type="button"
                className={`search-result new-chat-sheet-result new-group-sheet-result${selected ? ' selected' : ''}`}
                onClick={() => toggleGroupMember?.(contact)}
              >
                <UserAvatar photoURL={contact.photoURL} displayName={contactTitle} className="sm" decorative />
                <div className="new-group-sheet-result-copy">
                  <div className="conv-name">{contactTitle}</div>
                  <div className="conv-preview">{contact.email}</div>
                </div>
                {selected
                  ? <span className="new-group-sheet-check new-group-sheet-check--selected"><Check size={14} color="#fff" /></span>
                  : <span className="new-group-sheet-check" />
                }
              </button>
            );
          })}
        </div>
        {groupMembers.length > 0 && (
          <div className="contact-profile-field">
            <p className="new-chat-sheet-sub">{groupMembers.length} deelnemer(s) geselecteerd</p>
          </div>
        )}
        <div className="contact-profile-field new-group-page-footer">
          <div className="modal-actions add-contact-sheet-actions">
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={() => createGroup?.()}
              disabled={!groupName.trim() || groupMembers.length === 0}
            >
              Groep aanmaken →
            </button>
          </div>
        </div>
      </section>
    </ProfilePageShell>
  );

  const renderRequestsPage = () => (
    <ProfilePageShell
      className="chat-side-panel contact-profile-panel friend-requests-page-panel"
      panelRef={profilePanelRef}
      titleId="requests-title"
      title="Verzoeken"
      description="Beheer binnenkomende en verstuurde vriendschapsverzoeken."
      onBack={() => navigateBackToMoreActions(closeRequestsSheet)}
      backLabel="Terug naar meer opties"
      headerAction={(
        <button
          type="button"
          className="contact-profile-edit-btn contact-profile-close-btn"
          aria-label="Verzoeken sluiten"
          title="Sluiten"
          onClick={dismissRequestsSheet}
        >
          <XIcon size={20} aria-hidden="true" />
        </button>
      )}
    >
      <div className="friend-requests-tabs">
        <button
          type="button"
          onClick={() => setRequestsTab('ontvangen')}
          className={`friend-requests-tab${requestsTab === 'ontvangen' ? ' active' : ''}`}
        >
          Ontvangen
          {friendRequests.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800 }}>{friendRequests.length}</span>}
        </button>
        <button
          type="button"
          onClick={() => setRequestsTab('verstuurd')}
          className={`friend-requests-tab${requestsTab === 'verstuurd' ? ' active' : ''}`}
        >
          Verstuurd
          {sentFriendRequests.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800 }}>{sentFriendRequests.length}</span>}
        </button>
      </div>

      <section className="contact-profile-card contact-profile-card--requests-list">
        <div className="pulse-sheet-list pulse-sheet-list--new-chat friend-requests-list">
          {requestsTab === 'ontvangen' && (
            <>
              {friendRequests.map((req) => (
                <div key={req.id} className="friend-request-row">
                  <div className="avatar-circle sm" aria-hidden="true">{req.fromName?.slice?.(0, 2)?.toUpperCase?.() || 'VR'}</div>
                  <div className="friend-request-copy">
                    <div className="friend-request-person-name">{req.fromName}</div>
                    <div className="friend-request-person-email">{req.fromEmail}</div>
                  </div>
                  <div className="friend-request-actions">
                    <button type="button" className="friend-request-action friend-request-action--primary" onClick={() => onAcceptFriendRequest(req.id)}><span aria-hidden="true">✓</span></button>
                    <button type="button" className="friend-request-action friend-request-action--secondary" onClick={() => onDeclineFriendRequest(req.id)}><span aria-hidden="true">✗</span></button>
                  </div>
                </div>
              ))}
              {friendRequests.length === 0 && (
                <div className="empty-convs friend-requests-empty">
                  <p>Geen ontvangen vriendschapsverzoeken.</p>
                </div>
              )}
            </>
          )}

          {requestsTab === 'verstuurd' && (
            <>
              {sentFriendRequests.map((req) => {
                const requestId = req?.id || req?.requestId || null;
                const reminderCount = Number(req.reminderCount || 0);
                const remindersRemaining = Math.max(0, 3 - reminderCount);
                return (
                  <div key={requestId || req.toUid || req.toEmail} className="friend-request-row friend-request-row--stacked">
                    <div className="friend-request-row-top">
                      <div className="avatar-circle sm" aria-hidden="true">{(req.toEmail || req.toUid || 'VR').slice(0, 2).toUpperCase()}</div>
                      <div className="friend-request-copy">
                        <div className="friend-request-person-name">{req.toEmail || req.toIdentifier || req.toUid}</div>
                        <div className="friend-request-person-email">
                          {remindersRemaining > 0 ? `Nog ${remindersRemaining} ${remindersRemaining === 1 ? 'herinnering' : 'herinneringen'} over` : 'Geen herinneringen meer over'}
                        </div>
                      </div>
                    </div>
                    <div className="friend-request-actions friend-request-actions--wide">
                      <button type="button" className="friend-request-action friend-request-action--secondary friend-request-action--text" onClick={() => requestId && onCancelFriendRequest(requestId)} disabled={!requestId}>
                        Annuleren
                      </button>
                      <button type="button" className="friend-request-action friend-request-action--primary friend-request-action--text" onClick={() => requestId && onRemindFriendRequest(requestId)} disabled={!requestId || remindersRemaining <= 0}>
                        Herinneren
                      </button>
                    </div>
                  </div>
                );
              })}
              {sentFriendRequests.length === 0 && (
                <div className="empty-convs friend-requests-empty">
                  <p>Geen verstuurde vriendschapsverzoeken.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </ProfilePageShell>
  );

  const renderContactActionsPage = () => {
    const contact = contacts.find((c) => c.uid === contactMenu?.uid) || contactMenu?.contact;
    if (!contact) return null;
    const isParentBlocked = parentBlockedUids?.includes(contact.uid);
    const isProtectedParentContact = !isParent && contact?.role === 'parent';
    const isPinned = pinnedContacts.includes(contact.uid);
    const title = getContactDisplayName(contact) || contact.displayName || contact.username || 'Contact';
    const handleViewContactFromActions = () => {
      onViewContact(contact, { preserveActiveConversation: true });
    };
    const handleStartChatFromActions = () => {
      onStartChat(contact);
      completeContactActionsSheet();
    };
    const handleCallContactFromActions = (isVideo) => {
      onCallContact(contact, isVideo);
    };
    const handleTogglePinFromActions = () => {
      onTogglePin(contact.uid);
    };
    const handleBlockContactFromActions = () => {
      onBlockContact(contact);
    };
    const handleRemoveContactFromActions = () => {
      onRemoveContact(contact.uid);
    };

    return (
      <ProfilePageShell
        panelRef={profilePanelRef}
        titleId="contact-actions-title"
        title={title}
        description={`Beheer acties voor ${title}.`}
        onBack={closeContactActionsSheet}
        backLabel={`${title} sluiten`}
        panelProps={{
          'data-sidebar-actions-menu': 'true',
          onClick: (event) => event.stopPropagation(),
        }}
        headerAction={(
          <button
            type="button"
            className="contact-profile-edit-btn contact-profile-close-btn"
            aria-label={`${title} sluiten`}
            title="Sluiten"
            onClick={closeContactActionsSheet}
          >
            <XIcon size={20} aria-hidden="true" />
          </button>
        )}
      >
        <section className="contact-profile-card contact-profile-card--action-list">
          <button type="button" role="menuitem" className="chat-header-menu-item" onClick={handleViewContactFromActions} title="Profiel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z" /></svg>
            <span>Profiel</span>
          </button>
          {!isParentBlocked && (
            <>
              <button type="button" role="menuitem" className="chat-header-menu-item" onClick={handleStartChatFromActions} title="Bericht sturen">
                <Message size={14} aria-hidden="true" />
                <span>Bericht sturen</span>
              </button>
              {callsAvailable && (
                <>
                  <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => handleCallContactFromActions(false)} title="Bellen">
                    <Phone size={14} aria-hidden="true" />
                    <span>Bellen</span>
                  </button>
                  <button type="button" role="menuitem" className="chat-header-menu-item" onClick={() => handleCallContactFromActions(true)} title="Videobellen">
                    <Video size={14} aria-hidden="true" />
                    <span>Videobellen</span>
                  </button>
                </>
              )}
              <button type="button" role="menuitem" className={`chat-header-menu-item${isPinned ? ' danger' : ''}`} onClick={handleTogglePinFromActions} title={isPinned ? 'Losmaken' : 'Vastzetten'}>
                <Pin size={14} aria-hidden="true" />
                <span>{isPinned ? 'Losmaken' : 'Vastzetten'}</span>
              </button>
            </>
          )}
          {!isProtectedParentContact && <div className="chat-header-menu-divider" />}
          {!isProtectedParentContact && !isParentBlocked && (
            <button type="button" role="menuitem" className="chat-header-menu-item danger" onClick={handleBlockContactFromActions} title="Blokkeren">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
              <span>Blokkeren</span>
            </button>
          )}
          {!isProtectedParentContact && (
            <button type="button" role="menuitem" className="chat-header-menu-item danger" onClick={handleRemoveContactFromActions} title="Verwijderen">
              <Trash2 size={14} aria-hidden="true" />
              <span>Verwijderen</span>
            </button>
          )}
        </section>
      </ProfilePageShell>
    );
  };

  const renderConversationActionsPage = () => {
    if (!convActionsSheet) return null;
    const title = getConvName?.(convActionsSheet.conv) || 'Gesprek';

    return (
      <ProfilePageShell
        panelRef={profilePanelRef}
        titleId="conversation-actions-title"
        title={title}
        description={`Beheer acties voor ${title}.`}
        onBack={closeConvActionsSheet}
        backLabel={`${title} sluiten`}
        panelProps={{ 'data-sidebar-actions-menu': 'true' }}
        headerAction={(
          <button
            type="button"
            className="contact-profile-edit-btn contact-profile-close-btn"
            aria-label={`${title} sluiten`}
            title="Sluiten"
            onClick={closeConvActionsSheet}
          >
            <XIcon size={20} aria-hidden="true" />
          </button>
        )}
      >
        <section className="contact-profile-card contact-profile-card--action-list">
          {renderConvActions(convActionsSheet.conv, convActionsSheet.otherUid, completeConvActionsSheet)}
        </section>
      </ProfilePageShell>
    );
  };

  const renderSettingsAccountSheet = () => (
    <ProfilePageShell
      panelRef={profilePanelRef}
      titleId="settings-account-title"
      title="Mijn account"
      description="Werk je naam, avatar en wachtwoord bij in dezelfde profielopbouw."
      onBack={() => setProfileTab?.('overview')}
      backLabel="Terug naar instellingen"
      headerAction={(
        <button
          type="button"
          className="contact-profile-edit-btn contact-profile-close-btn"
          aria-label="Mijn account sluiten"
          title="Sluiten"
          onClick={dismissProfileOverviewSheet}
        >
          <XIcon size={20} aria-hidden="true" />
        </button>
      )}
      hero={(
        <ProfilePageHero
          className="contact-profile-hero contact-profile-hero--account"
          avatar={(
            <div className="profile-photo-wrap" onClick={() => photoInputRef?.current?.click()}>
              {photoPreview
                ? <img src={photoPreview} alt="avatar" className="profile-avatar-big contact-profile-avatar" style={{ objectFit: 'cover' }} loading="lazy" onError={() => { setPhotoPreview?.(null); localStorage.removeItem(`pulse_photo_${user.uid}`); }} />
                : <div className="profile-avatar-big contact-profile-avatar">{getInitials(user.displayName || user.email)}</div>
              }
              <div className="profile-photo-overlay"><Camera size={16} /></div>
            </div>
          )}
        >
          <button type="button" className="profile-account-avatar-btn" onClick={() => setShowAvatarBuilder?.(true)}>
            🎨 Avatar maken
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </ProfilePageHero>
      )}
    >
      <section className="account-page-section">
        <div className="contact-profile-field">
          <input className="form-input" placeholder="Jouw naam" value={newName} onChange={(e) => setNewName?.(e.target.value)} />
        </div>
        {isChildAccount && (
          <div className="contact-profile-field">
            <input
              className="form-input"
              value={newUsername}
              readOnly
              disabled
              aria-readonly="true"
              style={{ opacity: 0.72, cursor: 'not-allowed' }}
            />
            <div className="profile-account-helper" style={{ marginTop: '8px' }}>
              Deze loginnaam is ingesteld door je ouder en kan alleen in het ouderportaal worden gewijzigd.
            </div>
          </div>
        )}
        {isParent && (
          <div className="contact-profile-field">
            <input className="form-input profile-account-input-disabled" type="email" value={user.email} disabled />
          </div>
        )}
        <div className="contact-profile-field">
          {profileMsg && <div className={`profile-settings-inline-message profile-settings-inline-message--stacked ${profileMsg.startsWith('Fout') ? 'is-error' : 'is-success'}`}>{profileMsg}</div>}
          <button type="button" className="btn-primary" style={{ width: '100%', marginTop: 0 }} disabled={profileLoading} onClick={() => saveProfile?.()}>
            {profileLoading ? 'Opslaan…' : 'Opslaan →'}
          </button>
        </div>
      </section>

      {!user.email?.endsWith('@pulse.internal') && (
        <section className="account-page-section">
          <div className="contact-profile-field">
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Nieuw wachtwoord"
                aria-label="Nieuw wachtwoord"
                value={newPassword}
                onChange={(e) => setNewPassword?.(e.target.value)}
                style={{ paddingRight: '42px' }}
              />
              <button
                type="button"
                aria-label={showNewPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                onClick={() => setShowNewPassword?.((prev) => !prev)}
                className="profile-account-password-toggle"
              >
                {showNewPassword ? <EyeOff size={18} /> : <EyeOn size={18} />}
              </button>
            </div>
          </div>
          <div className="contact-profile-field">
            <input
              className="form-input"
              type={showNewPassword ? 'text' : 'password'}
              placeholder="Bevestig wachtwoord"
              aria-label="Bevestig wachtwoord"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword?.(e.target.value)}
            />
          </div>
          <div className="contact-profile-field">
            <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: 0 }} disabled={passwordLoading || !newPassword} onClick={() => changePassword?.()}>
              {passwordLoading ? 'Bezig…' : 'Wachtwoord wijzigen'}
            </button>
            {passwordMsg && <div className={`profile-settings-inline-message profile-settings-inline-message--stacked ${passwordMsg.startsWith('Fout') ? 'is-error' : 'is-success'}`}>{passwordMsg}</div>}
          </div>
        </section>
      )}

      <section className="contact-profile-card contact-profile-card-danger">
        <button
          type="button"
          className="contact-profile-row-button danger"
          onClick={() => { dismissProfileOverviewSheet(); handleDeleteAccount?.(); }}
        >
          <span className="contact-profile-row-icon" aria-hidden="true"><Trash2 size={18} /></span>
          <span className="contact-profile-row-copy">
            <span className="contact-profile-row-title">Account verwijderen</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="contact-profile-row-arrow">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </section>
    </ProfilePageShell>
  );
  const renderSettingsSubpageShell = (title, description, children) => (
    <ProfilePageShell
      panelRef={profilePanelRef}
      titleId={`settings-${title.toLowerCase()}-title`}
      title={title}
      description={description}
      onBack={() => setProfileTab?.('overview')}
      backLabel="Terug naar instellingen"
      headerAction={(
        <button
          type="button"
          className="contact-profile-edit-btn contact-profile-close-btn"
          aria-label={`${title} sluiten`}
          title="Sluiten"
          onClick={dismissProfileOverviewSheet}
        >
          <XIcon size={20} aria-hidden="true" />
        </button>
      )}
    >
      {children}
    </ProfilePageShell>
  );
  const renderSettingsHistorySheet = () => renderSettingsSubpageShell(
    'Privacy',
    'Bepaal per account hoe lang gegevens bewaard blijven.',
    <>
      <section className="privacy-page-section">
        <div className="contact-profile-field">
          <div className="parent-dashboard-meta-block">
            <div className="parent-dashboard-meta-title">Jij bepaalt</div>
            <div className="parent-dashboard-meta-subtitle">Stel in hoe lang chat-, bel- en videogeschiedenis bewaard blijven.</div>
          </div>
        </div>
      </section>
      <section className="privacy-page-section">
        <div className="contact-profile-field">
          {historySettingRows.map((row) => (
            <div key={`parent-${row.key}`} className="profile-settings-field-stack profile-settings-field-stack--spaced profile-settings-field-stack--inline">
              <div className="profile-settings-field-label">{row.label}</div>
              <SidebarHistorySelect
                ariaLabel={`${row.label} ouderaccount`}
                value={historyRules?.[row.key] ?? 30}
                options={HISTORY_RETENTION_OPTIONS}
                onChange={(nextValue) => setHistoryRules?.((prev) => ({ ...normalizeHistoryRules(prev), [row.key]: Number(nextValue) }))}
                disabled={historySettingsLoading || historySettingsSavingTarget === 'parent'}
                style={historySelectStyle}
              />
            </div>
          ))}
          <button type="button" className="btn-primary profile-settings-action" style={{ width: '100%' }} onClick={() => saveHistorySettings?.()} disabled={historySettingsLoading || historySettingsSavingTarget === 'parent'}>
            {historySettingsSavingTarget === 'parent' ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </section>
      <section className="privacy-page-section">
        <div className="contact-profile-field">
          <div className="profile-settings-field-stack profile-settings-field-stack--inline">
            <div className="profile-settings-field-label">Kindaccount</div>
            <SidebarHistorySelect
              ariaLabel="Kies kindaccount"
              value={selectedHistoryChildUid}
              options={
                historyChildren.length === 0
                  ? [{ value: '', label: 'Geen kindaccounts' }]
                  : historyChildren.map((child) => ({ value: child.uid, label: child.displayName }))
              }
              onChange={(nextValue) => setSelectedHistoryChildUid(String(nextValue))}
              disabled={!historyChildren.length || historySettingsLoading}
              style={historySelectStyle}
            />
          </div>
          {historySettingRows.map((row) => (
            <div key={`child-${row.key}`} className="profile-settings-field-stack profile-settings-field-stack--spaced profile-settings-field-stack--inline">
              <div className="profile-settings-field-label">{row.label}</div>
              <SidebarHistorySelect
                ariaLabel={`${row.label} kindaccount`}
                value={primaryHistoryRules[row.key]}
                options={HISTORY_RETENTION_OPTIONS}
                onChange={(nextValue) => {
                  if (!primaryHistoryChild) return;
                  setChildHistoryRulesByUid?.((prev) => ({
                    ...prev,
                    [primaryHistoryChild.uid]: {
                      ...normalizeHistoryRules(prev?.[primaryHistoryChild.uid]),
                      [row.key]: Number(nextValue),
                    },
                  }));
                }}
                disabled={!primaryHistoryChild || !canManagePrimaryHistoryChild || historySettingsLoading || historySettingsSavingTarget === primaryHistoryChild?.uid}
                style={historySelectStyle}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn-primary profile-settings-action"
            style={{ width: '100%' }}
            onClick={() => primaryHistoryChild && saveChildHistorySettings?.(primaryHistoryChild.uid)}
            disabled={!primaryHistoryChild || !canManagePrimaryHistoryChild || historySettingsLoading || historySettingsSavingTarget === primaryHistoryChild?.uid}
          >
            {historySettingsSavingTarget === primaryHistoryChild?.uid ? 'Opslaan…' : 'Opslaan'}
          </button>
          {primaryHistoryChild && !canManagePrimaryHistoryChild && (
            <div className="profile-settings-helper-copy profile-settings-helper-copy--spaced">
              Alleen ouder A kan de bewaartermijn voor dit kindaccount aanpassen.
            </div>
          )}
          {historySettingsMsg && (
            <div className={`profile-settings-inline-message profile-settings-inline-message--stacked profile-settings-inline-message--spaced ${historySettingsMsg.startsWith('Fout:') ? 'is-error' : 'is-success'}`}>
              {historySettingsMsg}
            </div>
          )}
        </div>
      </section>
    </>,
  );
  const renderSettingsBlockedSheet = () => {
    const selfBlocked = (blockedContacts || []).filter((c) => !parentBlockedUids?.includes(c.uid));
    const parentBlocked = (blockedContacts || []).filter((c) => parentBlockedUids?.includes(c.uid));
    return renderSettingsSubpageShell(
      'Geblokkeerd',
      'Beheer welke contacten geblokkeerd zijn.',
      <>
        <section className="blocked-contacts-page-section">
          <div className="contact-profile-field">
            {selfBlocked.length === 0 && parentBlocked.length === 0 ? (
              <div className="profile-settings-empty">Geen geblokkeerde contacten.</div>
            ) : (
              <div className="profile-settings-card-stack">
                {selfBlocked.length > 0 && (
                  <div className="profile-settings-block">
                    <div className="profile-settings-subsection-title">Door jou geblokkeerd</div>
                    <div className="profile-settings-list-rows">
                      {selfBlocked.map((c) => (
                        <div key={c.uid} className="profile-settings-contact-row">
                          <UserAvatar photoURL={c.photoURL} displayName={c.displayName || c.email} className="sm" decorative style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="blocked-contact-name-responsive profile-settings-contact-name">{c.displayName || c.email}</div>
                            {c.email && <div className="profile-settings-contact-email">{c.email}</div>}
                          </div>
                          <button type="button" className="profile-settings-inline-btn" onClick={() => onUnblockContact?.(c.uid)}>Deblokkeren</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {parentBlocked.length > 0 && (
                  <div className="profile-settings-block">
                    <div className="profile-settings-subsection-title">Geblokkeerd door ouder</div>
                    <div className="profile-settings-list-rows">
                      {parentBlocked.map((c) => (
                        <div key={c.uid} className="profile-settings-contact-row profile-settings-contact-row--danger">
                          <UserAvatar photoURL={c.photoURL} displayName={c.displayName || c.email} className="sm" decorative style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="blocked-contact-name-responsive profile-settings-contact-name">{c.displayName || c.email}</div>
                            {c.email && <div className="profile-settings-contact-email">{c.email}</div>}
                            <div className="profile-settings-contact-note">Geblokkeerd door ouder</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </>,
    );
  };
  const renderSettingsStylingSheet = () => renderSettingsSubpageShell(
    'Styling',
    'Kies een achtergrond die past bij jouw chats.',
    <>
      <section className="styling-page-section">
        <div className="contact-profile-field">
          <div className="parent-dashboard-meta-block">
            <div className="parent-dashboard-meta-title">Chatachtergrond kiezen</div>
            <div className="parent-dashboard-meta-subtitle">Kies een achtergrond die past bij jouw chats.</div>
          </div>
        </div>
      </section>
      <section className="styling-page-section">
        <div className="contact-profile-field">
          <div className="profile-styling-tabs">
            {[
              ['foto', <ImageIcon size={14} />, 'Foto'],
              ['kleur', <ColorCircle size={14} />, 'Kleur'],
              ['standaard', <LayoutTemplate size={14} />, 'Standaard'],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setChatBgTab?.(id);
                  if (id === 'kleur' && !pendingColor && chatBg?.type !== 'color') setPendingColor('#000000');
                }}
                className="profile-styling-tab"
                style={{
                  flex: 1,
                  padding: '7px 4px',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all .15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  background: chatBgTab === id ? 'linear-gradient(135deg,#7c6fff,#a855f7)' : 'transparent',
                  color: chatBgTab === id ? '#fff' : '#6f6788',
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>
          <div
            className="profile-styling-preview"
            style={{
              borderRadius: '18px',
              overflow: 'hidden',
              marginBottom: '14px',
              height: '110px',
              position: 'relative',
              background: chatBgTab === 'kleur'
                ? (pendingColor || (chatBg?.type === 'color' ? chatBg.value : '#000000'))
                : chatBgTab === 'foto'
                  ? (pendingPhoto ? `url(${pendingPhoto.url}) center/cover` : chatBg?.type === 'photo' ? `url(${chatBg.url}) center/cover` : 'var(--bg)')
                  : (chatBg?.type === 'photo' ? `url(${chatBg.url}) center/cover` : chatBg?.type === 'color' ? chatBg.value : `#eeeaf8 url(${chatDefaultPattern}) center top / 180px auto repeat`),
              border: '1px solid rgba(140, 122, 214, 0.12)',
            }}
          >
          {chatBgTab === 'foto' && (pendingPhoto || chatBg?.type === 'photo') && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.15)' }} />}
          {chatBgTab === 'foto' && (pendingPhoto || chatBg?.type === 'photo') && (
            <button
              type="button"
              disabled={chatBgLoading}
              onClick={() => {
                if (pendingPhoto?.url) URL.revokeObjectURL(pendingPhoto.url);
                if (pendingPhoto) setPendingPhoto(null);
                else removeChatBg?.();
              }}
              style={{ position: 'absolute', top: '8px', right: '8px', width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', zIndex: 1 }}
              title="Achtergrond verwijderen"
            >
              ×
            </button>
          )}
          <div style={{ position: 'absolute', bottom: '8px', left: '10px' }}>
            <div style={{ background: '#f7f2ff', border: '1px solid #e6dcfb', borderRadius: '12px 12px 12px 3px', padding: '6px 12px', fontSize: '12px', color: '#3f3560' }}>Hallo! 👋</div>
          </div>
          <div style={{ position: 'absolute', bottom: '8px', right: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg,#8c7bff 0%, #7160f5 100%)', borderRadius: '12px 12px 3px 12px', padding: '6px 12px', fontSize: '12px', color: '#fff' }}>Hey!</div>
          </div>
        </div>
        {chatBgTab === 'foto' && (
          <div className="profile-settings-block">
            {!pendingPhoto && chatBg?.type === 'photo' && <div style={{ fontSize: '12px', color: 'var(--success)', marginBottom: '8px' }}>✓ Foto achtergrond actief</div>}
            <div className="profile-settings-actions-row">
              <button type="button" className="btn-secondary" style={{ flex: 1 }} disabled={chatBgLoading} onClick={() => bgInputRef?.current?.click()}>
                {chatBg?.type === 'photo' || pendingPhoto ? 'Andere foto kiezen' : 'Foto kiezen'}
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                disabled={chatBgLoading || !pendingPhoto}
                onClick={() => {
                  uploadChatBgPhoto?.(pendingPhoto.file);
                  if (pendingPhoto?.url) URL.revokeObjectURL(pendingPhoto.url);
                  setPendingPhoto(null);
                }}
              >
                {chatBgLoading ? 'Uploaden…' : 'Opslaan'}
              </button>
            </div>
            <div className="profile-settings-meta-copy">JPG, PNG of WEBP · max 5 MB</div>
            <input
              ref={bgInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files[0];
                e.target.value = '';
                if (pendingPhoto?.url) URL.revokeObjectURL(pendingPhoto.url);
                if (f) setPendingPhoto({ file: f, url: URL.createObjectURL(f) });
              }}
            />
          </div>
        )}
        {chatBgTab === 'kleur' && (
          <div className="profile-settings-block">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '12px' }}>
              {['#1e0a3c', '#051236', '#0a1f0e', '#1f0a10', '#0f1923', '#1a1206', '#000000', '#1c1a18'].map((color) => {
                const isActive = (pendingColor ?? (chatBg?.type === 'color' ? chatBg.value : null)) === color;
                return (
                  <button
                    key={color}
                    type="button"
                    disabled={chatBgLoading}
                    onClick={() => setPendingColor(color)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: color,
                      border: isActive ? '3px solid var(--accent)' : '2px solid var(--border)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all .15s',
                      boxShadow: isActive ? '0 0 0 2px var(--bg),0 0 0 4px var(--accent)' : 'none',
                    }}
                  >
                    {isActive && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px' }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={chatBgLoading || !pendingColor}
              onClick={() => {
                saveChatBgColor?.(pendingColor);
                setPendingColor(null);
              }}
            >
              {chatBgLoading ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        )}
          {chatBgTab === 'standaard' && (
            chatBg
              ? <button type="button" className="btn-secondary" style={{ width: '100%' }} disabled={chatBgLoading} onClick={() => removeChatBg?.()}>
                  {chatBgLoading ? 'Herstellen…' : 'Standaard herstellen'}
                </button>
              : <div style={{ fontSize: '12px', color: 'var(--success)', textAlign: 'center' }}>✓ Standaard achtergrond actief</div>
          )}
        </div>
      </section>
    </>,
  );

  const renderCallsProfilePage = () => (
    (() => {
      return (
        <aside
          ref={profilePanelRef}
          className="chat-side-panel contact-profile-panel parent-dashboard-panel calls-dashboard-panel"
          aria-labelledby="calls-profile-title"
          aria-describedby="calls-profile-description"
        >
          <div className="calls-dashboard-sticky-top">
            <div className="contact-profile-topbar calls-dashboard-topbar">
              <div className="contact-profile-topbar-spacer" aria-hidden="true" />
              <div className="contact-profile-heading calls-dashboard-heading">
                <h2 id="calls-profile-title">{callActionMode ? 'Nieuwe oproep' : 'Oproepen'}</h2>
              </div>
              <button
                type="button"
                className="contact-profile-nav-btn calls-dashboard-add-btn"
                aria-label={callActionMode ? 'Sluit contactkiezer' : 'Start nieuwe oproep'}
                title={callActionMode ? 'Sluiten' : 'Nieuwe oproep'}
                onClick={() => {
                  if (callActionMode) {
                    setCallActionMode(null);
                    return;
                  }
                  setCallActionMode('contacts');
                }}
              >
                {callActionMode ? (
                  <XIcon size={20} aria-hidden="true" />
                ) : (
                  <span className="calls-dashboard-add-icon" aria-hidden="true">
                    <Phone size={18} />
                    <Plus size={12} />
                  </span>
                )}
              </button>
            </div>

            <p id="calls-profile-description" className="sr-only">
              Bekijk recente oproepen en start een nieuwe bel- of video-oproep.
            </p>

            <div className="calls-dashboard-search">
              <div className="search-box search-box--top sidebar-call-search-box">
                <Search size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
                <input
                  className="sidebar-call-search-input"
                  placeholder="Zoek op naam of e-mailadres"
                  value={callSearch}
                  onChange={(e) => setCallSearch(e.target.value)}
                />
                {callSearch && (
                  <button type="button" className="sidebar-call-search-clear" aria-label="Zoekopdracht wissen" onClick={() => setCallSearch('')}>
                    <Cancel size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {remainingRateLimitSeconds > 0 && (
                <div className="calls-dashboard-rate-limit" role="status" aria-live="polite">
                  Te veel verzoeken. Vernieuwen over {remainingRateLimitSeconds}s.
                </div>
              )}
            </div>
          </div>
          <div className="calls-dashboard-scroll">
            {!callsAvailable ? (
              <div className="contact-profile-card calls-dashboard-section-card">
                <div className="call-panel-empty calls-dashboard-empty">
                  <div style={{ fontSize: 14 }}>Bellen en videobellen zijn hier niet beschikbaar.</div>
                </div>
              </div>
            ) : callActionMode ? (
              <section className="calls-dashboard-section calls-dashboard-section--contacts">
                <div className="call-log-picker-title">
                  Kies een contactpersoon om direct te bellen of videobellen.
                </div>
                <div className="sidebar-call-list calls-dashboard-list calls-dashboard-list--contacts">
                  {filteredCallContacts.length === 0 ? (
                    <div className="empty-convs calls-dashboard-empty" style={{ paddingTop: 6, paddingBottom: 6 }}>
                      <p>Geen contacten gevonden.</p>
                    </div>
                  ) : (
                    filteredCallContacts.map((contact) => {
                      const contactTitle = getContactDisplayName(contact)
                        || contact.displayName
                        || contact.username
                        || (contact.email ? contact.email.split('@')[0] : '')
                        || 'Onbekend';
                      return (
                        <div key={contact.uid} className="sidebar-contact-card sidebar-contact-card--call-log">
                          <div className="sidebar-contact-row sidebar-contact-row--call-log">
                            <UserAvatar photoURL={contact.photoURL} displayName={contactTitle} className="sm" decorative />
                            <div className="conv-info call-log-picker-copy">
                              <div className="conv-name call-contact-name-responsive">{contactTitle}</div>
                              <div className="conv-preview call-contact-email-responsive">{contact.email || 'Geen e-mailadres'}</div>
                            </div>
                            <div className="call-log-picker-actions">
                              <button
                                type="button"
                                className="call-btn video calls-dashboard-quick-btn"
                                aria-label={`Videobel ${contactTitle}`}
                                title="Videobellen"
                                onClick={() => (callContactFromRecent || callContact)?.(contact, true)}
                              >
                                <Video size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="call-btn voice calls-dashboard-quick-btn"
                                aria-label={`Bel ${contactTitle}`}
                                title="Bellen"
                                onClick={() => (callContactFromRecent || callContact)?.(contact, false)}
                              >
                                <Phone size={16} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            ) : (
              <section className="calls-dashboard-section calls-dashboard-section--recent">
                {filteredCallLog.length === 0 ? (
                  <div className="contact-profile-card calls-dashboard-section-card">
                    <div className="call-panel-empty calls-dashboard-empty">
                      <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true"><Cancel size={40} /></div>
                      <div>{callSearch ? 'Geen oproepen gevonden' : 'Nog geen oproepen'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="sidebar-call-list calls-dashboard-list calls-dashboard-list--recent">
                    {filteredCallLog.map((entry, index) => {
                      const contact = contacts.find((item) => item.uid === entry.uid);
                      const CallTypeIcon = entry.isVideo ? Video : Phone;
                      const displayTime = formatTime(entry.ts);
                      return (
                        <div key={`${entry.uid || entry.name}-${entry.ts || index}`} className="sidebar-contact-card sidebar-contact-card--call-log">
                          <div className="sidebar-contact-row sidebar-contact-row--call-log">
                            <div className="avatar-wrap">
                              <UserAvatar photoURL={entry.photoURL} displayName={entry.name} className="sm" decorative />
                              {contact && onlineUsers.has(entry.uid) && <span className="online-dot sm" />}
                            </div>
                            <div className="call-log-copy">
                              <div className="call-log-meta">
                                <span className="conv-name">{entry.name}</span>
                                <span className="call-log-time">{displayTime}</span>
                              </div>
                              <div className={`call-log-subline ${entry.direction === 'missed' ? 'missed' : ''}`}>
                                <span className="call-log-direction-icon" aria-hidden="true"><CallTypeIcon size={14} /></span>
                                <span>{entry.direction === 'missed' ? 'Gemist' : entry.direction === 'outgoing' ? 'Uitgaand' : 'Inkomend'}</span>
                              </div>
                            </div>
                            {contact && (
                              <div className="call-log-actions">
                                {entry.isVideo ? (
                                  <button type="button" className="call-btn video calls-dashboard-quick-btn" aria-label={`Videobel ${entry.name}`} onClick={() => (callContactFromRecent || callContact)?.(contact, true)} title="Videobellen"><Video size={16} aria-hidden="true" /></button>
                                ) : (
                                  <button type="button" className="call-btn voice calls-dashboard-quick-btn" aria-label={`Bel ${entry.name}`} onClick={() => (callContactFromRecent || callContact)?.(contact, false)} title="Bellen"><Phone size={16} aria-hidden="true" /></button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </aside>
      );
    })()
  );

  useEffect(() => {
    if (!historyChildren.length) {
      setSelectedHistoryChildUid('');
      return;
    }
    if (historyChildren.some((child) => child.uid === selectedHistoryChildUid)) return;
    setSelectedHistoryChildUid(historyChildren[0].uid);
  }, [historyChildren, selectedHistoryChildUid]);

  useEffect(() => () => {
    if (pendingPhoto?.url) {
      URL.revokeObjectURL(pendingPhoto.url);
    }
  }, [pendingPhoto]);

  const filteredContacts = useMemo(() => contacts.filter((contact) => (
    !normalizedSearch
      || contact.displayName?.toLowerCase().includes(normalizedSearch)
      || contact.email?.toLowerCase().includes(normalizedSearch)
  )), [contacts, normalizedSearch]);
  const normalizedNewChatQuery = searchEmail.trim().toLowerCase();
  const filteredNewChatContacts = normalizedNewChatQuery
    ? contacts.filter((contact) => {
        const displayName = (getContactDisplayName(contact) || contact.displayName || '').toLowerCase();
        const email = (contact.email || '').toLowerCase();
        const username = (contact.username || '').toLowerCase();
        return displayName.includes(normalizedNewChatQuery) || email.includes(normalizedNewChatQuery) || username.includes(normalizedNewChatQuery);
      })
    : contacts;
  const normalizedShareContactQuery = shareContactSearch.trim().toLowerCase();
  const filteredShareRecipients = contacts.filter((contact) => {
    if (contact.uid === sharingContact?.uid) return false;
    if (!normalizedShareContactQuery) return true;
    const displayName = (getContactDisplayName(contact) || contact.displayName || '').toLowerCase();
    const email = (contact.email || '').toLowerCase();
    const username = (contact.username || '').toLowerCase();
    return displayName.includes(normalizedShareContactQuery) || email.includes(normalizedShareContactQuery) || username.includes(normalizedShareContactQuery);
  });

  useEffect(() => {
    if (!moreActionsSheetVisible && !settingsSheetVisible && !callSheetVisible && !newChatSheetVisible && !newGroupSheetVisible && !addContactSheetVisible && !requestsSheetVisible && !parentPortalPageVisible) return;
    function handleClickOutside(e) {
      if (e.target?.closest?.('[data-sidebar-actions-menu]')) return;
      if (e.target?.closest?.('[data-parent-portal-overlay]')) return;
      if (profilePanelRef.current?.contains?.(e.target)) return;
      if (parentPortalPanelRef.current?.contains?.(e.target)) return;
      if (moreActionsMenuRef.current && !moreActionsMenuRef.current.contains(e.target)) {
        if (settingsSheetVisible) {
          setProfileSheetClosing(true);
          return;
        }
        if (addContactSheetVisible) {
          setAddContactSheetClosing(true);
          return;
        }
        if (newChatSheetVisible) {
          setNewChatSheetClosing(true);
          return;
        }
        if (newGroupSheetVisible) {
          setNewGroupSheetClosing(true);
          return;
        }
        if (requestsSheetVisible) {
          setRequestsSheetClosing(true);
          return;
        }
        if (callSheetVisible) {
          setCallSheetClosing(true);
          return;
        }
        if (parentPortalPageVisible) {
          setParentPortalSheetClosing(true);
          return;
        }
        setMoreActionsMenuClosing(true);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [addContactSheetVisible, callSheetVisible, moreActionsSheetVisible, newChatSheetVisible, newGroupSheetVisible, parentPortalPageVisible, requestsSheetVisible, settingsSheetVisible]);

  useEffect(() => {
    if (!moreActionsMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (moreActionsSheetHistoryPushedRef.current) {
        moreActionsSheetHistoryPushedRef.current = false;
        window.history.back();
        return;
      }
      setMoreActionsMenuClosing(true);
    };
    const onPopState = () => {
      moreActionsSheetHistoryPushedRef.current = false;
      setMoreActionsMenuClosing(true);
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

  useEffect(() => () => {
    if (moreActionsCloseTimeoutRef.current) {
      window.clearTimeout(moreActionsCloseTimeoutRef.current);
    }
    if (addContactSheetCloseTimeoutRef.current) {
      window.clearTimeout(addContactSheetCloseTimeoutRef.current);
    }
    if (newChatSheetCloseTimeoutRef.current) {
      window.clearTimeout(newChatSheetCloseTimeoutRef.current);
    }
    if (newGroupSheetCloseTimeoutRef.current) {
      window.clearTimeout(newGroupSheetCloseTimeoutRef.current);
    }
    if (requestsSheetCloseTimeoutRef.current) {
      window.clearTimeout(requestsSheetCloseTimeoutRef.current);
    }
    if (callSheetCloseTimeoutRef.current) {
      window.clearTimeout(callSheetCloseTimeoutRef.current);
    }
    if (profileSheetCloseTimeoutRef.current) {
      window.clearTimeout(profileSheetCloseTimeoutRef.current);
    }
    if (parentPortalSheetCloseTimeoutRef.current) {
      window.clearTimeout(parentPortalSheetCloseTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!embeddedSettingsActive) {
      setProfileSheetClosing(false);
      return;
    }
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setAddContactSheetClosing(false);
    setShowAddContact?.(false);
    setNewChatSheetClosing(false);
    setShowNewChat?.(false);
    setNewGroupSheetClosing(false);
    setShowNewGroup?.(false);
    setRequestsSheetClosing(false);
    setShowFriendRequestsPanel?.(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setParentPortalSheetClosing(false);
    setShowParentDashboard?.(false);
  }, [embeddedSettingsActive, setShowAddContact, setShowCallModal, setShowFriendRequestsPanel, setShowNewChat, setShowNewGroup, setShowParentDashboard]);

  useEffect(() => {
    if (!showAddContact) {
      setAddContactSheetClosing(false);
      setContactEmail?.('');
      setContactNickname?.('');
      setContactRelation?.(null);
      return;
    }
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setNewChatSheetClosing(false);
    setShowNewChat?.(false);
    setNewGroupSheetClosing(false);
    setShowNewGroup?.(false);
    setRequestsSheetClosing(false);
    setShowFriendRequestsPanel?.(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setProfileSheetClosing(false);
    setShowProfile?.(false);
    setParentPortalSheetClosing(false);
    setShowParentDashboard?.(false);
  }, [setContactEmail, setContactNickname, setContactRelation, setShowCallModal, setShowAddContact, setShowFriendRequestsPanel, setShowNewChat, setShowNewGroup, setShowParentDashboard, setShowProfile, showAddContact]);

  useEffect(() => {
    if (!showNewChat) {
      setNewChatSheetClosing(false);
      setSearchEmail?.('');
      return;
    }
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setAddContactSheetClosing(false);
    setShowAddContact?.(false);
    setNewGroupSheetClosing(false);
    setShowNewGroup?.(false);
    setRequestsSheetClosing(false);
    setShowFriendRequestsPanel?.(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setProfileSheetClosing(false);
    setShowProfile?.(false);
    setParentPortalSheetClosing(false);
    setShowParentDashboard?.(false);
  }, [setSearchEmail, setShowAddContact, setShowCallModal, setShowFriendRequestsPanel, setShowNewChat, setShowNewGroup, setShowParentDashboard, setShowProfile, showNewChat]);

  useEffect(() => {
    if (!showNewGroup) {
      setNewGroupSheetClosing(false);
      setGroupName?.('');
      return;
    }
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setAddContactSheetClosing(false);
    setShowAddContact?.(false);
    setNewChatSheetClosing(false);
    setShowNewChat?.(false);
    setRequestsSheetClosing(false);
    setShowFriendRequestsPanel?.(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setProfileSheetClosing(false);
    setShowProfile?.(false);
    setParentPortalSheetClosing(false);
    setShowParentDashboard?.(false);
  }, [setGroupName, setShowAddContact, setShowCallModal, setShowFriendRequestsPanel, setShowNewChat, setShowNewGroup, setShowParentDashboard, setShowProfile, showNewGroup]);

  useEffect(() => {
    if (!showFriendRequestsPanel) {
      setRequestsSheetClosing(false);
      setRequestsTab('ontvangen');
      return;
    }
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setAddContactSheetClosing(false);
    setShowAddContact?.(false);
    setNewChatSheetClosing(false);
    setShowNewChat?.(false);
    setNewGroupSheetClosing(false);
    setShowNewGroup?.(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setProfileSheetClosing(false);
    setShowProfile?.(false);
    setParentPortalSheetClosing(false);
    setShowParentDashboard?.(false);
  }, [setShowAddContact, setShowCallModal, setShowFriendRequestsPanel, setShowNewChat, setShowNewGroup, setShowParentDashboard, setShowProfile, showFriendRequestsPanel]);

  useEffect(() => {
    if (!contactMenu) return;
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setAddContactSheetClosing(false);
    setShowAddContact?.(false);
    setNewChatSheetClosing(false);
    setShowNewChat?.(false);
    setNewGroupSheetClosing(false);
    setShowNewGroup?.(false);
    setRequestsSheetClosing(false);
    setShowFriendRequestsPanel?.(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setProfileSheetClosing(false);
    setShowProfile?.(false);
    setParentPortalSheetClosing(false);
    setShowParentDashboard?.(false);
  }, [contactMenu, setShowAddContact, setShowCallModal, setShowFriendRequestsPanel, setShowNewChat, setShowNewGroup, setShowParentDashboard, setShowProfile]);

  useEffect(() => {
    if (!convActionsSheet) return;
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setAddContactSheetClosing(false);
    setShowAddContact?.(false);
    setNewChatSheetClosing(false);
    setShowNewChat?.(false);
    setNewGroupSheetClosing(false);
    setShowNewGroup?.(false);
    setRequestsSheetClosing(false);
    setShowFriendRequestsPanel?.(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setProfileSheetClosing(false);
    setShowProfile?.(false);
    setParentPortalSheetClosing(false);
    setShowParentDashboard?.(false);
  }, [convActionsSheet, setShowAddContact, setShowCallModal, setShowFriendRequestsPanel, setShowNewChat, setShowNewGroup, setShowParentDashboard, setShowProfile]);

  useEffect(() => {
    if (!showParentDashboard) {
      setParentPortalSheetClosing(false);
      return;
    }
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setAddContactSheetClosing(false);
    setShowAddContact?.(false);
    setNewChatSheetClosing(false);
    setShowNewChat?.(false);
    setNewGroupSheetClosing(false);
    setShowNewGroup?.(false);
    setRequestsSheetClosing(false);
    setShowFriendRequestsPanel?.(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setProfileSheetClosing(false);
    setShowProfile?.(false);
  }, [setShowAddContact, setShowCallModal, setShowFriendRequestsPanel, setShowNewChat, setShowNewGroup, setShowProfile, showParentDashboard]);

  useEffect(() => {
    if (!showCallModal) {
      setCallSheetClosing(false);
      setCallActionMode(null);
      setCallSearch('');
    }
  }, [showCallModal]);

  useEffect(() => {
    if (!convMenu && !contactMenu) return;
    function handleClickOutside(e) {
      const target = e.target;
      if (target?.closest?.('[data-sidebar-actions-menu]')) return;
      if (target?.closest?.('[data-sidebar-actions-trigger]')) return;
      if (target?.closest?.('.pulse-confirm-backdrop')) return;
      if (target?.closest?.('.contact-profile-panel')) return;
      if (target?.closest?.('.call-overlay, .call-mini-bar')) return;
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
      if (!sidebarRef.current || !sidebarHeaderRef.current || !sidebarTabsRef.current || !sidebarFooterRef.current || !sidebarFooterTabbarRef.current) return;
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const headerRect = sidebarHeaderRef.current.getBoundingClientRect();
      const footerRect = sidebarFooterRef.current.getBoundingClientRect();
      const footerTabbarRect = sidebarFooterTabbarRef.current.getBoundingClientRect();
      const sheetTop = Math.round(headerRect.bottom - 2);
      const localSheetTop = Math.round(headerRect.bottom - sidebarRect.top - 2);

      root.style.setProperty('--sidebar-sheet-left', `${Math.round(sidebarRect.left)}px`);
      root.style.setProperty('--sidebar-sheet-right', `${Math.round(sidebarRect.right)}px`);
      root.style.setProperty('--sidebar-sheet-top', `${sheetTop}px`);
      root.style.setProperty('--sidebar-sheet-bottom', `${Math.round(footerRect.bottom)}px`);
      root.style.setProperty('--sidebar-sheet-anchor-bottom', `${Math.round(footerTabbarRect.top)}px`);

      sidebarRef.current.style.setProperty('--sidebar-local-sheet-top', `${localSheetTop}px`);
      sidebarRef.current.style.setProperty('--sidebar-local-sheet-bottom', `${Math.round(sidebarRect.bottom - footerTabbarRect.top)}px`);
    };

    updateSidebarSheetBounds();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateSidebarSheetBounds())
      : null;

    if (resizeObserver) {
      resizeObserver.observe(sidebarRef.current);
      resizeObserver.observe(sidebarHeaderRef.current);
      resizeObserver.observe(sidebarTabsRef.current);
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

  const callLog = typeof getCallLog === 'function' ? getCallLog() : [];
  const unreadMissedCallCount = callLogRead ? 0 : callLog.filter((entry) => entry.direction === 'missed').length;
  const missedCallCount = callsAvailable ? Math.max(unreadMissedCallCount, missedCallAlert ? 1 : 0) : 0;
  const hasMissedCall = missedCallCount > 0;

  function openContactMenu(contactUid, anchorEl) {
    const contact = contacts.find((item) => item.uid === contactUid);
    setContactMenu(prev => prev?.uid === contactUid ? null : { uid: contactUid, contact });
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
  useEffect(() => {
    if (!conversationActionsRequest?.id) return;
    openConvActionsSheet(conversationActionsRequest, getOtherUid?.(conversationActionsRequest));
    onConversationActionsRequestHandled?.();
  }, [conversationActionsRequest, getOtherUid, onConversationActionsRequestHandled, openConvActionsSheet]);
  const closeConvActionsSheet = useCallback(() => {
    if (convSheetHistoryPushedRef.current) {
      convSheetHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setConvActionsSheet(null);
  }, []);
  const closeMoreActionsSheet = useCallback(() => {
    if (moreActionsCloseTimeoutRef.current) {
      window.clearTimeout(moreActionsCloseTimeoutRef.current);
      moreActionsCloseTimeoutRef.current = null;
    }
    setMoreActionsMenuClosing(false);
    setMoreActionsMenuOpen(false);
  }, []);
  const dismissMoreActionsSheet = useCallback(() => {
    if (moreActionsMenuClosing || !moreActionsSheetVisible) return;
    if (moreActionsSheetHistoryPushedRef.current) {
      moreActionsSheetHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setMoreActionsMenuClosing(true);
  }, [moreActionsMenuClosing, moreActionsSheetVisible]);

  const closeAddContactSheet = useCallback(() => {
    if (addContactSheetCloseTimeoutRef.current) {
      window.clearTimeout(addContactSheetCloseTimeoutRef.current);
      addContactSheetCloseTimeoutRef.current = null;
    }
    setAddContactSheetClosing(false);
    setShowAddContact?.(false);
    setContactEmail?.('');
    setContactNickname?.('');
    setContactRelation?.(null);
    clearPendingFriendRequestState?.();
  }, [clearPendingFriendRequestState, setContactEmail, setContactNickname, setContactRelation, setShowAddContact]);

  const dismissAddContactSheet = useCallback(() => {
    if (addContactSheetClosing || !addContactSheetVisible) return;
    setAddContactSheetClosing(true);
  }, [addContactSheetClosing, addContactSheetVisible]);

  const closeNewChatSheet = useCallback(() => {
    if (newChatSheetCloseTimeoutRef.current) {
      window.clearTimeout(newChatSheetCloseTimeoutRef.current);
      newChatSheetCloseTimeoutRef.current = null;
    }
    setNewChatSheetClosing(false);
    setShowNewChat?.(false);
    setSearchEmail?.('');
  }, [setSearchEmail, setShowNewChat]);

  const dismissNewChatSheet = useCallback(() => {
    if (newChatSheetClosing || !newChatSheetVisible) return;
    setNewChatSheetClosing(true);
  }, [newChatSheetClosing, newChatSheetVisible]);

  const closeNewGroupSheet = useCallback(() => {
    if (newGroupSheetCloseTimeoutRef.current) {
      window.clearTimeout(newGroupSheetCloseTimeoutRef.current);
      newGroupSheetCloseTimeoutRef.current = null;
    }
    setNewGroupSheetClosing(false);
    setShowNewGroup?.(false);
    setGroupName?.('');
  }, [setGroupName, setShowNewGroup]);

  const dismissNewGroupSheet = useCallback(() => {
    if (newGroupSheetClosing || !newGroupSheetVisible) return;
    setNewGroupSheetClosing(true);
  }, [newGroupSheetClosing, newGroupSheetVisible]);

  const closeRequestsSheet = useCallback(() => {
    if (requestsSheetCloseTimeoutRef.current) {
      window.clearTimeout(requestsSheetCloseTimeoutRef.current);
      requestsSheetCloseTimeoutRef.current = null;
    }
    setRequestsSheetClosing(false);
    setShowFriendRequestsPanel?.(false);
    setRequestsTab('ontvangen');
  }, [setShowFriendRequestsPanel]);

  const dismissRequestsSheet = useCallback(() => {
    if (requestsSheetClosing || !requestsSheetVisible) return;
    setRequestsSheetClosing(true);
  }, [requestsSheetClosing, requestsSheetVisible]);

  const navigateBackToMoreActions = useCallback((closeSheet) => {
    closeSheet?.();
    setMoreActionsMenuClosing(false);
    setMoreActionsMenuOpen(true);
  }, []);

  const closeCallSheet = useCallback(() => {
    if (callSheetCloseTimeoutRef.current) {
      window.clearTimeout(callSheetCloseTimeoutRef.current);
      callSheetCloseTimeoutRef.current = null;
    }
    setCallSheetClosing(false);
    setShowCallModal?.(false);
    setCallActionMode(null);
    setCallSearch('');
  }, [setShowCallModal]);

  const dismissCallSheet = useCallback(() => {
    if (callSheetClosing || !callSheetVisible) return;
    setCallSheetClosing(true);
  }, [callSheetClosing, callSheetVisible]);

  const closeParentPortalSheet = useCallback(() => {
    if (parentPortalSheetCloseTimeoutRef.current) {
      window.clearTimeout(parentPortalSheetCloseTimeoutRef.current);
      parentPortalSheetCloseTimeoutRef.current = null;
    }
    setParentPortalSheetClosing(false);
    setParentPortalView('menu');
    setShowParentDashboard?.(false);
  }, [setShowParentDashboard]);

  const dismissParentPortalSheet = useCallback(() => {
    if (parentPortalSheetClosing || !parentPortalPageVisible) return;
    setParentPortalSheetClosing(true);
  }, [parentPortalSheetClosing, parentPortalPageVisible]);

  useEffect(() => {
    if (!moreActionsMenuClosing) return undefined;
    moreActionsCloseTimeoutRef.current = window.setTimeout(() => {
      moreActionsCloseTimeoutRef.current = null;
      setMoreActionsMenuClosing(false);
      setMoreActionsMenuOpen(false);
    }, 240);
    return () => {
      if (moreActionsCloseTimeoutRef.current) {
        window.clearTimeout(moreActionsCloseTimeoutRef.current);
        moreActionsCloseTimeoutRef.current = null;
      }
    };
  }, [moreActionsMenuClosing]);

  useEffect(() => {
    if (!addContactSheetClosing) return undefined;
    addContactSheetCloseTimeoutRef.current = window.setTimeout(() => {
      addContactSheetCloseTimeoutRef.current = null;
      closeAddContactSheet();
    }, 220);
    return () => {
      if (addContactSheetCloseTimeoutRef.current) {
        window.clearTimeout(addContactSheetCloseTimeoutRef.current);
        addContactSheetCloseTimeoutRef.current = null;
      }
    };
  }, [addContactSheetClosing, closeAddContactSheet]);

  useEffect(() => {
    if (!newChatSheetClosing) return undefined;
    newChatSheetCloseTimeoutRef.current = window.setTimeout(() => {
      newChatSheetCloseTimeoutRef.current = null;
      closeNewChatSheet();
    }, 220);
    return () => {
      if (newChatSheetCloseTimeoutRef.current) {
        window.clearTimeout(newChatSheetCloseTimeoutRef.current);
        newChatSheetCloseTimeoutRef.current = null;
      }
    };
  }, [closeNewChatSheet, newChatSheetClosing]);

  useEffect(() => {
    if (!newGroupSheetClosing) return undefined;
    newGroupSheetCloseTimeoutRef.current = window.setTimeout(() => {
      newGroupSheetCloseTimeoutRef.current = null;
      closeNewGroupSheet();
    }, 220);
    return () => {
      if (newGroupSheetCloseTimeoutRef.current) {
        window.clearTimeout(newGroupSheetCloseTimeoutRef.current);
        newGroupSheetCloseTimeoutRef.current = null;
      }
    };
  }, [closeNewGroupSheet, newGroupSheetClosing]);

  useEffect(() => {
    if (!requestsSheetClosing) return undefined;
    requestsSheetCloseTimeoutRef.current = window.setTimeout(() => {
      requestsSheetCloseTimeoutRef.current = null;
      closeRequestsSheet();
    }, 220);
    return () => {
      if (requestsSheetCloseTimeoutRef.current) {
        window.clearTimeout(requestsSheetCloseTimeoutRef.current);
        requestsSheetCloseTimeoutRef.current = null;
      }
    };
  }, [closeRequestsSheet, requestsSheetClosing]);

  useEffect(() => {
    if (!callSheetClosing) return undefined;
    callSheetCloseTimeoutRef.current = window.setTimeout(() => {
      callSheetCloseTimeoutRef.current = null;
      closeCallSheet();
    }, 220);
    return () => {
      if (callSheetCloseTimeoutRef.current) {
        window.clearTimeout(callSheetCloseTimeoutRef.current);
        callSheetCloseTimeoutRef.current = null;
      }
    };
  }, [callSheetClosing, closeCallSheet]);

  useEffect(() => {
    if (!parentPortalSheetClosing) return undefined;
    parentPortalSheetCloseTimeoutRef.current = window.setTimeout(() => {
      parentPortalSheetCloseTimeoutRef.current = null;
      closeParentPortalSheet();
    }, 220);
    return () => {
      if (parentPortalSheetCloseTimeoutRef.current) {
        window.clearTimeout(parentPortalSheetCloseTimeoutRef.current);
        parentPortalSheetCloseTimeoutRef.current = null;
      }
    };
  }, [closeParentPortalSheet, parentPortalSheetClosing]);
  const closeContactActionsSheet = useCallback(() => {
    if (contactSheetHistoryPushedRef.current) {
      contactSheetHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setContactMenu(null);
  }, []);

  const completeContactActionsSheet = useCallback(() => {
    contactSheetHistoryPushedRef.current = false;
    setContactMenu(null);
  }, []);

  const completeConvActionsSheet = useCallback(() => {
    convSheetHistoryPushedRef.current = false;
    setConvActionsSheet(null);
  }, []);

  const closeProfileOverviewSheet = useCallback(() => {
    if (profileSheetCloseTimeoutRef.current) {
      window.clearTimeout(profileSheetCloseTimeoutRef.current);
      profileSheetCloseTimeoutRef.current = null;
    }
    setProfileSheetClosing(false);
    setShowProfile?.(false);
  }, [setShowProfile]);

  const dismissProfileOverviewSheet = useCallback(() => {
    if (profileSheetClosing || !settingsSheetVisible) return;
    setProfileSheetClosing(true);
  }, [profileSheetClosing, settingsSheetVisible]);

  useEffect(() => {
    if (!profileSheetClosing) return undefined;
    profileSheetCloseTimeoutRef.current = window.setTimeout(() => {
      profileSheetCloseTimeoutRef.current = null;
      closeProfileOverviewSheet();
    }, 220);
    return () => {
      if (profileSheetCloseTimeoutRef.current) {
        window.clearTimeout(profileSheetCloseTimeoutRef.current);
        profileSheetCloseTimeoutRef.current = null;
      }
    };
  }, [closeProfileOverviewSheet, profileSheetClosing]);
  const profileFooterActive = settingsSheetVisible;
  const callsFooterActive = callSheetVisible;
  const parentFooterActive = parentPortalPageVisible;
  const moreFooterActive = moreActionsSheetVisible || addContactSheetVisible || newChatSheetVisible || newGroupSheetVisible || requestsSheetVisible;
  const chatsFooterActive = activeTab === 'chats' && !profileFooterActive && !callsFooterActive && !parentFooterActive && !moreFooterActive;
  const chatUnreadCount = Object.values(unreadCounts || {}).reduce((total, count) => total + (Number(count) || 0), 0);
  const footerEmbeddedInCluster = !!footerClusterMode
    && footerClusterMode !== 'more'
    && footerClusterMode !== 'settings';
  const contextPanelVisible = contactProfileVisible || groupInfoVisible;
  const closeContextPanel = contactProfileVisible ? onCloseContactProfile : (groupInfoVisible ? onCloseGroupInfo : undefined);

  const footerTabbar = (
    <div
      className={`sidebar-footer-tabbar${footerEmbeddedInCluster ? ' sidebar-footer-tabbar--cluster' : ''}`}
      ref={sidebarFooterTabbarRef}
      role="navigation"
      aria-label="Sidebar navigatie"
      onClick={contextPanelVisible ? closeContextPanel : undefined}
    >
      <button
        type="button"
        className={`sidebar-footer-tab sidebar-footer-tab-profile${profileFooterActive ? ' active' : ''}`}
        aria-label={`Open profielinstellingen voor ${user.displayName || user.email?.split('@')[0] || 'gebruiker'}, online`}
        onClick={() => {
          if (settingsSheetVisible) {
            setProfileSheetClosing(false);
            setProfileTab?.('overview');
            return;
          }
          closeAddContactSheet();
          closeNewChatSheet();
          closeShareContactPage();
          closeNewGroupSheet();
          closeRequestsSheet();
          closeContactActionsSheet();
          closeConvActionsSheet();
          closeCallSheet();
          closeParentPortalSheet();
          if (profileSheetCloseTimeoutRef.current) {
            window.clearTimeout(profileSheetCloseTimeoutRef.current);
            profileSheetCloseTimeoutRef.current = null;
          }
          setProfileSheetClosing(false);
          onOpenProfile?.();
        }}
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
        className={`sidebar-footer-tab ${chatsFooterActive ? 'active' : ''}`}
        aria-label={chatUnreadCount > 0 ? `Chats, ${chatUnreadCount > 99 ? 'meer dan 99' : chatUnreadCount} ongelezen ${chatUnreadCount === 1 ? 'bericht' : 'berichten'}` : 'Chats'}
        onClick={() => {
          closeMoreActionsSheet();
          closeAddContactSheet();
          closeNewChatSheet();
          closeShareContactPage();
          closeNewGroupSheet();
          closeRequestsSheet();
          closeContactActionsSheet();
          closeConvActionsSheet();
          closeCallSheet();
          setProfileSheetClosing(false);
          setShowProfile?.(false);
          setProfileTab?.('overview');
          closeProfileOverviewSheet();
          closeParentPortalSheet();
          setSearchQuery('');
          setActiveTab('chats');
          if (contextPanelVisible) onShowChatsFromContextPanel?.();
        }}
        title="Chats"
      >
        <span className="sidebar-footer-tab-wrap">
          <span className="sidebar-footer-tab-icon" aria-hidden="true">
            <Message size={26} aria-hidden="true" />
          </span>
          {chatUnreadCount > 0
            ? <span className="sidebar-footer-tab-count" aria-hidden="true">{chatUnreadCount > 99 ? '99+' : chatUnreadCount}</span>
            : hasMissedCall && !callsAvailable && <span className="sidebar-footer-tab-badge" aria-hidden="true" />
          }
        </span>
        <span className="sidebar-footer-tab-label">Chats</span>
      </button>

      {callsAvailable && (
        <button
          type="button"
          className={`sidebar-footer-tab${callsFooterActive ? ' active' : ''}`}
        aria-label={missedCallCount > 0 ? `Oproepen, ${missedCallCount > 99 ? 'meer dan 99' : missedCallCount} gemiste ${missedCallCount === 1 ? 'oproep' : 'oproepen'}` : 'Oproepen'}
          aria-expanded={callSheetVisible}
          onClick={() => {
            if (callSheetVisible) {
              dismissCallSheet();
              return;
            }
            closeProfileOverviewSheet();
            closeAddContactSheet();
            closeNewChatSheet();
            closeShareContactPage();
            closeNewGroupSheet();
            closeRequestsSheet();
            closeContactActionsSheet();
            closeConvActionsSheet();
            closeParentPortalSheet();
            if (callSheetCloseTimeoutRef.current) {
              window.clearTimeout(callSheetCloseTimeoutRef.current);
              callSheetCloseTimeoutRef.current = null;
            }
            setMoreActionsMenuClosing(false);
            setMoreActionsMenuOpen(false);
            setCallSheetClosing(false);
            onShowCallModal?.();
          }}
          title="Oproepen"
        >
          <span className="sidebar-footer-tab-wrap">
            <span className="sidebar-footer-tab-icon" aria-hidden="true">
              <Phone size={26} aria-hidden="true" />
            </span>
            {missedCallCount > 0 && <span className="sidebar-footer-tab-count" aria-hidden="true">{missedCallCount > 99 ? '99+' : missedCallCount}</span>}
          </span>
          <span className="sidebar-footer-tab-label">Bellen</span>
        </button>
      )}

      {isParent && (
        <button
          type="button"
          className={`sidebar-footer-tab${parentFooterActive ? ' active' : ''}`}
          aria-label={parentActivityBadge > 0 ? `Open ouderportaal, ${parentActivityBadge > 9 ? 'meer dan 9' : parentActivityBadge} nieuwe activiteiten` : 'Open ouderportaal'}
          aria-expanded={parentPortalPageVisible}
          onClick={() => {
            if (parentPortalPageVisible) {
              setParentPortalView('menu');
              return;
            }
            closeProfileOverviewSheet();
            closeAddContactSheet();
            closeNewChatSheet();
            closeShareContactPage();
            closeNewGroupSheet();
            closeRequestsSheet();
            closeContactActionsSheet();
            closeConvActionsSheet();
            closeCallSheet();
            if (parentPortalSheetCloseTimeoutRef.current) {
              window.clearTimeout(parentPortalSheetCloseTimeoutRef.current);
              parentPortalSheetCloseTimeoutRef.current = null;
            }
            setParentPortalSheetClosing(false);
            setParentPortalView('menu');
            onOpenDashboard?.();
          }}
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
          className={`sidebar-footer-tab sidebar-footer-tab-more${moreFooterActive ? ' active' : ''}`}
          aria-label="Meer acties"
          aria-expanded={moreActionsSheetVisible}
          onClick={() => {
            if (moreActionsSheetVisible) {
              dismissMoreActionsSheet();
              return;
            }
            closeProfileOverviewSheet();
            closeAddContactSheet();
            closeNewChatSheet();
            closeShareContactPage();
            closeNewGroupSheet();
            closeRequestsSheet();
            closeContactActionsSheet();
            closeConvActionsSheet();
            closeParentPortalSheet();
            if (moreActionsCloseTimeoutRef.current) {
              window.clearTimeout(moreActionsCloseTimeoutRef.current);
              moreActionsCloseTimeoutRef.current = null;
            }
            closeCallSheet();
            setMoreActionsMenuClosing(false);
            setMoreActionsMenuOpen(true);
          }}
          title="Meer acties"
        >
          <span className="sidebar-footer-tab-icon" aria-hidden="true">
            <MoreHoriz size={22} aria-hidden="true" />
          </span>
          <span className="sidebar-footer-tab-label">Meer</span>
        </button>
      </div>
    </div>
  );

  const renderConvActions = useCallback((conv, otherUid, onDone) => {
    const contact = contacts.find(c => c.uid === otherUid);
    const isParentBlocked = parentBlockedUids?.includes(otherUid);
    const isProtectedParentContact = !isParent && contact?.role === 'parent';
    const isPinned = pinnedContacts.includes(otherUid);
    const isMuted = mutedConversationIds.includes(conv.id);
    const handleViewContactFromActions = () => {
      if (!contact) return;
      onViewContact(contact, { preserveActiveConversation: true });
      onDone?.();
    };
    const handleOpenConversationFromActions = () => {
      onOpenConversation(conv);
      onDone?.();
    };
    const handleCallFromConversationActions = (isVideo) => {
      onCallFromConv(conv, isVideo);
      onDone?.();
    };
    const handleTogglePinFromConversationActions = () => {
      onTogglePin(otherUid);
      onDone?.();
    };
    const handleBlockContactFromConversationActions = () => {
      if (!contact) return;
      onBlockContact(contact);
    };
    const handleClearConversationFromActions = () => {
      onClearConversation?.(conv);
    };
    const handleHardDeleteConversationFromActions = () => {
      onHardDeleteConversation?.(conv);
    };
    const handleToggleConversationMuteFromActions = () => {
      onToggleConversationMute?.(conv.id);
      onDone?.();
    };
    const handleLeaveGroupFromActions = () => {
      onLeaveGroup?.(conv);
      onDone?.();
    };
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
            onClick={handleViewContactFromActions} title="Profiel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z" /></svg>
            <span>Profiel</span>
          </button>
        )}
        {!isParentBlocked && <>
          {!conv.isGroup && <button type="button" role="menuitem" className="chat-header-menu-item"
            onClick={handleOpenConversationFromActions} title="Bericht sturen">
            <Message size={14} aria-hidden="true" />
            <span>Bericht sturen</span>
          </button>}
          {!conv.isGroup && callsAvailable && (
            <>
              <button type="button" role="menuitem" className="chat-header-menu-item"
                onClick={() => handleCallFromConversationActions(false)} title="Bellen">
                <Phone size={14} aria-hidden="true" />
                <span>Bellen</span>
              </button>
              <button type="button" role="menuitem" className="chat-header-menu-item"
                onClick={() => handleCallFromConversationActions(true)} title="Videobellen">
                <Video size={14} aria-hidden="true" />
                <span>Videobellen</span>
              </button>
            </>
          )}
          {!conv.isGroup && otherUid && (
            <button type="button" role="menuitem" className={`chat-header-menu-item${isPinned ? ' danger' : ''}`}
              onClick={handleTogglePinFromConversationActions} title={isPinned ? 'Losmaken' : 'Vastzetten'}>
              <Pin size={14} aria-hidden="true" />
              <span>{isPinned ? 'Losmaken' : 'Vastzetten'}</span>
            </button>
          )}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isMuted}
            className={`chat-header-menu-item${isMuted ? ' danger' : ''}`}
            onClick={handleToggleConversationMuteFromActions}
            title={`Meldingen ${isMuted ? 'uit' : 'aan'}`}
          >
            {isMuted ? <BellOff size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
            <span>Meldingen {isMuted ? 'uit' : 'aan'}</span>
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
            onClick={handleLeaveGroupFromActions}
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
              onClick={handleClearConversationFromActions}
              title="Chat wissen"
            >
              <XIcon size={14} aria-hidden="true" />
              <span>Chat wissen</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="chat-header-menu-item danger"
              onClick={handleHardDeleteConversationFromActions}
              title="Chat verwijderen"
            >
              <Trash2 size={14} aria-hidden="true" />
              <span>Chat verwijderen</span>
            </button>
            {contact && !isProtectedParentContact && (
              <button type="button" role="menuitem" className="chat-header-menu-item danger"
                onClick={handleBlockContactFromConversationActions} title="Blokkeren">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
                <span>Blokkeren</span>
              </button>
            )}
          </>
        )}
      </>
    );
  }, [contacts, parentBlockedUids, isParent, pinnedContacts, mutedConversationIds, onShowGroupInfo, onViewContact, onOpenConversation, callsAvailable, onCallFromConv, onTogglePin, onToggleConversationMute, onEnterMessageSelectionForConversation, onShowStarredForConversation, onLeaveGroup, onClearConversation, onHardDeleteConversation, onBlockContact]);

  const remainingRateLimitMs = Math.max(0, Number(callLogRateLimitUntil || 0) - Date.now());
  const remainingRateLimitSeconds = Math.ceil(remainingRateLimitMs / 1000);
  const normalizedCallSearch = callSearch.trim().toLowerCase();
  const filteredCallLog = normalizedCallSearch
    ? callLog.filter((entry) => {
        const name = (entry?.name || '').toLowerCase();
        const typeLabel = entry?.isVideo ? 'videogesprek' : 'gesprek';
        return name.includes(normalizedCallSearch) || typeLabel.includes(normalizedCallSearch);
      })
    : callLog;
  const filteredCallContacts = normalizedCallSearch
    ? contacts.filter((contact) => {
        const displayName = (getContactDisplayName(contact) || contact.displayName || '').toLowerCase();
        const email = (contact.email || '').toLowerCase();
        return displayName.includes(normalizedCallSearch) || email.includes(normalizedCallSearch);
      })
    : contacts;
  const footerClusterAriaLabel = footerClusterMode === 'settings'
    ? 'Instellingen'
    : footerClusterMode === 'add-contact'
      ? 'Nieuw contact'
      : footerClusterMode === 'new-chat'
        ? 'Nieuwe chat'
        : footerClusterMode === 'new-group'
          ? 'Nieuwe groep'
          : footerClusterMode === 'requests'
            ? 'Verzoeken'
            : footerClusterMode === 'parent-portal'
              ? 'Ouderportaal'
              : 'Meer acties';
  const footerClusterTitle = footerClusterMode === 'settings'
    ? (profileTab === 'overview' ? 'Instellingen' : activeProfileSection?.label || 'Instellingen')
    : footerClusterMode === 'add-contact'
      ? 'Nieuw contact'
      : footerClusterMode === 'new-chat'
        ? 'Nieuwe chat'
        : footerClusterMode === 'new-group'
          ? 'Nieuwe groep'
          : footerClusterMode === 'requests'
            ? 'Verzoeken'
            : footerClusterMode === 'parent-portal'
              ? 'Ouderportaal'
              : 'Meer opties';
  const isMoreFooterCluster = footerClusterMode === 'more';
  const isSidebarPageMode = embeddedSettingsActive
    || parentPortalPageVisible
    || callsProfilePageVisible
    || contactActionsPageVisible
    || conversationActionsPageVisible;
  const isLightFooterCluster = isMoreFooterCluster;
  const useDetachedFooterCluster = isLightFooterCluster || !footerEmbeddedInCluster;
  const footerClusterSheetClassName = isLightFooterCluster
    ? `sidebar-bottom-cluster-panel sidebar-bottom-cluster-panel--more${isMoreFooterCluster && moreActionsMenuClosing ? ' is-closing' : ''}`
    : `pulse-sheet pulse-sheet--sidebar-actions sidebar-bottom-cluster-sheet${footerClusterMode ? ` sidebar-bottom-cluster-sheet--${footerClusterMode}` : ''}${useDetachedFooterCluster ? ' sidebar-bottom-cluster-sheet--detached-footer' : ''}${footerClusterMode === 'settings' && profileSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'add-contact' && addContactSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'new-chat' && newChatSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'new-group' && newGroupSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'requests' && requestsSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'parent-portal' && parentPortalSheetClosing ? ' is-closing' : ''}`;
  const dismissFooterCluster = footerClusterMode === 'settings'
    ? dismissProfileOverviewSheet
    : footerClusterMode === 'add-contact'
      ? dismissAddContactSheet
      : footerClusterMode === 'new-chat'
        ? dismissNewChatSheet
        : footerClusterMode === 'new-group'
        ? dismissNewGroupSheet
        : footerClusterMode === 'requests'
          ? dismissRequestsSheet
          : footerClusterMode === 'parent-portal'
            ? dismissParentPortalSheet
            : dismissMoreActionsSheet;

  return (
    <aside className={`sidebar${moreActionsMenuOpen ? ' sidebar--more-actions-open' : ''}${isSidebarPageMode ? ' sidebar--settings-open' : ''}`} ref={sidebarRef} onClick={() => { setConvMenu(null); setContactMenu(null); }}>
      {!isSidebarPageMode && (
        <>
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
          <div className="sidebar-tabs" ref={sidebarTabsRef}>
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
                    <button type="button" className="btn-danger chat-selection-delete-btn" aria-label="Geselecteerde chats verwijderen" title="Verwijderen" disabled={selectedConversationIds.length === 0} onClick={onDeleteSelectedConversations}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
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
              {contacts.length === 0 && friendRequests.length === 0 && sentFriendRequests.length === 0 && (
                <div className="empty-convs">
                  <p>Nog geen contacten.</p>
                  <p>Voeg iemand toe via e-mailadres.</p>
                </div>
              )}

              {filteredContacts.map(contact => (
                <div key={contact.uid} className="sidebar-contact-card" aria-label={`Contact ${getContactDisplayName(contact)}${contact.email ? `, ${contact.email}` : ''}`}>
                  <div
                    className="sidebar-contact-row sidebar-contact-row--openable"
                    role="button"
                    tabIndex={0}
                    onClick={() => onStartChat?.(contact)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onStartChat?.(contact);
                    }}
                  >
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
        </>
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

      {settingsProfilePageVisible ? renderSettingsOverviewSheet() : null}
      {moreActionsSheetVisible ? renderMoreActionsPage() : null}
      {newChatSheetVisible ? renderNewChatPage() : null}
      {shareContactPageVisible ? renderShareContactPage() : null}
      {addContactSheetVisible ? renderAddContactPage() : null}
      {newGroupSheetVisible ? renderNewGroupPage() : null}
      {requestsSheetVisible ? renderRequestsPage() : null}
      {accountProfilePageVisible ? renderSettingsAccountSheet() : null}
      {historyProfilePageVisible && isParent ? renderSettingsHistorySheet() : null}
      {stylingProfilePageVisible ? renderSettingsStylingSheet() : null}
      {blockedProfilePageVisible ? renderSettingsBlockedSheet() : null}
      {parentPortalPageVisible ? (
        <ParentDashboard
          user={user}
          panelRef={parentPortalPanelRef}
          parentActivityBadge={parentActivityBadge}
          onActivitiesViewed={onParentActivitiesViewed}
          onClose={dismissParentPortalSheet}
          embeddedPortalView={parentPortalView}
          onEmbeddedPortalViewChange={setParentPortalView}
        />
      ) : null}
      {callsProfilePageVisible ? renderCallsProfilePage() : null}
      {contactActionsPageVisible && !shareContactPageVisible ? renderContactActionsPage() : null}
      {conversationActionsPageVisible ? renderConversationActionsPage() : null}

      {footerClusterMode ? (
        <div
          className={`sidebar-bottom-cluster-backdrop${footerClusterMode ? ` sidebar-bottom-cluster-backdrop--${footerClusterMode}` : ''}${footerClusterMode === 'more' && moreActionsMenuClosing ? ' is-closing' : ''}${footerClusterMode === 'settings' && profileSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'add-contact' && addContactSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'new-chat' && newChatSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'new-group' && newGroupSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'requests' && requestsSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'parent-portal' && parentPortalSheetClosing ? ' is-closing' : ''}`}
          onClick={dismissFooterCluster}
        >
          <div
            className={`sidebar-bottom-cluster${useDetachedFooterCluster ? ' sidebar-bottom-cluster--detached-footer' : ''}${footerClusterMode === 'settings' ? ' sidebar-bottom-cluster--settings-screen' : ''}${footerClusterMode === 'more' && moreActionsMenuClosing ? ' is-closing' : ''}${footerClusterMode === 'settings' && profileSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'add-contact' && addContactSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'new-chat' && newChatSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'new-group' && newGroupSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'requests' && requestsSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'parent-portal' && parentPortalSheetClosing ? ' is-closing' : ''}`}
            data-sidebar-actions-menu
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={footerClusterSheetClassName}
              role="menu"
              aria-label={footerClusterAriaLabel}
            >
              <div className="pulse-sheet-handle" aria-hidden="true" />
              <div className={`pulse-sheet-header pulse-sheet-header--sidebar-actions${footerClusterMode === 'settings' ? ' pulse-sheet-header--settings-screen' : ''}${footerClusterMode === 'settings' && profileTab === 'overview' ? ' pulse-sheet-header--settings-overview' : ''}${(footerClusterMode === 'parent-portal' && parentPortalView !== 'menu') || (footerClusterMode === 'settings' && profileTab !== 'overview') ? ' has-back-button' : ''}`}>
                {footerClusterMode === 'parent-portal' && parentPortalView !== 'menu' && (
                  <button
                    type="button"
                    className="pulse-sheet-close pulse-sheet-close--sidebar-actions pulse-sheet-back-btn"
                    aria-label="Terug naar ouderportaal"
                    title="Terug"
                    onClick={() => setParentPortalView('menu')}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                )}
                {footerClusterMode === 'settings' && profileTab !== 'overview' && (
                  <button
                    type="button"
                    className="pulse-sheet-close pulse-sheet-close--sidebar-actions pulse-sheet-back-btn profile-modal-back"
                    aria-label="Terug naar instellingen"
                    title="Terug"
                    onClick={() => setProfileTab?.('overview')}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                )}
                {!(footerClusterMode === 'settings' && profileTab === 'overview') && !isLightFooterCluster && (
                  <>
                    <div className={`pulse-sheet-title pulse-sheet-title--sidebar-actions${footerClusterMode === 'settings' ? ' profile-modal-header-title' : ''}`}>
                      {footerClusterTitle}
            </div>
            <button
                      type="button"
                      className={`pulse-sheet-close pulse-sheet-close--sidebar-actions${footerClusterMode === 'settings' ? ' profile-modal-close pulse-sheet-close--settings' : ''}`}
                      aria-label="Sluiten"
                      onClick={dismissFooterCluster}
                    >
                      <XIcon size={20} aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
              {footerClusterMode === 'settings' ? (
                <div className="profile-modal-body">
                  <div className="profile-content">
                    {profileTab === 'overview' ? (
                      renderSettingsOverviewSheet()
                    ) : profileTab === 'account' ? (
                    <div className="profile-account-scroll">
                      <div className="profile-account-view">
                        <div className="profile-account-card">
                          <div className="profile-account-intro">
                            <h4 className="profile-account-title">Mijn account</h4>
                            <p className="profile-account-subcopy">
                              Werk je naam, avatar en wachtwoord bij in dezelfde compacte Pulse sheet-stijl.
                            </p>
                          </div>
                          <div className="profile-account-hero">
                            <div className="profile-account-hero-stack">
                              <div className="profile-photo-wrap" onClick={() => photoInputRef?.current?.click()}>
                                {photoPreview
                                  ? <img src={photoPreview} alt="avatar" className="profile-avatar-big" style={{ objectFit: 'cover' }} loading="lazy" onError={() => { setPhotoPreview?.(null); localStorage.removeItem(`pulse_photo_${user.uid}`); }} />
                                  : <div className="profile-avatar-big">{getInitials(user.displayName || user.email)}</div>
                                }
                                <div className="profile-photo-overlay"><Camera size={16} /></div>
                              </div>
                              <button type="button" className="profile-account-avatar-btn" onClick={() => setShowAvatarBuilder?.(true)}>
                                🎨 Avatar maken
                              </button>
                            </div>
                            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                          </div>
                          <div className="profile-account-form">
                            <div className="form-group">
                              <label className="form-label">Weergavenaam</label>
                              <input className="form-input" placeholder="Jouw naam" value={newName} onChange={(e) => setNewName?.(e.target.value)} />
                            </div>
                            {isChildAccount && (
                              <div className="form-group profile-account-section">
                                <label className="form-label">Gebruikersnaam</label>
                                <input
                                  className="form-input"
                                  value={newUsername}
                                  readOnly
                                  disabled
                                  aria-readonly="true"
                                  style={{ opacity: 0.72, cursor: 'not-allowed' }}
                                />
                                <div className="profile-account-helper">
                                  Deze loginnaam is ingesteld door je ouder en kan alleen in het ouderportaal worden gewijzigd.
                                </div>
                              </div>
                            )}
                            {isParent && (
                              <div className="form-group profile-account-section">
                                <label className="form-label">E-mailadres</label>
                                <input className="form-input profile-account-input-disabled" type="email" value={user.email} disabled />
                              </div>
                            )}
                            {!user.email?.endsWith('@pulse.internal') && (
                              <div className="profile-account-section">
                                <label className="form-label profile-account-password-label">Wachtwoord wijzigen</label>
                                <div className="form-group">
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      className="form-input"
                                      type={showNewPassword ? 'text' : 'password'}
                                      placeholder="Nieuw wachtwoord"
                                      aria-label="Nieuw wachtwoord"
                                      value={newPassword}
                                      onChange={(e) => setNewPassword?.(e.target.value)}
                                      style={{ paddingRight: '42px' }}
                                    />
                                    <button
                                      type="button"
                                      aria-label={showNewPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                                      onClick={() => setShowNewPassword?.((prev) => !prev)}
                                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}
                                    >
                                      {showNewPassword ? <EyeOff size={18} /> : <EyeOn size={18} />}
                                    </button>
                                  </div>
                                </div>
                                <div className="form-group">
                                  <input
                                    className="form-input"
                                    type={showNewPassword ? 'text' : 'password'}
                                    placeholder="Bevestig wachtwoord"
                                    aria-label="Bevestig wachtwoord"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword?.(e.target.value)}
                                  />
                                </div>
                                <button type="button" className="btn-secondary" style={{ width: '100%' }} disabled={passwordLoading || !newPassword} onClick={() => changePassword?.()}>
                                  {passwordLoading ? 'Bezig…' : 'Wachtwoord wijzigen'}
                                </button>
                                {passwordMsg && <div style={{ fontSize: '12px', marginTop: '6px', color: passwordMsg.startsWith('Fout') ? 'var(--danger)' : 'var(--success)' }}>{passwordMsg}</div>}
                              </div>
                            )}
                            <div className="profile-account-section profile-account-save">
                              {profileMsg && <div style={{ fontSize: '12px', marginBottom: '10px', color: profileMsg.startsWith('Fout') ? 'var(--danger)' : 'var(--success)' }}>{profileMsg}</div>}
                              <button type="button" className="btn-primary" style={{ width: '100%' }} disabled={profileLoading} onClick={() => saveProfile?.()}>
                                {profileLoading ? 'Opslaan…' : 'Opslaan →'}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="profile-danger-card">
                          <div className="profile-danger-title">Account verwijderen</div>
                          <p className="profile-danger-copy">
                            Als je je account verwijdert worden al je chats, berichten en gegevens permanent verwijderd.
                          </p>
                          <button
                            type="button"
                            className="btn-danger profile-danger-btn"
                            onClick={() => { closeProfileOverviewSheet(); handleDeleteAccount?.(); }}
                          >
                            <span className="profile-danger-btn-icon" aria-hidden="true"><Trash2 size={16} /></span>
                            <span className="profile-danger-btn-label">Account definitief verwijderen</span>
                            <span className="profile-danger-btn-spacer" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                    ) : profileTab === 'geschiedenis' && isParent ? (
                    <div className="profile-account-scroll">
                      <div className="profile-settings-subview">
                        <div className="profile-settings-section-card">
                          <div className="profile-settings-subhero">
                            <h4 className="profile-settings-subtitle">Privacy</h4>
                            <p className="profile-settings-subcopy">
                              Beheer per account hoe lang chatgeschiedenis, belgeschiedenis en videobelgeschiedenis worden bewaard. Zonder wijziging blijft de standaard op 30 dagen.
                            </p>
                          </div>

                          <div className="profile-settings-card-grid">
                            <div className="profile-settings-light-card">
                              <div className="profile-settings-light-card-title">Ouderaccount</div>
                              {historySettingRows.map((row) => (
                                <div key={`parent-${row.key}`} className="profile-settings-field-stack">
                                  <div className="profile-settings-field-label">{row.label}</div>
                                  <SidebarHistorySelect
                                    ariaLabel={`${row.label} ouderaccount`}
                                    value={historyRules?.[row.key] ?? 30}
                                    options={HISTORY_RETENTION_OPTIONS}
                                    onChange={(nextValue) => setHistoryRules?.((prev) => ({ ...normalizeHistoryRules(prev), [row.key]: Number(nextValue) }))}
                                    disabled={historySettingsLoading || historySettingsSavingTarget === 'parent'}
                                    style={historySelectStyle}
                                  />
                                </div>
                              ))}
                              <button type="button" className="btn-primary" onClick={() => saveHistorySettings?.()} disabled={historySettingsLoading || historySettingsSavingTarget === 'parent'}>
                                {historySettingsSavingTarget === 'parent' ? 'Opslaan…' : 'Opslaan'}
                              </button>
                            </div>

                            <div className="profile-settings-light-card">
                              <div className="profile-settings-light-card-title">Kindaccount</div>
                              <SidebarHistorySelect
                                ariaLabel="Kies kindaccount"
                                value={selectedHistoryChildUid}
                                options={
                                  historyChildren.length === 0
                                    ? [{ value: '', label: 'Geen kindaccounts' }]
                                    : historyChildren.map((child) => ({ value: child.uid, label: child.displayName }))
                                }
                                onChange={(nextValue) => setSelectedHistoryChildUid(String(nextValue))}
                                disabled={!historyChildren.length || historySettingsLoading}
                                style={historySelectStyle}
                              />
                              {historySettingRows.map((row) => (
                                <div key={`child-${row.key}`} className="profile-settings-field-stack">
                                  <div className="profile-settings-field-label">{row.label}</div>
                                  <SidebarHistorySelect
                                    ariaLabel={`${row.label} kindaccount`}
                                    value={primaryHistoryRules[row.key]}
                                    options={HISTORY_RETENTION_OPTIONS}
                                    onChange={(nextValue) => {
                                      if (!primaryHistoryChild) return;
                                      setChildHistoryRulesByUid?.((prev) => ({
                                        ...prev,
                                        [primaryHistoryChild.uid]: {
                                          ...normalizeHistoryRules(prev?.[primaryHistoryChild.uid]),
                                          [row.key]: Number(nextValue),
                                        },
                                      }));
                                    }}
                                    disabled={!primaryHistoryChild || !canManagePrimaryHistoryChild || historySettingsLoading || historySettingsSavingTarget === primaryHistoryChild?.uid}
                                    style={historySelectStyle}
                                  />
                                </div>
                              ))}
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => primaryHistoryChild && saveChildHistorySettings?.(primaryHistoryChild.uid)}
                                disabled={!primaryHistoryChild || !canManagePrimaryHistoryChild || historySettingsLoading || historySettingsSavingTarget === primaryHistoryChild?.uid}
                              >
                                {historySettingsSavingTarget === primaryHistoryChild?.uid ? 'Opslaan…' : 'Opslaan'}
                              </button>
                              {primaryHistoryChild && !canManagePrimaryHistoryChild && (
                                <div className="profile-settings-helper-copy">
                                  Alleen ouder A kan de bewaartermijn voor dit kindaccount aanpassen.
                                </div>
                              )}
                            </div>
                          </div>

                          {historySettingsMsg && (
                            <div className="profile-settings-inline-message" style={{ color: historySettingsMsg.startsWith('Fout:') ? 'var(--danger)' : 'var(--success)' }}>
                              {historySettingsMsg}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    ) : profileTab === 'geblokkeerd' ? (
                    (() => {
                      const selfBlocked = (blockedContacts || []).filter((c) => !parentBlockedUids?.includes(c.uid));
                      const parentBlocked = (blockedContacts || []).filter((c) => parentBlockedUids?.includes(c.uid));
                      return (
                        <div className="profile-account-scroll">
                          <div className="profile-settings-subview">
                            <div className="profile-settings-section-card">
                              <div className="profile-settings-subhero">
                                <h4 className="profile-settings-subtitle">Geblokkeerd</h4>
                                <p className="profile-settings-subcopy">
                                  Beheer welke contacten door jou of door een ouder zijn geblokkeerd.
                                </p>
                              </div>
                              {selfBlocked.length === 0 && parentBlocked.length === 0 && (
                                <div className="profile-settings-empty">
                                  Geen geblokkeerde contacten.
                                </div>
                              )}
                              {selfBlocked.length > 0 && (
                                <div className="profile-settings-light-card profile-settings-light-card--stacked">
                                  <div className="profile-settings-light-card-title">Door jou geblokkeerd</div>
                                  <div className="profile-settings-list-rows">
                                    {selfBlocked.map((c) => (
                                      <div key={c.uid} className="profile-settings-contact-row">
                                        <UserAvatar photoURL={c.photoURL} displayName={c.displayName || c.email} className="sm" decorative style={{ flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div className="blocked-contact-name-responsive profile-settings-contact-name">{c.displayName || c.email}</div>
                                          {c.email && <div className="profile-settings-contact-email">{c.email}</div>}
                                        </div>
                                        <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', flexShrink: 0, width: 'auto', marginTop: 0 }} onClick={() => onUnblockContact?.(c.uid)}>Deblokkeren</button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {parentBlocked.length > 0 && (
                                <div className="profile-settings-light-card profile-settings-light-card--stacked">
                                  <div className="profile-settings-light-card-title">Geblokkeerd door ouder</div>
                                  <div className="profile-settings-list-rows">
                                    {parentBlocked.map((c) => (
                                      <div key={c.uid} className="profile-settings-contact-row profile-settings-contact-row--danger">
                                        <UserAvatar photoURL={c.photoURL} displayName={c.displayName || c.email} className="sm" decorative style={{ flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div className="blocked-contact-name-responsive profile-settings-contact-name">{c.displayName || c.email}</div>
                                          {c.email && <div className="profile-settings-contact-email">{c.email}</div>}
                                          <div className="profile-settings-contact-note">Geblokkeerd door ouder</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                    ) : profileTab === 'styling' ? (
                    <div className="profile-account-scroll">
                      <div className="profile-settings-subview">
                        <div className="profile-settings-section-card">
                          <div className="profile-settings-subhero">
                            <h4 className="profile-settings-subtitle">Styling</h4>
                            <p className="profile-settings-subcopy">
                              Kies een achtergrond die past bij jouw chats.
                            </p>
                          </div>
                          <div className="profile-settings-light-card profile-settings-light-card--stacked">
                            <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>Chat achtergrond</label>
                            <div className="profile-styling-tabs">
                              {[
                                ['foto', <ImageIcon size={14} />, 'Foto'],
                                ['kleur', <ColorCircle size={14} />, 'Kleur'],
                                ['standaard', <LayoutTemplate size={14} />, 'Standaard'],
                              ].map(([id, icon, label]) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => {
                                    setChatBgTab?.(id);
                                    if (id === 'kleur' && !pendingColor && chatBg?.type !== 'color') setPendingColor('#000000');
                                  }}
                                  className="profile-styling-tab"
                                  style={{
                                    flex: 1,
                                    padding: '7px 4px',
                                    border: 'none',
                                    borderRadius: '14px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all .15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    background: chatBgTab === id ? 'linear-gradient(135deg,#7c6fff,#a855f7)' : 'transparent',
                                    color: chatBgTab === id ? '#fff' : '#6f6788',
                                  }}
                                >
                                  {icon}{label}
                                </button>
                              ))}
                            </div>
                            <div
                              className="profile-styling-preview"
                              style={{
                                borderRadius: '18px',
                                overflow: 'hidden',
                                marginBottom: '14px',
                                height: '110px',
                                position: 'relative',
                                background: chatBgTab === 'kleur'
                                  ? (pendingColor || (chatBg?.type === 'color' ? chatBg.value : '#000000'))
                                  : chatBgTab === 'foto'
                                    ? (pendingPhoto ? `url(${pendingPhoto.url}) center/cover` : chatBg?.type === 'photo' ? `url(${chatBg.url}) center/cover` : 'var(--bg)')
                                    : (chatBg?.type === 'photo' ? `url(${chatBg.url}) center/cover` : chatBg?.type === 'color' ? chatBg.value : `#eeeaf8 url(${chatDefaultPattern}) center top / 180px auto repeat`),
                                border: '1px solid rgba(140, 122, 214, 0.12)',
                              }}
                            >
                              {chatBgTab === 'foto' && (pendingPhoto || chatBg?.type === 'photo') && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.15)' }} />}
                              {chatBgTab === 'foto' && (pendingPhoto || chatBg?.type === 'photo') && (
                                <button
                                  type="button"
                                  disabled={chatBgLoading}
                                  onClick={() => {
                                    if (pendingPhoto?.url) URL.revokeObjectURL(pendingPhoto.url);
                                    if (pendingPhoto) setPendingPhoto(null);
                                    else removeChatBg?.();
                                  }}
                                  style={{ position: 'absolute', top: '8px', right: '8px', width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', zIndex: 1 }}
                                  title="Achtergrond verwijderen"
                                >
                                  ×
                                </button>
                              )}
                              <div style={{ position: 'absolute', bottom: '8px', left: '10px' }}>
                                <div style={{ background: '#f7f2ff', border: '1px solid #e6dcfb', borderRadius: '12px 12px 12px 3px', padding: '6px 12px', fontSize: '12px', color: '#3f3560' }}>Hallo! 👋</div>
                              </div>
                              <div style={{ position: 'absolute', bottom: '8px', right: '10px' }}>
                                <div style={{ background: 'linear-gradient(135deg,#8c7bff 0%, #7160f5 100%)', borderRadius: '12px 12px 3px 12px', padding: '6px 12px', fontSize: '12px', color: '#fff' }}>Hey!</div>
                              </div>
                            </div>
                            {chatBgTab === 'foto' && (
                              <div>
                                {!pendingPhoto && chatBg?.type === 'photo' && <div style={{ fontSize: '12px', color: 'var(--success)', marginBottom: '8px' }}>✓ Foto achtergrond actief</div>}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button type="button" className="btn-secondary" style={{ flex: 1 }} disabled={chatBgLoading} onClick={() => bgInputRef?.current?.click()}>
                                    {chatBg?.type === 'photo' || pendingPhoto ? 'Andere foto kiezen' : 'Foto kiezen'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    style={{ flex: 1 }}
                                    disabled={chatBgLoading || !pendingPhoto}
                                    onClick={() => {
                                      uploadChatBgPhoto?.(pendingPhoto.file);
                                      if (pendingPhoto?.url) URL.revokeObjectURL(pendingPhoto.url);
                                      setPendingPhoto(null);
                                    }}
                                  >
                                    {chatBgLoading ? 'Uploaden…' : 'Opslaan'}
                                  </button>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px', textAlign: 'center' }}>JPG, PNG of WEBP · max 5 MB</div>
                                <input
                                  ref={bgInputRef}
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp"
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    const f = e.target.files[0];
                                    e.target.value = '';
                                    if (pendingPhoto?.url) URL.revokeObjectURL(pendingPhoto.url);
                                    if (f) setPendingPhoto({ file: f, url: URL.createObjectURL(f) });
                                  }}
                                />
                              </div>
                            )}
                            {chatBgTab === 'kleur' && (
                              <div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '12px' }}>
                                  {['#1e0a3c', '#051236', '#0a1f0e', '#1f0a10', '#0f1923', '#1a1206', '#000000', '#1c1a18'].map((color) => {
                                    const isActive = (pendingColor ?? (chatBg?.type === 'color' ? chatBg.value : null)) === color;
                                    return (
                                      <button
                                        key={color}
                                        type="button"
                                        disabled={chatBgLoading}
                                        onClick={() => setPendingColor(color)}
                                        style={{
                                          width: '36px',
                                          height: '36px',
                                          borderRadius: '50%',
                                          background: color,
                                          border: isActive ? '3px solid var(--accent)' : '2px solid var(--border)',
                                          cursor: 'pointer',
                                          position: 'relative',
                                          transition: 'all .15s',
                                          boxShadow: isActive ? '0 0 0 2px var(--bg),0 0 0 4px var(--accent)' : 'none',
                                        }}
                                      >
                                        {isActive && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px' }}>✓</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{ width: '100%' }}
                                  disabled={chatBgLoading || !pendingColor}
                                  onClick={() => {
                                    saveChatBgColor?.(pendingColor);
                                    setPendingColor(null);
                                  }}
                                >
                                  {chatBgLoading ? 'Opslaan…' : 'Opslaan'}
                                </button>
                              </div>
                            )}
                            {chatBgTab === 'standaard' && (
                              chatBg
                                ? <button type="button" className="btn-secondary" style={{ width: '100%' }} disabled={chatBgLoading} onClick={() => removeChatBg?.()}>
                                    {chatBgLoading ? 'Bezig…' : 'Standaard achtergrond herstellen'}
                                  </button>
                                : <div className="profile-settings-helper-copy">Je gebruikt al de standaard Pulse-achtergrond.</div>
                            )}
                            {chatBgMsg && chatBgMsg.startsWith('Fout') && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--danger)' }}>{chatBgMsg}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                    ) : null}
                  </div>
                </div>
              ) : footerClusterMode === 'new-chat' ? (
                <div className="sidebar-settings-sheet-scroll">
                  <div className="new-chat-sheet-body">
                    <p id="new-chat-description" className="new-chat-sheet-sub">
                      Zoek op e-mailadres, <code>@pulse.internal</code>-adres of gebruikersnaam
                    </p>

                    <div className="new-chat-sheet-search">
                      <div className="starred-search-wrap call-log-search-wrap new-chat-search-wrap">
                        <input
                          className="starred-search-input"
                          placeholder="naam@voorbeeld.nl, kind@pulse.internal of gebruikersnaam"
                          value={searchEmail}
                          onChange={(e) => setSearchEmail?.(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && searchUser?.()}
                        />
                      </div>
                    </div>

                    {searchErr && <div className="auth-error" style={{ marginBottom: 14 }}>⚠️ {searchErr}</div>}

                    {searchResult && (
                      <div className="new-chat-sheet-section">
                        <div className="new-chat-sheet-kicker">Zoekresultaat</div>
                        <div className="pulse-sheet-list pulse-sheet-list--new-chat">
                          <button type="button" className="search-result new-chat-sheet-result" onClick={() => startConversationWith?.(searchResult)}>
                            <UserAvatar photoURL={searchResult.photoURL} displayName={searchResult.displayName} className="sm" decorative />
                            <div>
                              <div className="conv-name">{searchResult.displayName}</div>
                              <div className="conv-preview">{searchResult.email}</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {contacts.length > 0 && (
                      <div className="new-chat-sheet-section new-chat-sheet-section--contacts">
                        <div className="new-chat-sheet-kicker">Kies uit je contacten</div>
                        <div className="pulse-sheet-list pulse-sheet-list--new-chat new-chat-contact-list">
                          {filteredNewChatContacts.map((contact) => (
                            <button key={contact.uid} type="button" className="search-result new-chat-sheet-result" onClick={() => startConversationWith?.(contact)}>
                              <UserAvatar photoURL={contact.photoURL} displayName={contact.displayName} className="sm" decorative />
                              <div>
                                <div className="conv-name">{getContactDisplayName(contact)}</div>
                                <div className="conv-preview">{contact.email}</div>
                              </div>
                            </button>
                          ))}
                          {filteredNewChatContacts.length === 0 && (
                            <div className="new-chat-sheet-empty">
                              Geen contacten die overeenkomen met je zoekopdracht.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : footerClusterMode === 'parent-portal' ? (
                <div className="sidebar-parent-portal-scroll">
                  <ParentDashboard
                    user={user}
                    parentActivityBadge={parentActivityBadge}
                    onActivitiesViewed={onParentActivitiesViewed}
                    onClose={dismissParentPortalSheet}
                    embeddedInSidebarCluster
                    embeddedPortalView={parentPortalView}
                    onEmbeddedPortalViewChange={setParentPortalView}
                  />
                </div>
              ) : (
                renderSimpleSidebarActionList([
                  {
                    key: 'new-chat',
                    icon: <Message size={18} aria-hidden="true" />,
                    label: 'Nieuwe chat',
                    onClick: () => { closeProfileOverviewSheet(); closeAddContactSheet(); closeCallSheet(); closeNewGroupSheet(); closeMoreActionsSheet(); setShowNewChat?.(true); },
                  },
                  {
                    key: 'new-contact',
                    icon: <Plus size={18} aria-hidden="true" />,
                    label: 'Nieuw contact',
                    onClick: () => { closeProfileOverviewSheet(); closeNewChatSheet(); closeCallSheet(); closeNewGroupSheet(); closeMoreActionsSheet(); setActiveTab('contacts'); setShowAddContact?.(true); },
                  },
                  {
                    key: 'new-group',
                    icon: <Users size={18} aria-hidden="true" />,
                    label: 'Nieuwe groep',
                    onClick: () => { closeProfileOverviewSheet(); closeAddContactSheet(); closeNewChatSheet(); closeCallSheet(); closeMoreActionsSheet(); setShowNewGroup?.(true); },
                  },
                  {
                    key: 'requests',
                    icon: <Handshake size={18} aria-hidden="true" />,
                    label: 'Verzoeken',
                    onClick: () => { closeProfileOverviewSheet(); closeAddContactSheet(); closeNewChatSheet(); closeNewGroupSheet(); closeCallSheet(); closeMoreActionsSheet(); setActiveTab('contacts'); setShowFriendRequestsPanel?.(true); },
                    trailing: (friendRequests.length + sentFriendRequests.length) > 0
                      ? <span className="unread-badge" style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px' }}>{friendRequests.length + sentFriendRequests.length}</span>
                      : null,
                  },
                  ...(!selectionMode ? [{
                    key: 'selection',
                    icon: <Message size={18} aria-hidden="true" />,
                    label: 'Chats selecteren',
                    onClick: () => { closeMoreActionsSheet(); setActiveTab('chats'); onEnterConversationSelection?.(); },
                  }] : []),
                  {
                    key: 'dnd',
                    icon: dnd ? <Bell size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />,
                    label: `Meldingen ${dnd ? 'aan' : 'uit'}`,
                    danger: !dnd,
                    onClick: () => { onToggleDnd(); },
                    active: dnd,
                  },
                ])
              )}
            </div>

            {footerEmbeddedInCluster && (
              <div className="sidebar-footer sidebar-footer--cluster" ref={sidebarFooterRef}>
                {footerTabbar}
              </div>
            )}
          </div>
        </div>
      ) : null}
      {footerEmbeddedInCluster ? null : contextPanelVisible && typeof document !== 'undefined'
        ? createPortal(
          <div className={`sidebar-footer sidebar-footer--context-panel-floating${contactProfileVisible ? ' sidebar-footer--contact-profile-floating' : ''}`} ref={sidebarFooterRef}>
            {footerTabbar}
          </div>,
          document.body,
        )
        : (
          <div className={`sidebar-footer${isLightFooterCluster ? ' sidebar-footer--more-open' : ''}`} ref={sidebarFooterRef}>
            {footerTabbar}
          </div>
        )}
    </aside>
  );
}
