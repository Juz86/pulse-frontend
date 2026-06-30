// src/components/ChatSidebar.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Phone, Video, Search, Message, Users, Bell, BellOff, Shield, Logout, Pin, MoreHoriz, Plus, XIcon, Trash2, StarOutline, Handshake, User, Clock, Palette, ArrowRight, Cancel, PhoneCall, PhoneOutgoing } from '../components/Icons';
import PulseLogo from '../components/PulseLogo';
import UserAvatar from '../components/UserAvatar';
import ConversationList from './ConversationList';
import { formatTime } from '../utils';

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
  showCallModal = false,
  setShowCallModal,
  onShowAddContact,
  onOpenProfile,
  showProfile = false,
  setShowProfile,
  profileTab = 'overview',
  setProfileTab,
  onProfileHistoryOpen,
  onRequestSettingsLogout,
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
  const [callSheetClosing, setCallSheetClosing] = useState(false);
  const [profileSheetClosing, setProfileSheetClosing] = useState(false);
  const [callSearch, setCallSearch] = useState('');
  const [callActionMode, setCallActionMode] = useState(null);
  const moreActionsMenuRef = useRef(null);
  const moreActionsCloseTimeoutRef = useRef(null);
  const callSheetCloseTimeoutRef = useRef(null);
  const profileSheetCloseTimeoutRef = useRef(null);
  const convSheetHistoryPushedRef = useRef(false);
  const moreActionsSheetHistoryPushedRef = useRef(false);
  const contactSheetHistoryPushedRef = useRef(false);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const moreActionsSheetVisible = moreActionsMenuOpen || moreActionsMenuClosing;
  const callSheetVisible = showCallModal || callSheetClosing;
  const settingsSheetVisible = (showProfile && profileTab === 'overview') || profileSheetClosing;
  const footerClusterMode = settingsSheetVisible ? 'settings' : (callSheetVisible ? 'calls' : (moreActionsSheetVisible ? 'more' : null));
  const profileSections = useMemo(() => ([
    { id: 'account', icon: <User size={18} aria-hidden="true" />, label: 'Mijn account', description: 'Naam, foto en wachtwoord' },
    ...(isParent ? [{ id: 'geschiedenis', icon: <Clock size={18} aria-hidden="true" />, label: 'Geschiedenis', description: 'Bewaartermijnen beheren' }] : []),
    { id: 'styling', icon: <Palette size={18} aria-hidden="true" />, label: 'Styling', description: 'Chatachtergrond en sfeer' },
    { id: 'geblokkeerd', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>, label: 'Geblokkeerd', description: 'Beheer geblokkeerde contacten' },
  ]), [isParent]);

  const filteredContacts = useMemo(() => contacts.filter((contact) => (
    !normalizedSearch
      || contact.displayName?.toLowerCase().includes(normalizedSearch)
      || contact.email?.toLowerCase().includes(normalizedSearch)
  )), [contacts, normalizedSearch]);

  useEffect(() => {
    if (!moreActionsSheetVisible && !settingsSheetVisible && !callSheetVisible) return;
    function handleClickOutside(e) {
      if (e.target?.closest?.('[data-sidebar-actions-menu]')) return;
      if (moreActionsMenuRef.current && !moreActionsMenuRef.current.contains(e.target)) {
        if (settingsSheetVisible) {
          setProfileSheetClosing(true);
          return;
        }
        if (callSheetVisible) {
          setCallSheetClosing(true);
          return;
        }
        setMoreActionsMenuClosing(true);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [callSheetVisible, moreActionsSheetVisible, settingsSheetVisible]);

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
    if (callSheetCloseTimeoutRef.current) {
      window.clearTimeout(callSheetCloseTimeoutRef.current);
    }
    if (profileSheetCloseTimeoutRef.current) {
      window.clearTimeout(profileSheetCloseTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!showProfile || profileTab !== 'overview') {
      setProfileSheetClosing(false);
      return;
    }
    setMoreActionsMenuOpen(false);
    setMoreActionsMenuClosing(false);
    setCallSheetClosing(false);
    setShowCallModal?.(false);
  }, [profileTab, setShowCallModal, showProfile]);

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
  const closeContactActionsSheet = useCallback(() => {
    if (contactSheetHistoryPushedRef.current) {
      contactSheetHistoryPushedRef.current = false;
      window.history.back();
      return;
    }
    setContactMenu(null);
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

  const footerTabbar = (
    <div className={`sidebar-footer-tabbar${footerClusterMode ? ' sidebar-footer-tabbar--cluster' : ''}`} ref={sidebarFooterTabbarRef} role="navigation" aria-label="Sidebar navigatie">
      <button
        type="button"
        className="sidebar-footer-tab sidebar-footer-tab-profile"
        aria-label={`Open profielinstellingen voor ${user.displayName || user.email?.split('@')[0] || 'gebruiker'}, online`}
        onClick={() => {
          if (settingsSheetVisible) {
            dismissProfileOverviewSheet();
            return;
          }
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
        className={`sidebar-footer-tab ${activeTab === 'chats' ? 'active' : ''}`}
        aria-label="Chats"
        onClick={() => {
          closeMoreActionsSheet();
          closeCallSheet();
          closeProfileOverviewSheet();
          setActiveTab('chats');
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
          aria-expanded={callSheetVisible}
          onClick={() => {
            if (callSheetVisible) {
              dismissCallSheet();
              return;
            }
            closeProfileOverviewSheet();
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
          aria-expanded={moreActionsSheetVisible}
          onClick={() => {
            if (moreActionsSheetVisible) {
              dismissMoreActionsSheet();
              return;
            }
            closeProfileOverviewSheet();
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

  const callLog = typeof getCallLog === 'function' ? getCallLog() : [];
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

  return (
    <aside className={`sidebar${moreActionsMenuOpen ? ' sidebar--more-actions-open' : ''}`} ref={sidebarRef} onClick={() => { setConvMenu(null); setContactMenu(null); }}>
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

      {footerClusterMode ? (
        <div
          className={`sidebar-bottom-cluster-backdrop${footerClusterMode === 'more' && moreActionsMenuClosing ? ' is-closing' : ''}${footerClusterMode === 'settings' && profileSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'calls' && callSheetClosing ? ' is-closing' : ''}`}
          onClick={footerClusterMode === 'settings' ? dismissProfileOverviewSheet : (footerClusterMode === 'calls' ? dismissCallSheet : dismissMoreActionsSheet)}
        >
          <div
            className={`sidebar-bottom-cluster${footerClusterMode === 'more' && moreActionsMenuClosing ? ' is-closing' : ''}${footerClusterMode === 'settings' && profileSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'calls' && callSheetClosing ? ' is-closing' : ''}`}
            data-sidebar-actions-menu
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`pulse-sheet pulse-sheet--sidebar-actions sidebar-bottom-cluster-sheet${footerClusterMode ? ` sidebar-bottom-cluster-sheet--${footerClusterMode}` : ''}${footerClusterMode === 'more' && moreActionsMenuClosing ? ' is-closing' : ''}${footerClusterMode === 'settings' && profileSheetClosing ? ' is-closing' : ''}${footerClusterMode === 'calls' && callSheetClosing ? ' is-closing' : ''}`}
              role="menu"
              aria-label={footerClusterMode === 'settings' ? 'Instellingen' : (footerClusterMode === 'calls' ? 'Oproepen' : 'Meer acties')}
            >
              <div className="pulse-sheet-handle" aria-hidden="true" />
              <div className="pulse-sheet-header pulse-sheet-header--sidebar-actions">
                <div className="pulse-sheet-title pulse-sheet-title--sidebar-actions">
                  {footerClusterMode === 'settings' ? 'Instellingen' : (footerClusterMode === 'calls' ? 'Recent' : 'Meer opties')}
                </div>
                <button
                  type="button"
                  className="pulse-sheet-close pulse-sheet-close--sidebar-actions"
                  aria-label="Sluiten"
                  onClick={footerClusterMode === 'settings' ? dismissProfileOverviewSheet : (footerClusterMode === 'calls' ? dismissCallSheet : dismissMoreActionsSheet)}
                >
                  <XIcon size={20} aria-hidden="true" />
                </button>
              </div>
              {footerClusterMode === 'settings' ? (
                <div className="sidebar-settings-sheet-scroll">
                  <div className="pulse-sheet-list pulse-sheet-list--sidebar-actions">
                    {profileSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        role="menuitem"
                        className="chat-header-menu-item"
                        onClick={() => {
                          closeProfileOverviewSheet();
                          setProfileTab?.(section.id);
                          if (section.id === 'geschiedenis') onProfileHistoryOpen?.();
                        }}
                      >
                        <span className="sidebar-settings-menu-icon" aria-hidden="true">{section.icon}</span>
                        <span className="sidebar-settings-menu-copy">
                          <span className="sidebar-settings-menu-title">{section.label}</span>
                          <span className="sidebar-settings-menu-description">{section.description}</span>
                        </span>
                        <ArrowRight size={18} className="sidebar-settings-menu-arrow" aria-hidden="true" />
                      </button>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      className="chat-header-menu-item"
                      onClick={() => {
                        closeProfileOverviewSheet();
                        onRequestSettingsLogout?.();
                      }}
                    >
                      <span className="sidebar-settings-menu-icon" aria-hidden="true"><Logout size={18} /></span>
                      <span className="sidebar-settings-menu-copy">
                        <span className="sidebar-settings-menu-title sidebar-settings-menu-title--danger">Uitloggen</span>
                        <span className="sidebar-settings-menu-description">Afmelden van dit account</span>
                      </span>
                      <ArrowRight size={18} className="sidebar-settings-menu-arrow" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : footerClusterMode === 'calls' ? (
                <div className="sidebar-settings-sheet-scroll">
                  <div className="call-log-sheet-body">
                    {!callsAvailable ? (
                      <div className="call-panel-empty">
                        <div style={{ fontSize: 14 }}>Bellen en videobellen zijn hier niet beschikbaar.</div>
                      </div>
                    ) : (
                      <>
                        <div className="call-log-toolbar">
                          <div className="starred-search-wrap call-log-search-wrap call-log-search-wrap--full">
                            <Search size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
                            <input
                              className="starred-search-input"
                              placeholder="Zoek recente oproepen of contact…"
                              value={callSearch}
                              onChange={(e) => setCallSearch(e.target.value)}
                            />
                            {callSearch && (
                              <button type="button" className="starred-search-clear" aria-label="Zoekopdracht wissen" onClick={() => setCallSearch('')}>
                                <Cancel size={14} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                        {remainingRateLimitSeconds > 0 && (
                          <div
                            role="status"
                            aria-live="polite"
                            style={{
                              marginBottom: 12,
                              fontSize: 12,
                              color: '#fde68a',
                              background: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.34)',
                              borderRadius: 10,
                              padding: '8px 10px',
                            }}
                          >
                            Te veel verzoeken. Vernieuwen over {remainingRateLimitSeconds}s.
                          </div>
                        )}
                        {callActionMode && (
                          <div className="call-log-picker">
                            <div className="new-chat-sheet-kicker">Kies een contactpersoon</div>
                            <div className="call-log-picker-title">
                              Start direct een bel- of video-oproep vanuit je contacten.
                            </div>
                            <div className="pulse-sheet-list pulse-sheet-list--new-chat call-log-picker-list">
                              {filteredCallContacts.length === 0 ? (
                                <div className="empty-convs" style={{ paddingTop: 6, paddingBottom: 6 }}>
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
                                    <div key={contact.uid} className="call-log-picker-row">
                                      <UserAvatar photoURL={contact.photoURL} displayName={contactTitle} className="sm" decorative />
                                      <div className="conv-info call-log-picker-copy">
                                        <div className="conv-name call-contact-name-responsive">{contactTitle}</div>
                                        <div className="conv-preview call-contact-email-responsive">{contact.email || 'Geen e-mailadres'}</div>
                                      </div>
                                      <div className="call-log-picker-actions">
                                        <button
                                          type="button"
                                          className="call-btn voice"
                                          aria-label={`Bel ${contactTitle}`}
                                          title="Bellen"
                                          onClick={() => (callContactFromRecent || callContact)?.(contact, false)}
                                        >
                                          <Phone size={14} aria-hidden="true" />
                                        </button>
                                        <button
                                          type="button"
                                          className="call-btn video"
                                          aria-label={`Videobel ${contactTitle}`}
                                          title="Videobellen"
                                          onClick={() => (callContactFromRecent || callContact)?.(contact, true)}
                                        >
                                          <Video size={14} aria-hidden="true" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                        {!callActionMode && (
                          filteredCallLog.length === 0 ? (
                            <div className="call-panel-empty">
                              <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true"><Cancel size={40} /></div>
                              <div>{callSearch ? 'Geen oproepen gevonden' : 'Nog geen oproepen'}</div>
                            </div>
                          ) : (
                            <div className="call-log-list">
                              {filteredCallLog.map((entry, index) => {
                                const contact = contacts.find((item) => item.uid === entry.uid);
                                const dirIcon = entry.direction === 'outgoing'
                                  ? <PhoneOutgoing size={13} />
                                  : entry.direction === 'missed'
                                    ? <Cancel size={13} />
                                    : <PhoneCall size={13} />;
                                const displayTime = formatTime(entry.ts);
                                return (
                                  <div key={`${entry.uid || entry.name}-${entry.ts || index}`} className="call-log-row">
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
                                        <span className="call-log-direction-icon" aria-hidden="true">{dirIcon}</span>
                                        <span>{entry.direction === 'missed' ? 'Gemist' : entry.direction === 'outgoing' ? 'Uitgaand' : 'Inkomend'}</span>
                                        <span className="call-log-type-separator" aria-hidden="true">·</span>
                                        <span>{entry.isVideo ? 'Video' : 'Audio'}</span>
                                      </div>
                                    </div>
                                    {contact && (
                                      <div className="call-log-actions">
                                        {entry.isVideo ? (
                                          <button type="button" className="call-btn video" aria-label={`Videobel ${entry.name}`} onClick={() => (callContactFromRecent || callContact)?.(contact, true)} title="Videobellen"><Video size={16} aria-hidden="true" /></button>
                                        ) : (
                                          <button type="button" className="call-btn voice" aria-label={`Bel ${entry.name}`} onClick={() => (callContactFromRecent || callContact)?.(contact, false)} title="Bellen"><Phone size={16} aria-hidden="true" /></button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="sidebar-settings-sheet-scroll">
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
              )}
            </div>

            <div className="sidebar-footer sidebar-footer--cluster" ref={sidebarFooterRef}>
              {footerTabbar}
            </div>
          </div>
        </div>
      ) : (
        <div className="sidebar-footer" ref={sidebarFooterRef}>
          {footerTabbar}
        </div>
      )}
    </aside>
  );
}
