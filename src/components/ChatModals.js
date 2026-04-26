// src/components/ChatModals.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Phone, Video, Camera, Delete, Search, Users, Check, Cancel, MagicEdit, PhoneCall, PhoneOutgoing, Share, User, Palette, ImageIcon, ColorCircle, LayoutTemplate, EyeOn, EyeOff, Heart, AdminIcon, StarFilled, Clock, ArrowLeft, ArrowRight, Handshake, Logout } from '../components/Icons';
import { getInitials, formatTime, clearPulseUserStorage } from '../utils';
import CallOverlay from '../components/CallOverlay';
import AvatarBuilder from '../components/AvatarBuilder';
import UserAvatar from '../components/UserAvatar';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';
import chatDefaultPattern from '../assets/chatachtergrond.jpeg';
import {
  PULSE_WEB_CALLS_UNAVAILABLE_HINT,
  PULSE_WEB_CALLS_UNAVAILABLE_MESSAGE,
  PULSE_WEB_CALLS_UNAVAILABLE_TITLE,
} from '../lib/platform/runtime';
import { HISTORY_RETENTION_OPTIONS, normalizeHistoryRules } from '../utils';

function HistorySelect({ ariaLabel, value, options, onChange, disabled = false, style }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedOption = options.find((option) => String(option.value) === String(value)) || options[0];

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
        style={{ ...style, textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span>{selectedOption?.label || ''}</span>
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
            borderRadius: 16,
            border: '1px solid rgba(165, 150, 255, 0.18)',
            background: 'linear-gradient(180deg, rgba(56, 49, 103, 0.98) 0%, rgba(43, 38, 86, 0.99) 100%)',
            boxShadow: '0 18px 36px rgba(7, 5, 20, 0.42), inset 0 1px 0 rgba(255,255,255,0.04)',
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
                  borderRadius: 12,
                  border: isSelected ? '1px solid rgba(173, 141, 255, 0.5)' : '1px solid rgba(255,255,255,0.04)',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(123, 94, 255, 0.34) 0%, rgba(183, 92, 255, 0.3) 100%)'
                    : 'rgba(255,255,255,0.02)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontWeight: isSelected ? 700 : 600,
                  padding: '0 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
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

function getFriendRequestId(request) {
  return request?.id || request?.requestId || null;
}

export default function ChatModals({
  // contact rename
  renamingContact, setRenamingContact,
  renameValue, setRenameValue,
  saveContactNickname, setContacts,

  // share contact
  sharingContact, setSharingContact,
  shareRecipients, setShareRecipients,
  contacts, sendContactCard,
  getContactDisplayName,

  // shared contact profile
  viewingSharedContact, setViewingSharedContact,
  onlineUsers, inactiveUsers,
  friendReqLoading, friendReqSent,
  sendFriendRequestToEmail,

  // contact profile
  viewingContact, setViewingContact,
  findConvWithUid, setConvLabel, convLabels,
  getContactNickname,

  // confirm dialog
  confirmDialog, setConfirmDialog,

  // add contact
  showAddContact, setShowAddContact,
  contactEmail, setContactEmail,
  contactNickname, setContactNickname,
  contactRelation, setContactRelation,
  contactErr, friendRequestActionErr, contactLoading,
  addContact,
  clearPendingFriendRequestState,
  friendRequests,
  sentFriendRequests,
  showFriendRequestsPanel, setShowFriendRequestsPanel,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemindFriendRequest,
  onCancelFriendRequest,

  // new chat
  showNewChat, setShowNewChat,
  searchEmail, setSearchEmail,
  searchErr, searchResult,
  searchUser, startConversationWith,

  // new group
  showNewGroup, setShowNewGroup,
  groupName, setGroupName,
  groupMembers, toggleGroupMember, createGroup,

  // profile modal
  showProfile, setShowProfile,
  profileTab, setProfileTab,
  photoPreview, setPhotoPreview,
  newName, setNewName,
  newUsername, setNewUsername,
  isParent, user,
  showNewPassword, setShowNewPassword,
  newPassword, setNewPassword,
  confirmPassword, setConfirmPassword,
  passwordLoading, passwordMsg,
  profileMsg, profileLoading,
  usernameLoading: _usernameLoading, usernameMsg: _usernameMsg,
  historyRules, setHistoryRules,
  childHistoryRulesByUid, setChildHistoryRulesByUid,
  historyChildren,
  historySettingsLoading,
  historySettingsSavingTarget,
  historySettingsMsg,
  chatBgTab, setChatBgTab,
  chatBgMsg, chatBg, chatBgLoading,
  saveProfile, saveUsername: _saveUsername, changePassword,
  loadHistorySettings, saveHistorySettings, saveChildHistorySettings,
  uploadChatBgPhoto, saveChatBgColor, removeChatBg,
  handlePhotoChange, handleDeleteAccount,
  photoInputRef, bgInputRef,
  avatarOptions, setAvatarOptions,
  showAvatarBuilder, setShowAvatarBuilder,
  profileMsg: _pm, setProfileMsg,

  // contact profile modal (from chat header)
  showContactProfile, setShowContactProfile,
  activeConv, getConvName, getOtherUid, getConvPhoto,
  setSharingContact: _sc,
  showStarredMsgs, setShowStarredMsgs,
  starredMsgs, messages, onJumpToMsg,

  // call modal
  showCallModal, setShowCallModal,
  callContact, callContactFromRecent, getCallLog, refreshCallLog, clearCallLog,

  // group info
  showGroupInfo, setShowGroupInfo,
  addingMember, setAddingMember,
  groupPhotoLoading, uploadGroupPhoto,
  removeMemberFromGroup, addMemberToGroup,

  // call overlay
  activeCall, setActiveCall,

  // forward
  forwardMsg, setForwardMsg,
  conversations, forwardToConv,

  // toasts
  errToast, mentionToast, parentToast,
  onOpenMentionConversation,

  // blocked contacts
  blockedContacts, parentBlockedUids, unblockContact,

  // helpers
  callsAvailable = true,
}) {
  const [starredSearch,   setStarredSearch]   = useState('');
  const [profileClosing,  setProfileClosing]  = useState(false);
  const [pendingColor,    setPendingColor]    = useState(null);
  const [pendingPhoto,    setPendingPhoto]    = useState(null);   // { file, url }
  const [requestsTab,     setRequestsTab]     = useState('ontvangen');
  const [selectedHistoryChildUid, setSelectedHistoryChildUid] = useState('');
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [callSearch, setCallSearch] = useState('');
  const [callActionMode, setCallActionMode] = useState(null); // 'voice' | null
  const isChildAccount = !!user?.email?.endsWith('@pulse.internal');
  const profileSections = useMemo(() => ([
    { id: 'account', icon: <User size={18} />, label: 'Mijn account', description: 'Naam, foto en wachtwoord' },
    ...(isParent ? [{ id: 'geschiedenis', icon: <Clock size={18} />, label: 'Geschiedenis', description: 'Bewaartermijnen beheren' }] : []),
    { id: 'styling', icon: <Palette size={18} />, label: 'Styling', description: 'Chatachtergrond en sfeer' },
    { id: 'geblokkeerd', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>, label: 'Geblokkeerd', description: 'Beheer geblokkeerde contacten' },
  ]), [isParent]);
  const activeProfileSection = profileSections.find((section) => section.id === profileTab) || null;
  const primaryHistoryChild = historyChildren.find((child) => child.uid === selectedHistoryChildUid) || historyChildren[0] || null;
  const primaryHistoryRules = normalizeHistoryRules(primaryHistoryChild ? childHistoryRulesByUid?.[primaryHistoryChild.uid] : {});
  const canManagePrimaryHistoryChild = !!primaryHistoryChild?.canManageHistory;
  const historySettingRows = [
    { key: 'chatRetentionDays', label: 'Chatgeschiedenis' },
    { key: 'callRetentionDays', label: 'Belgeschiedenis' },
    { key: 'videoRetentionDays', label: 'Videobelgeschiedenis' },
  ];
  const historySelectStyle = {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    border: '1px solid rgba(165, 150, 255, 0.18)',
    background: 'linear-gradient(180deg, rgba(66, 59, 118, 0.92) 0%, rgba(53, 47, 98, 0.98) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(13, 10, 34, 0.18)',
    color: 'var(--text)',
    padding: '0 44px 0 14px',
    fontSize: '14px',
    fontWeight: 600,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23f5f1ff' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    backgroundSize: '14px',
    display: 'flex',
    alignItems: 'center',
  };
  const profilePanelSaveButtonStyle = {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    padding: '0 12px',
    marginTop: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  useEffect(() => {
    if (!historyChildren.length) {
      setSelectedHistoryChildUid('');
      return;
    }
    if (historyChildren.some((child) => child.uid === selectedHistoryChildUid)) return;
    setSelectedHistoryChildUid(historyChildren[0].uid);
  }, [historyChildren, selectedHistoryChildUid]);

  useEffect(() => {
    if (showProfile) return;
    setProfileTab('overview');
  }, [setProfileTab, showProfile]);

  useEffect(() => {
    if (!addingMember) setGroupMemberSearch('');
  }, [addingMember]);

  useEffect(() => {
    if (!showCallModal || !callsAvailable || !refreshCallLog) return undefined;

    let intervalId = null;

    const startPolling = () => {
      if (intervalId !== null || document.visibilityState !== 'visible') return;
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          refreshCallLog();
        }
      }, 1200);
    };

    const stopPolling = () => {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCallLog();
        startPolling();
        return;
      }
      stopPolling();
    };

    refreshCallLog();
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [showCallModal, callsAvailable, refreshCallLog]);


  function openStarredFromProfile() {
    setProfileClosing(false);
    setShowContactProfile(false);
    setViewingContact(null);
    setShowStarredMsgs(true);
  }

  async function handleLogoutFromSettings() {
    if (!user?.uid) return;
    clearPulseUserStorage(user.uid);
    await signOut(auth);
  }

  const anyModalOpen = !!(confirmDialog || showAvatarBuilder);

  useEffect(() => {
    if (!anyModalOpen) return;
    const overlays = document.querySelectorAll('.modal-overlay');
    const overlay = overlays[overlays.length - 1];
    if (!overlay) return;
    const box = overlay.querySelector('.modal-box') || overlay;
    const getFocusable = (el) => [...el.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )];
    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(box);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [anyModalOpen]);

  const normalizedNewChatQuery = searchEmail.trim().toLowerCase();
  const filteredNewChatContacts = normalizedNewChatQuery
    ? contacts.filter(c => {
        const displayName = (getContactDisplayName(c) || c.displayName || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const username = (c.username || '').toLowerCase();
        return displayName.includes(normalizedNewChatQuery) || email.includes(normalizedNewChatQuery) || username.includes(normalizedNewChatQuery);
      })
    : contacts;

  return (
    <>
      {/* ── CONTACT HERNOEMEN ── */}
      {renamingContact && (
          <aside className="chat-side-panel rename-contact-panel" aria-labelledby="rename-contact-title" aria-describedby="rename-contact-description">
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setRenamingContact(null)}><span aria-hidden="true">✕</span></button>
            <h2 id="rename-contact-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><MagicEdit size={18} /></span> Naam wijzigen</h2>
            <p id="rename-contact-description" className="sr-only">Wijzig de bijnaam van deze contactpersoon.</p>
            <div className="form-group">
              <label className="form-label">Bijnaam</label>
              <input
                className="form-input"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                placeholder={renamingContact.displayName}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { saveContactNickname(renamingContact.uid, renameValue); setRenamingContact(null); setContacts(prev => [...prev]); } }}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setRenamingContact(null)}>Sluiten</button>
              <button type="button" className="btn-primary" onClick={() => { saveContactNickname(renamingContact.uid, renameValue); setRenamingContact(null); setContacts(prev => [...prev]); }}>Opslaan</button>
            </div>
          </aside>
      )}

      {/* ── CONTACTPERSOON DELEN ── */}
      {sharingContact && (
          <aside className="chat-side-panel share-contact-panel" aria-labelledby="share-contact-title">
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setSharingContact(null); setShareRecipients([]); }}><span aria-hidden="true">✕</span></button>
            <h2 id="share-contact-title" className="modal-title" style={{ whiteSpace: 'nowrap', fontSize: '16px' }}><span className="modal-title-icon" aria-hidden="true"><Share size={18} /></span> Contactpersoon delen</h2>
            <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar sm">{getInitials(getContactDisplayName(sharingContact))}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{getContactDisplayName(sharingContact)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{sharingContact.email}</div>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '10px' }}>Stuur naar:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
              {contacts.filter(c => c.uid !== sharingContact.uid).map(c => {
                const selected = shareRecipients.includes(c.uid);
                return (
                  <button key={c.uid} type="button" className="contact-row"
                    style={{ background: selected ? 'var(--accent-soft, rgba(108,99,255,.15))' : 'none', border: selected ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', textAlign: 'left' }}
                    onClick={() => setShareRecipients(prev => prev.includes(c.uid) ? prev.filter(id => id !== c.uid) : [...prev, c.uid])}>
                    <div className="avatar sm">{getInitials(getContactDisplayName(c))}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '14px' }}>{getContactDisplayName(c)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{c.email}</div>
                    </div>
                    {selected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>}
                  </button>
                );
              })}
            </div>
            <div className="modal-actions" style={{ marginTop: '14px' }}>
              <button type="button" className="btn-secondary" onClick={() => { setSharingContact(null); setShareRecipients([]); }}>Sluiten</button>
              <button type="button" className="btn-primary" disabled={shareRecipients.length === 0}
                onClick={() => { shareRecipients.forEach(uid => { const c = contacts.find(x => x.uid === uid); if (c) sendContactCard(c, sharingContact); }); setSharingContact(null); setShareRecipients([]); }}>
                Versturen{shareRecipients.length > 1 ? ` (${shareRecipients.length})` : ''}
              </button>
            </div>
          </aside>
      )}

      {/* ── VRIENDSCHAPSVERZOEKEN ── */}
      {showFriendRequestsPanel && (
          <aside className="chat-side-panel friend-requests-panel" aria-labelledby="friend-requests-title">
            <button
              type="button"
              className="modal-close-btn"
              aria-label="Sluiten"
              onClick={() => setShowFriendRequestsPanel(false)}
            >
              <span aria-hidden="true">✕</span>
            </button>
            <h2 id="friend-requests-title" className="modal-title friend-requests-title"><span className="modal-title-icon" aria-hidden="true"><Handshake size={18} /></span> Verzoeken</h2>

            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <button type="button" onClick={() => setRequestsTab('ontvangen')} className={requestsTab === 'ontvangen' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, minWidth: 0 }}>
                Ontvangen
                {friendRequests.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800 }}>{friendRequests.length}</span>}
              </button>
              <button type="button" onClick={() => setRequestsTab('verstuurd')} className={requestsTab === 'verstuurd' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, minWidth: 0 }}>
                Verstuurd
                {sentFriendRequests.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800 }}>{sentFriendRequests.length}</span>}
              </button>
            </div>

            <div className="friend-requests-list">
              {requestsTab === 'ontvangen' && (
                <>
                  {friendRequests.map(req => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(124,111,255,0.08)', borderRadius: 10, border: '1px solid rgba(124,111,255,0.2)' }}>
                      <div className="avatar-circle sm" aria-hidden="true">{getInitials(req.fromName)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.fromName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.fromEmail}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button type="button" className="btn-primary" style={{ padding: '4px 10px', fontSize: 12, minWidth: 0 }} onClick={() => onAcceptFriendRequest(req.id)}><span aria-hidden="true">✓</span></button>
                        <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12, minWidth: 0 }} onClick={() => onDeclineFriendRequest(req.id)}><span aria-hidden="true">✗</span></button>
                      </div>
                    </div>
                  ))}
                  {friendRequests.length === 0 && (
                    <div className="empty-convs" style={{ paddingTop: 10, paddingBottom: 10 }}>
                      <p>Geen ontvangen vriendschapsverzoeken.</p>
                    </div>
                  )}
                </>
              )}

              {requestsTab === 'verstuurd' && (
                <>
                  {friendRequestActionErr && (
                    <div className="auth-error" style={{ marginBottom: 10 }}>
                      ⚠️ {friendRequestActionErr}
                    </div>
                  )}
                  {sentFriendRequests.map(req => {
                    const requestId = getFriendRequestId(req);
                    const reminderCount = Number(req.reminderCount || 0);
                    const remindersRemaining = Math.max(0, 3 - reminderCount);
                    return (
                      <div key={requestId || req.toUid || req.toEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar-circle sm" aria-hidden="true">{getInitials(req.toEmail || req.toUid)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.toEmail || req.toIdentifier || req.toUid}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {remindersRemaining > 0 ? `Nog ${remindersRemaining} ${remindersRemaining === 1 ? 'herinnering' : 'herinneringen'} over` : 'Geen herinneringen meer over'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="btn-secondary" style={{ flex: 1, padding: '6px 10px', fontSize: 12, minWidth: 0 }} onClick={() => requestId && onCancelFriendRequest(requestId)} disabled={!requestId}>
                            Annuleren
                          </button>
                          <button type="button" className="btn-primary" style={{ flex: 1, padding: '6px 10px', fontSize: 12, minWidth: 0 }} onClick={() => requestId && onRemindFriendRequest(requestId)} disabled={!requestId || remindersRemaining <= 0}>
                            Herinneren
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {sentFriendRequests.length === 0 && (
                    <div className="empty-convs" style={{ paddingTop: 10, paddingBottom: 10 }}>
                      <p>Geen verstuurde vriendschapsverzoeken.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
      )}

      {/* ── GEDEELD CONTACT PROFIEL ── */}
      {viewingSharedContact && (
          <aside className="chat-side-panel shared-contact-panel" aria-labelledby="shared-contact-title">
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setViewingSharedContact(null)}><span aria-hidden="true">✕</span></button>
            <h2 id="shared-contact-title" className="modal-title" style={{ fontSize: '18px' }}><span className="modal-title-icon" aria-hidden="true"><User size={18} /></span> Contactpersoon</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 0 20px' }}>
              <div className="avatar-wrap" style={{ flexShrink: 0 }}>
                <div className="avatar-circle" style={{ width: 52, height: 52, fontSize: 20, borderRadius: 14 }}>{getInitials(viewingSharedContact.name || '')}</div>
                {viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid) && <span className={`online-dot${inactiveUsers.has(viewingSharedContact.uid) ? ' inactive' : ''}`} />}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{viewingSharedContact.name || 'Onbekend'}</div>
                {viewingSharedContact.email && <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: 2 }}>{viewingSharedContact.email}</div>}
                <div style={{ fontSize: '12px', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid)
                    ? inactiveUsers.has(viewingSharedContact.uid)
                      ? <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /><span style={{ color: '#f59e0b' }}>Afwezig</span></>
                      : <><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} /><span style={{ color: 'var(--success)' }}>Online</span></>
                    : <><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text3)', display: 'inline-block' }} /><span style={{ color: 'var(--text3)' }}>Offline</span></>
                  }
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn-secondary" onClick={() => setViewingSharedContact(null)}>Sluiten</button>
              {viewingSharedContact.isAlreadyContact
                ? <span style={{ fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '5px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg> Al in contacten</span>
                : <button type="button" className="btn-primary" disabled={friendReqLoading || friendReqSent}
                    onClick={() => sendFriendRequestToEmail(viewingSharedContact.email)}>
                    {friendReqSent ? '✓ Verzoek verzonden' : friendReqLoading ? 'Verzenden…' : 'Vriendschapsverzoek'}
                  </button>
              }
            </div>
          </aside>
      )}

      {/* ── CONTACT PROFIEL ── */}
      {viewingContact && (
          <aside className="chat-side-panel contact-list-profile-panel" aria-labelledby="contact-list-profile-title">
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setViewingContact(null)}><span aria-hidden="true">✕</span></button>
            <div className="panel-header-row">
              <h2 id="contact-list-profile-title" className="modal-title" style={{ margin: 0 }}><span className="modal-title-icon" aria-hidden="true"><User size={18} /></span> Profiel</h2>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              {viewingContact.photoURL
                ? <img src={viewingContact.photoURL} alt={getContactDisplayName(viewingContact)} className="profile-avatar-big" style={{ objectFit: 'cover' }} loading="lazy" />
                : <div className="profile-avatar-big">{getInitials(getContactDisplayName(viewingContact))}</div>
              }
            </div>
            <div className="form-group">
              <label className="form-label">Naam</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder={viewingContact.displayName} style={{ paddingRight: '36px' }} />
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }}><MagicEdit size={22} /></span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">E-mailadres</label>
              <input className="form-input" value={viewingContact.email || ''} disabled style={{ opacity: .7 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div className={`profile-status-badge ${onlineUsers.has(viewingContact.uid) && !inactiveUsers.has(viewingContact.uid) ? 'online' : onlineUsers.has(viewingContact.uid) ? 'inactive' : 'offline'}`}>
                <span className="profile-status-dot" />
                {onlineUsers.has(viewingContact.uid) && !inactiveUsers.has(viewingContact.uid) ? 'Online' : onlineUsers.has(viewingContact.uid) ? 'Afwezig' : 'Offline'}
              </div>
            </div>
            {(() => {
              const dmConv = findConvWithUid(viewingContact.uid);
              if (!dmConv) return null;
              return (
                <div className="form-group">
                  <label className="form-label">Relatie</label>
                  <div className="label-chip-row">
                    {['familie', 'vrienden'].map(lbl => (
                      <button key={lbl} type="button" onClick={() => setConvLabel(dmConv.id, convLabels[dmConv.id] === lbl ? null : lbl)}
                        className={`label-chip${convLabels[dmConv.id] === lbl ? ' active' : ''}`}>
                        {lbl === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="modal-actions" style={{ justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
              <div className="panel-header-actions" style={{ marginRight: 8 }}>
                <button type="button" className="icon-btn" aria-label={`Open berichten met ster van ${getContactDisplayName(viewingContact)}`} title="Berichten met ster" onClick={openStarredFromProfile}>
                  <StarFilled size={18} style={{ color: '#f59e0b' }} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn" aria-label={`Deel contactpersoon ${getContactDisplayName(viewingContact)}`} onClick={() => { setSharingContact(viewingContact); setViewingContact(null); }} title="Contactpersoon delen"><Share size={18} aria-hidden="true" /></button>
              </div>
                <button type="button" className="btn-primary" style={profilePanelSaveButtonStyle} onClick={() => { saveContactNickname(viewingContact.uid, renameValue); setContacts(prev => [...prev]); setViewingContact(null); }}>Opslaan</button>
            </div>
          </aside>
      )}

      {/* ── BEVESTIGINGSDIALOOG ── */}
      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-box confirm-dialog-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setConfirmDialog(null)}><span aria-hidden="true">✕</span></button>
            <h2 id="confirm-dialog-title" className="modal-title confirm-dialog-title">{confirmDialog.title || 'Bevestiging'}</h2>
            {confirmDialog.message && (
              <p id="confirm-dialog-description" style={{ color: 'var(--text)', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>
                {confirmDialog.message}
              </p>
            )}
            <div className="modal-actions confirm-dialog-actions">
              <button type="button" className="btn-secondary confirm-dialog-btn" onClick={() => setConfirmDialog(null)}>{confirmDialog.cancelLabel || 'Annuleren'}</button>
              <button type="button" className="btn-primary confirm-dialog-btn confirm-dialog-btn-danger" onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>
                {confirmDialog.confirmIcon === 'trash' && <Delete size={16} aria-hidden="true" />}
                <span>{confirmDialog.confirmLabel || 'Verwijderen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACT TOEVOEGEN MODAL ── */}
      {showAddContact && (
          <aside className="chat-side-panel add-contact-panel" aria-labelledby="add-contact-title" aria-describedby="add-contact-description">
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setShowAddContact(false); setContactEmail(''); setContactNickname(''); setContactRelation(null); clearPendingFriendRequestState(); }}><span aria-hidden="true">✕</span></button>
            <h2 id="add-contact-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><Users size={18} /></span> Vriend uitnodigen</h2>
            <p id="add-contact-description" className="modal-sub">Zoek op e-mailadres, <code>@pulse.internal</code>-adres of gebruikersnaam</p>
            <div className="form-group">
              <label className="form-label">E-mailadres of gebruikersnaam</label>
              <input className="form-input" placeholder="naam@voorbeeld.nl, kind@pulse.internal of gebruikersnaam" value={contactEmail} onChange={e => { setContactEmail(e.target.value); clearPendingFriendRequestState(); }} onKeyDown={e => e.key === 'Enter' && addContact()} />
            </div>
            <div className="form-group">
              <label className="form-label">Relatie</label>
              <div className="label-chip-row">
                {['familie', 'vrienden'].map(lbl => (
                  <button key={lbl} type="button" onClick={() => setContactRelation(contactRelation === lbl ? null : lbl)}
                    className={`label-chip${contactRelation === lbl ? ' active' : ''}`}>
                    {lbl === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
                  </button>
                ))}
              </div>
            </div>
            {contactErr && <div className="auth-error">⚠️ {contactErr}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { setShowAddContact(false); setContactEmail(''); setContactNickname(''); setContactRelation(null); clearPendingFriendRequestState(); }}>Sluiten</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={addContact} disabled={contactLoading}>{contactLoading ? 'Verzenden…' : 'Verzoek sturen →'}</button>
            </div>
          </aside>
      )}

      {/* ── NIEUW GESPREK PANEEL ── */}
      {showNewChat && (
          <aside className="chat-side-panel new-chat-panel" aria-labelledby="new-chat-title" aria-describedby="new-chat-description">
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setShowNewChat(false)}><span aria-hidden="true">✕</span></button>
            <h2 id="new-chat-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><MagicEdit size={18} /></span> Nieuwe chat</h2>
            <p id="new-chat-description" className="modal-sub">Zoek op e-mailadres, <code>@pulse.internal</code>-adres of gebruikersnaam</p>
            <div className="search-row new-chat-search-row" style={{ marginBottom: searchErr || searchResult ? 10 : 18 }}>
              <input className="form-input" placeholder="naam@voorbeeld.nl, kind@pulse.internal of gebruikersnaam" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUser()} />
              <button type="button" className="btn-primary sm" onClick={searchUser}>Zoeken</button>
            </div>
            {searchErr && <div className="auth-error" style={{ marginBottom: 14 }}>⚠️ {searchErr}</div>}
            {searchResult && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Zoekresultaat</div>
                <div className="search-result" onClick={() => startConversationWith(searchResult)}>
                  <UserAvatar photoURL={searchResult.photoURL} displayName={searchResult.displayName} className="sm" decorative />
                  <div><div className="conv-name">{searchResult.displayName}</div><div className="conv-preview">{searchResult.email}</div></div>
                </div>
              </div>
            )}
            {contacts.length > 0 && (
              <>
                <p className="modal-sub">Kies uit je contacten</p>
                <div className="new-chat-contact-list">
                  {filteredNewChatContacts.map(c => (
                    <div key={c.uid} className="search-result" onClick={() => startConversationWith(c)}>
                      <UserAvatar photoURL={c.photoURL} displayName={c.displayName} className="sm" decorative />
                      <div><div className="conv-name">{getContactDisplayName(c)}</div><div className="conv-preview">{c.email}</div></div>
                    </div>
                  ))}
                  {filteredNewChatContacts.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 2px' }}>
                      Geen contacten die overeenkomen met je zoekopdracht.
                    </div>
                  )}
                </div>
              </>
            )}
            <button type="button" className="btn-secondary" style={{ marginTop: 'auto' }} onClick={() => setShowNewChat(false)}>Sluiten</button>
          </aside>
      )}

      {/* ── GROEP AANMAKEN PANEEL ── */}
      {showNewGroup && (
          <aside className="chat-side-panel new-group-panel" aria-labelledby="new-group-title" aria-describedby="new-group-description">
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setShowNewGroup(false); setGroupName(''); }}><span aria-hidden="true">✕</span></button>
            <h2 id="new-group-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><Users size={18} /></span> Nieuwe groep</h2>
            <div className="form-group">
              <label className="form-label">Groepsnaam</label>
              <input className="form-input" placeholder="Bijv. Familie, Werk…" value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={50} />
            </div>
            <p id="new-group-description" className="modal-sub">Selecteer deelnemers</p>
            {contacts.length === 0 && <div className="auth-error">⚠️ Voeg eerst contacten toe.</div>}
            <div className="new-group-contact-list">
              {contacts.map(c => {
                const selected = groupMembers.find(m => m.uid === c.uid);
                return (
                  <div key={c.uid} className={`search-result ${selected ? 'selected' : ''}`} onClick={() => toggleGroupMember(c)}>
                    <UserAvatar photoURL={c.photoURL} displayName={c.displayName} className="sm" decorative />
                    <div style={{ flex: 1 }}><div className="conv-name">{c.displayName}</div><div className="conv-preview">{c.email}</div></div>
                    {selected
                      ? <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#6c63ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={14} color="#fff" /></span>
                      : <span style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'inline-block', flexShrink: 0 }} />
                    }
                  </div>
                );
              })}
            </div>
            {groupMembers.length > 0 && <p className="modal-sub">{groupMembers.length} deelnemer(s) geselecteerd</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { setShowNewGroup(false); setGroupName(''); }}>Sluiten</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={createGroup} disabled={!groupName.trim() || groupMembers.length === 0}>Groep aanmaken →</button>
            </div>
          </aside>
      )}

      {/* ── PROFIEL MODAL ── */}
      {showProfile && (
          <aside
            className="profile-modal-box profile-side-panel"
            aria-labelledby="profile-settings-title"
            aria-describedby="profile-settings-description"
          >
            <div className="profile-modal-header">
              {profileTab !== 'overview' ? (
                <button
                  type="button"
                  className="profile-modal-back"
                  aria-label="Terug naar instellingen"
                  onClick={() => setProfileTab('overview')}
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
              ) : (
                <span className="profile-modal-back-placeholder" aria-hidden="true" />
              )}
              <span id="profile-settings-title" className="profile-modal-header-title">
                {profileTab === 'overview' ? 'Instellingen' : activeProfileSection?.label || 'Instellingen'}
              </span>
              <button type="button" className="profile-modal-close" aria-label="Instellingen sluiten" onClick={() => setShowProfile(false)}><span aria-hidden="true">✕</span></button>
            </div>
            <p id="profile-settings-description" className="sr-only">
              Pas je account, styling en verwijderopties aan in dit instellingenvenster.
            </p>
            <div className="profile-modal-body">
              <div className="profile-content">
                {profileTab === 'overview' && (
                  <div className="profile-settings-home">
                    <div className="profile-settings-hero">
                      {photoPreview
                        ? <img src={photoPreview} alt={user.displayName || user.email} className="profile-avatar-big" style={{ objectFit: 'cover' }} loading="lazy" onError={() => { setPhotoPreview(null); localStorage.removeItem(`pulse_photo_${user.uid}`); }} />
                        : <div className="profile-avatar-big">{getInitials(user.displayName || user.email)}</div>
                      }
                      <div className="profile-settings-hero-name">{user.displayName || user.email}</div>
                    </div>
                    <div className="profile-settings-section-title">Instellingen</div>
                    <div className="profile-settings-list">
                      {profileSections.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          className="profile-settings-item"
                          onClick={() => {
                            setProfileTab(section.id);
                            if (section.id === 'geschiedenis') loadHistorySettings();
                          }}
                        >
                          <span className="profile-settings-item-icon" aria-hidden="true">{section.icon}</span>
                          <span className="profile-settings-item-copy">
                            <span className="profile-settings-item-title">{section.label}</span>
                            <span className="profile-settings-item-description">{section.description}</span>
                          </span>
                          <ArrowRight size={18} className="profile-settings-item-arrow" aria-hidden="true" />
                        </button>
                      ))}
                      <button
                        type="button"
                        className="profile-settings-item"
                        onClick={() => {
                          setConfirmDialog?.({
                            title: 'Uitloggen',
                            message: 'Weet je zeker dat je wilt uitloggen?',
                            confirmLabel: 'Uitloggen',
                            onConfirm: async () => { handleLogoutFromSettings().catch(() => {}); },
                          });
                        }}
                      >
                        <span className="profile-settings-item-icon" aria-hidden="true"><Logout size={18} /></span>
                        <span className="profile-settings-item-copy">
                          <span className="profile-settings-item-title" style={{ color: '#fda4af' }}>Uitloggen</span>
                          <span className="profile-settings-item-description">Afmelden van dit account</span>
                        </span>
                      </button>
                    </div>
                  </div>
                )}
                {profileTab === 'account' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div className="profile-photo-wrap" onClick={() => photoInputRef.current?.click()}>
                          {photoPreview
                            ? <img src={photoPreview} alt="avatar" className="profile-avatar-big" style={{ objectFit: 'cover' }} loading="lazy" onError={() => { setPhotoPreview(null); localStorage.removeItem(`pulse_photo_${user.uid}`); }} />
                            : <div className="profile-avatar-big">{getInitials(user.displayName || user.email)}</div>
                          }
                          <div className="profile-photo-overlay"><Camera size={16} /></div>
                        </div>
                        <button type="button" onClick={() => setShowAvatarBuilder(true)}
                          style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid rgba(108,99,255,0.4)', background: 'rgba(108,99,255,0.1)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          🎨 Avatar maken
                        </button>
                      </div>
                      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Weergavenaam</label>
                      <input className="form-input" placeholder="Jouw naam" value={newName} onChange={e => setNewName(e.target.value)} />
                    </div>
                    {isChildAccount && (
                      <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <label className="form-label">Gebruikersnaam</label>
                        <input
                          className="form-input"
                          value={newUsername}
                          readOnly
                          disabled
                          aria-readonly="true"
                          style={{ opacity: 0.72, cursor: 'not-allowed' }}
                        />
                        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                          Deze loginnaam is ingesteld door je ouder en kan alleen in het ouderportaal worden gewijzigd.
                        </div>
                      </div>
                    )}
                    {isParent && (
                      <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <label className="form-label">E-mailadres</label>
                        <input className="form-input" type="email" value={user.email} disabled style={{ opacity: .5 }} />
                      </div>
                    )}
                    {!user.email?.endsWith('@pulse.internal') && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <label className="form-label" style={{ marginBottom: '10px', display: 'block' }}>Wachtwoord wijzigen</label>
                        <div className="form-group">
                          <div style={{ position: 'relative' }}>
                            <input className="form-input" type={showNewPassword ? 'text' : 'password'}
                              placeholder="Nieuw wachtwoord" aria-label="Nieuw wachtwoord" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                              style={{ paddingRight: '42px' }} />
                            <button type="button" aria-label={showNewPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'} onClick={() => setShowNewPassword(p => !p)}
                              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>
                              {showNewPassword ? <EyeOff size={18} /> : <EyeOn size={18} />}
                            </button>
                          </div>
                        </div>
                        <div className="form-group">
                          <input className="form-input" type={showNewPassword ? 'text' : 'password'}
                            placeholder="Bevestig wachtwoord" aria-label="Bevestig wachtwoord" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                        </div>
                        <button type="button" className="btn-secondary" style={{ width: '100%' }}
                          disabled={passwordLoading || !newPassword} onClick={changePassword}>
                          {passwordLoading ? 'Bezig…' : 'Wachtwoord wijzigen'}
                        </button>
                        {passwordMsg && <div style={{ fontSize: '12px', marginTop: '6px', color: passwordMsg.startsWith('Fout') ? 'var(--danger)' : 'var(--success)' }}>{passwordMsg}</div>}
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                      {profileMsg && <div style={{ fontSize: '12px', marginBottom: '10px', color: profileMsg.startsWith('Fout') ? 'var(--danger)' : 'var(--success)' }}>{profileMsg}</div>}
                      <button type="button" className="btn-primary" style={{ width: '100%' }}
                        disabled={profileLoading}
                        onClick={saveProfile}>
                        {profileLoading ? 'Opslaan…' : 'Opslaan →'}
                      </button>
                    </div>
                    <div className="profile-danger-card">
                      <div className="profile-danger-title">Account verwijderen</div>
                      <p className="profile-danger-copy">
                        Als je je account verwijdert worden al je chats, berichten en gegevens permanent verwijderd.
                      </p>
                      <button type="button" className="btn-danger" style={{ width: '100%' }}
                        onClick={() => { setShowProfile(false); handleDeleteAccount(); }}>
                        <Delete size={16} style={{ marginRight: 6 }} aria-hidden="true" /> Account definitief verwijderen
                      </button>
                    </div>
                  </div>
                )}
                {profileTab === 'geschiedenis' && isParent && (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>Geschiedenis</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5, margin: 0 }}>
                        Beheer per account hoe lang chatgeschiedenis, belgeschiedenis en videobelgeschiedenis worden bewaard. Zonder wijziging blijft de standaard op 30 dagen.
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Ouderaccount</div>
                        {historySettingRows.map((row) => (
                          <div key={`parent-${row.key}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{row.label}</div>
                            <HistorySelect
                              aria-label={`${row.label} ouderaccount`}
                              value={historyRules?.[row.key] ?? 30}
                              options={HISTORY_RETENTION_OPTIONS}
                              onChange={(nextValue) => setHistoryRules((prev) => ({ ...normalizeHistoryRules(prev), [row.key]: Number(nextValue) }))}
                              disabled={historySettingsLoading || historySettingsSavingTarget === 'parent'}
                              style={historySelectStyle}
                            />
                          </div>
                        ))}
                        <button type="button" className="btn-primary" onClick={saveHistorySettings} disabled={historySettingsLoading || historySettingsSavingTarget === 'parent'}>
                          {historySettingsSavingTarget === 'parent' ? 'Opslaan…' : 'Opslaan'}
                        </button>
                      </div>

                      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Kindaccount</div>
                        <HistorySelect
                          aria-label="Kies kindaccount"
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
                          <div key={`child-${row.key}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{row.label}</div>
                            <HistorySelect
                              aria-label={`${row.label} kindaccount`}
                              value={primaryHistoryRules[row.key]}
                              options={HISTORY_RETENTION_OPTIONS}
                              onChange={(nextValue) => {
                                if (!primaryHistoryChild) return;
                                setChildHistoryRulesByUid((prev) => ({
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
                          onClick={() => primaryHistoryChild && saveChildHistorySettings(primaryHistoryChild.uid)}
                          disabled={!primaryHistoryChild || !canManagePrimaryHistoryChild || historySettingsLoading || historySettingsSavingTarget === primaryHistoryChild?.uid}
                        >
                          {historySettingsSavingTarget === primaryHistoryChild?.uid ? 'Opslaan…' : 'Opslaan'}
                        </button>
                        {primaryHistoryChild && !canManagePrimaryHistoryChild && (
                          <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.45 }}>
                            Alleen ouder A kan de bewaartermijn voor dit kindaccount aanpassen.
                          </div>
                        )}
                      </div>

                      {historySettingsMsg && (
                        <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: historySettingsMsg.startsWith('Fout:') ? 'var(--danger)' : 'var(--success)' }}>
                          {historySettingsMsg}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {profileTab === 'geblokkeerd' && (() => {
                  const selfBlocked = (blockedContacts || []).filter(c => !parentBlockedUids?.includes(c.uid));
                  const parentBlocked = (blockedContacts || []).filter(c => parentBlockedUids?.includes(c.uid));
                  return (
                    <div>
                      {selfBlocked.length === 0 && parentBlocked.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '14px', paddingTop: '24px' }}>
                          Geen geblokkeerde contacten.
                        </div>
                      )}
                      {selfBlocked.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '10px', textTransform: 'uppercase' }}>Door jou geblokkeerd</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {selfBlocked.map(c => (
                              <div key={c.uid} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px' }}>
                                <UserAvatar photoURL={c.photoURL} displayName={c.displayName || c.email} className="sm" decorative style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.displayName || c.email}</div>
                                </div>
                                <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', flexShrink: 0, width: 'auto', marginTop: 0 }} onClick={() => unblockContact(c.uid)}>Deblokkeren</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {parentBlocked.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: '10px', textTransform: 'uppercase' }}>Geblokkeerd door ouder</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {parentBlocked.map(c => (
                              <div key={c.uid} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface2)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '10px', padding: '10px 12px' }}>
                                <UserAvatar photoURL={c.photoURL} displayName={c.displayName || c.email} className="sm" decorative style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.displayName || c.email}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>Geblokkeerd door ouder</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {profileTab === 'styling' && (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>Chat achtergrond</label>
                      <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: '10px', padding: '4px', gap: '4px', marginBottom: '14px' }}>
                        {[
                          ['foto', <ImageIcon size={14} />, 'Foto'],
                          ['kleur', <ColorCircle size={14} />, 'Kleur'],
                          ['standaard', <LayoutTemplate size={14} />, 'Standaard'],
                        ].map(([id, icon, label]) => (
                          <button key={id} type="button" onClick={() => { setChatBgTab(id); if (id === 'kleur' && !pendingColor && chatBg?.type !== 'color') setPendingColor('#000000'); }}
                            style={{ flex: 1, padding: '7px 4px', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                              background: chatBgTab === id ? 'linear-gradient(135deg,#7c6fff,#a855f7)' : 'transparent',
                              color: chatBgTab === id ? '#fff' : 'var(--text2)' }}>
                            {icon}{label}
                          </button>
                        ))}
                      </div>
                      <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '14px', height: '110px', position: 'relative',
                        background: chatBgTab === 'kleur'
                          ? (pendingColor || (chatBg?.type === 'color' ? chatBg.value : '#000000'))
                          : chatBgTab === 'foto'
                            ? (pendingPhoto ? `url(${pendingPhoto.url}) center/cover` : chatBg?.type === 'photo' ? `url(${chatBg.url}) center/cover` : 'var(--bg)')
                            : (chatBg?.type === 'photo' ? `url(${chatBg.url}) center/cover` : chatBg?.type === 'color' ? chatBg.value : `#eeeaf8 url(${chatDefaultPattern}) center top / 180px auto repeat`),
                        border: '1px solid var(--border)' }}>
                        {((chatBgTab === 'foto' && (pendingPhoto || chatBg?.type === 'photo'))) && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.15)' }} />}
                        {chatBgTab === 'foto' && (pendingPhoto || chatBg?.type === 'photo') && (
                          <button type="button" disabled={chatBgLoading}
                            onClick={() => pendingPhoto ? setPendingPhoto(null) : removeChatBg()}
                            style={{ position: 'absolute', top: '8px', right: '8px', width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', zIndex: 1 }}
                            title="Achtergrond verwijderen">×</button>
                        )}
                        <div style={{ position: 'absolute', bottom: '8px', left: '10px' }}>
                          <div style={{ background: chatBg ? 'rgba(26,26,36,0.85)' : 'var(--surface2)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '12px 12px 12px 3px', padding: '6px 12px', fontSize: '12px', color: '#fff', backdropFilter: 'blur(6px)' }}>Hallo! 👋</div>
                        </div>
                        <div style={{ position: 'absolute', bottom: '8px', right: '10px' }}>
                          <div style={{ background: 'linear-gradient(135deg,#7c6fff,#a855f7)', borderRadius: '12px 12px 3px 12px', padding: '6px 12px', fontSize: '12px', color: '#fff' }}>Hey!</div>
                        </div>
                      </div>
                      {chatBgTab === 'foto' && (
                        <div>
                          {!pendingPhoto && chatBg?.type === 'photo' && <div style={{ fontSize: '12px', color: 'var(--success)', marginBottom: '8px' }}>✓ Foto achtergrond actief</div>}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" className="btn-secondary" style={{ flex: 1 }} disabled={chatBgLoading}
                              onClick={() => bgInputRef.current?.click()}>
                              {chatBg?.type === 'photo' || pendingPhoto ? 'Andere foto kiezen' : 'Foto kiezen'}
                            </button>
                            <button type="button" className="btn-primary" style={{ flex: 1 }}
                              disabled={chatBgLoading || !pendingPhoto}
                              onClick={() => { uploadChatBgPhoto(pendingPhoto.file); setPendingPhoto(null); }}>
                              {chatBgLoading ? 'Uploaden…' : 'Opslaan'}
                            </button>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px', textAlign: 'center' }}>JPG, PNG of WEBP · max 5 MB</div>
                          <input ref={bgInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                            onChange={e => {
                              const f = e.target.files[0]; e.target.value = '';
                              if (f) setPendingPhoto({ file: f, url: URL.createObjectURL(f) });
                            }} />
                        </div>
                      )}
                      {chatBgTab === 'kleur' && (
                        <div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '12px' }}>
                            {['#1e0a3c', '#051236', '#0a1f0e', '#1f0a10', '#0f1923', '#1a1206', '#000000', '#1c1a18'].map(color => {
                              const isActive = (pendingColor ?? (chatBg?.type === 'color' ? chatBg.value : null)) === color;
                              return (
                                <button key={color} type="button" disabled={chatBgLoading} onClick={() => setPendingColor(color)}
                                  style={{ width: '36px', height: '36px', borderRadius: '50%', background: color,
                                    border: isActive ? '3px solid var(--accent)' : '2px solid var(--border)',
                                    cursor: 'pointer', position: 'relative', transition: 'all .15s',
                                    boxShadow: isActive ? '0 0 0 2px var(--bg),0 0 0 4px var(--accent)' : 'none' }}>
                                  {isActive && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px' }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                          <button type="button" className="btn-primary" style={{ width: '100%' }}
                            disabled={chatBgLoading || !pendingColor}
                            onClick={() => { saveChatBgColor(pendingColor); setPendingColor(null); }}>
                            {chatBgLoading ? 'Opslaan…' : 'Opslaan'}
                          </button>
                        </div>
                      )}
                      {chatBgTab === 'standaard' && (
                        chatBg
                          ? <button type="button" className="btn-secondary" style={{ width: '100%' }} disabled={chatBgLoading} onClick={removeChatBg}>
                              {chatBgLoading ? 'Bezig…' : 'Standaard achtergrond herstellen'}
                            </button>
                          : <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '13px', padding: '8px 0' }}>Standaard achtergrond is actief</div>
                      )}
                      {chatBgMsg && chatBgMsg.startsWith('Fout') && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--danger)' }}>{chatBgMsg}</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
      )}

      {/* ── CONTACTPROFIEL PANEEL ── */}
      {showContactProfile && activeConv && !activeConv.isGroup && (() => {
        const uid       = getOtherUid(activeConv);
        const name      = getConvName(activeConv);
        const email     = activeConv.memberEmails?.[uid] || contacts.find(c => c.uid === uid)?.email || '';
        const photo     = getConvPhoto(activeConv);
        const isOnline  = uid && onlineUsers.has(uid);
        const isInactive = uid && inactiveUsers.has(uid);
        return (
          <aside
              className={`chat-side-panel contact-profile-panel${profileClosing ? ' closing' : ''}`}
              aria-labelledby="contact-profile-title"
              aria-describedby="contact-profile-description"
            >
              <button type="button" className="modal-close-btn" aria-label="Profiel sluiten" onClick={() => setShowContactProfile(false)}><span aria-hidden="true">✕</span></button>
              <div className="panel-header-row">
                <h2 id="contact-profile-title" className="modal-title" style={{ margin: 0 }}><span className="modal-title-icon" aria-hidden="true"><User size={18} /></span> Profiel</h2>
              </div>
              <p id="contact-profile-description" className="sr-only">
                Bekijk en bewerk de profielgegevens van {name}.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                {photo
                  ? <img src={photo} alt={name || 'Profielfoto'} className="profile-avatar-big" style={{ objectFit: 'cover' }} loading="lazy" />
                  : <div className="profile-avatar-big">{getInitials(name)}</div>
                }
              </div>
              <div className="form-group">
                <label className="form-label">Naam</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder={name} style={{ paddingRight: '36px' }} />
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }}><MagicEdit size={22} /></span>
                </div>
              </div>
              {email && (
                <div className="form-group">
                  <label className="form-label">E-mailadres</label>
                  <input className="form-input" value={email} disabled style={{ opacity: .7 }} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Status</label>
                <div className={`profile-status-badge ${isOnline && !isInactive ? 'online' : isOnline && isInactive ? 'inactive' : 'offline'}`}>
                  <span className="profile-status-dot" />
                  {isOnline && !isInactive ? 'Online' : isOnline && isInactive ? 'Afwezig' : 'Offline'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Relatie</label>
                <div className="label-chip-row">
                  {['familie', 'vrienden'].map(lbl => (
                    <button key={lbl} type="button" onClick={() => setConvLabel(activeConv.id, convLabels[activeConv.id] === lbl ? null : lbl)}
                      className={`label-chip${convLabels[activeConv.id] === lbl ? ' active' : ''}`}>
                      {lbl === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-actions" style={{ justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                <div className="panel-header-actions" style={{ marginRight: 8 }}>
                  <button type="button" className="icon-btn" aria-label={`Open berichten met ster van ${name}`} title="Berichten met ster" onClick={openStarredFromProfile}>
                    <StarFilled size={18} style={{ color: '#f59e0b' }} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Deel contactpersoon ${name}`} onClick={() => { const c = contacts.find(c => c.uid === uid); if (c) { setSharingContact(c); setShowContactProfile(false); } }} title="Contactpersoon delen"><Share size={18} aria-hidden="true" /></button>
                </div>
                <button type="button" className="btn-primary" style={profilePanelSaveButtonStyle} onClick={() => { saveContactNickname(uid, renameValue); setContacts(prev => [...prev]); setShowContactProfile(false); }}>Opslaan</button>
              </div>
            </aside>
        );
      })()}

      {/* ── BERICHTEN MET STER ── */}
      {showStarredMsgs && (() => {
        const q       = starredSearch.trim().toLowerCase();
        const starred = (messages || []).filter(m =>
          (starredMsgs || []).includes(m.id) && m.text &&
          (!q || m.text.toLowerCase().includes(q) || m.senderName?.toLowerCase().includes(q))
        );
        return (
          <aside
            className="chat-side-panel starred-messages-panel panel-stack"
            aria-labelledby="starred-messages-title"
            aria-describedby="starred-messages-description"
          >
              <div className="panel-header-row panel-header-row--compact">
                <h2 id="starred-messages-title" className="modal-title" style={{ margin: 0 }}>
                  <span className="modal-title-icon" aria-hidden="true"><StarFilled size={18} style={{ color: '#f59e0b' }} /></span>
                  Berichten met ster
                </h2>
                <button type="button" className="modal-close-btn" aria-label="Berichten met ster sluiten" onClick={() => { setShowStarredMsgs(false); setStarredSearch(''); }}><span aria-hidden="true">✕</span></button>
              </div>
              <p id="starred-messages-description" className="sr-only">
                Bekijk en doorzoek berichten met ster uit het actieve gesprek.
              </p>
              <div className="starred-search-wrap">
                <Search size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
                <input
                  className="starred-search-input"
                  placeholder="Zoeken…"
                  value={starredSearch}
                  onChange={e => setStarredSearch(e.target.value)}
                  autoFocus
                />
                {starredSearch && (
                  <button type="button" className="starred-search-clear" aria-label="Zoekopdracht wissen" onClick={() => setStarredSearch('')}>
                    <Cancel size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {starred.length === 0 ? (
                <div className="starred-empty-state">
                  <StarFilled size={36} style={{ opacity: .3, color: '#f59e0b', marginBottom: 8 }} aria-hidden="true" />
                  <div style={{ fontSize: 14 }}>{q ? 'Geen resultaten' : 'Nog geen berichten met ster'}</div>
                </div>
              ) : (
                <div className="starred-list">
                  {starred.map(msg => (
                    <div key={msg.id} className="starred-msg-item" role="button" tabIndex={0}
                      onClick={() => { setShowStarredMsgs(false); setStarredSearch(''); onJumpToMsg(msg.id); }}
                      onKeyDown={e => e.key === 'Enter' && (setShowStarredMsgs(false), setStarredSearch(''), onJumpToMsg(msg.id))}
                    >
                      <div className="starred-msg-meta">
                        <span className="starred-msg-name">{msg.senderName}</span>
                        <span className="starred-msg-time">{formatTime(msg.createdAt)}</span>
                      </div>
                      <div className="starred-msg-text">{getMessageDisplayText(msg)}</div>
                    </div>
                  ))}
                </div>
              )}
          </aside>
        );
      })()}

      {/* ── OPROEPEN PANEEL ── */}
      {showCallModal && (() => {
        const callLog = getCallLog();
        const normalizedCallSearch = callSearch.trim().toLowerCase();
        const filteredCallLog = normalizedCallSearch
          ? callLog.filter((entry) => {
              const name = (entry?.name || '').toLowerCase();
              const typeLabel = entry?.isVideo ? 'videogesprek' : 'gesprek';
              return name.includes(normalizedCallSearch) || typeLabel.includes(normalizedCallSearch);
            })
          : callLog;
        const filteredCallContacts = normalizedCallSearch
          ? contacts.filter((c) => {
              const displayName = (getContactDisplayName(c) || c.displayName || '').toLowerCase();
              const email = (c.email || '').toLowerCase();
              return displayName.includes(normalizedCallSearch) || email.includes(normalizedCallSearch);
            })
          : contacts;
        return (
            <aside className="chat-side-panel call-log-panel" aria-labelledby="call-log-title" aria-describedby="call-log-description">
              <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setShowCallModal(false); setCallActionMode(null); setCallSearch(''); }}><span aria-hidden="true">✕</span></button>
              <h2 id="call-log-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><Phone size={18} /></span> {callsAvailable ? 'Recent' : 'Alleen in de app'}</h2>
              <p id="call-log-description" className="sr-only">
                {callsAvailable
                  ? 'Bekijk recente oproepen en start een nieuwe bel- of video-oproep.'
                  : 'Bellen en videobellen zijn in Pulse Web niet beschikbaar.'}
              </p>
              {!callsAvailable ? (
                <div className="call-panel-note">
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{PULSE_WEB_CALLS_UNAVAILABLE_TITLE}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{PULSE_WEB_CALLS_UNAVAILABLE_MESSAGE}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>{PULSE_WEB_CALLS_UNAVAILABLE_HINT}</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                    <div
                      className="starred-search-wrap"
                      style={{
                        marginBottom: 0,
                        flex: 1,
                        minWidth: 0,
                        minHeight: 42,
                        padding: '0 12px',
                        borderRadius: 12,
                      }}
                    >
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
                    <button
                      type="button"
                      className="call-btn voice"
                      aria-label="Nieuw belgesprek"
                      title="Bel contact"
                      style={{
                        flexShrink: 0,
                        ...(callActionMode === 'voice' ? { boxShadow: '0 0 0 2px rgba(67,233,123,.35) inset' } : {}),
                      }}
                      onClick={() => setCallActionMode((prev) => (prev === 'voice' ? null : 'voice'))}
                    >
                      <Phone size={16} aria-hidden="true" />
                    </button>
                  </div>

                  {callActionMode && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                        Kies een contactpersoon om te bellen of videobellen:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                        {filteredCallContacts.length === 0 ? (
                          <div className="empty-convs" style={{ paddingTop: 6, paddingBottom: 6 }}>
                            <p>Geen contacten gevonden.</p>
                          </div>
                        ) : (
                          filteredCallContacts.map((contact) => (
                            <div
                              key={contact.uid}
                              className="contact-row"
                              style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid var(--border)',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                color: 'var(--text)',
                                textAlign: 'left',
                              }}
                            >
                              <UserAvatar photoURL={contact.photoURL} displayName={getContactDisplayName(contact)} className="sm" decorative />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getContactDisplayName(contact)}</div>
                                <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.email}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  className="call-btn voice"
                                  aria-label={`Bel ${getContactDisplayName(contact)}`}
                                  title="Bellen"
                                  onClick={() => (callContactFromRecent || callContact)(contact, false)}
                                >
                                  <Phone size={14} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="call-btn video"
                                  aria-label={`Videobel ${getContactDisplayName(contact)}`}
                                  title="Videobellen"
                                  onClick={() => (callContactFromRecent || callContact)(contact, true)}
                                >
                                  <Video size={14} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          ))
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
                        {filteredCallLog.map((entry, i) => {
                          const contact = contacts.find(c => c.uid === entry.uid);
                          const dirIcon = entry.direction === 'outgoing' ? <PhoneOutgoing size={13} /> : entry.direction === 'missed' ? <Cancel size={13} /> : <PhoneCall size={13} />;
                          const dirColor = entry.direction === 'missed' ? 'var(--danger)' : entry.direction === 'outgoing' ? 'var(--accent)' : 'var(--success)';
                          const displayTime = formatTime(entry.ts);
                          return (
                            <div key={i} className="call-log-row">
                              <div className="avatar-wrap">
                                <UserAvatar photoURL={entry.photoURL} displayName={entry.name} className="sm" decorative />
                                {contact && onlineUsers.has(entry.uid) && <span className="online-dot sm" />}
                              </div>
                              <div className="call-log-copy">
                                <div className="call-log-meta">
                                  <span style={{ color: dirColor, fontWeight: 700, fontSize: 13 }} aria-hidden="true">{dirIcon}</span>
                                  <span className="conv-name">{entry.name}</span>
                                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{displayTime}</span>
                                </div>
                                <div className="conv-preview" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{entry.isVideo ? <><Video size={12} aria-hidden="true" /> Videogesprek</> : <><Phone size={12} aria-hidden="true" /> Gesprek</>}</div>
                              </div>
                              {contact && (
                                <div className="call-log-actions">
                                  {entry.isVideo ? (
                                    <button type="button" className="call-btn video" aria-label={`Videobel ${entry.name}`} onClick={() => (callContactFromRecent || callContact)(contact, true)} title="Videobellen"><Video size={16} aria-hidden="true" /></button>
                                  ) : (
                                    <button type="button" className="call-btn voice" aria-label={`Bel ${entry.name}`} onClick={() => (callContactFromRecent || callContact)(contact, false)} title="Bellen"><Phone size={16} aria-hidden="true" /></button>
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
              {!callActionMode && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowCallModal(false); setCallActionMode(null); setCallSearch(''); }}>Sluiten</button>
                  {callsAvailable && callLog.length > 0 && <button type="button" className="btn-secondary" style={{ flex: 1, color: 'var(--danger)' }} onClick={async () => { await clearCallLog?.(); setShowCallModal(false); setCallActionMode(null); setCallSearch(''); }}>Wissen</button>}
                </div>
              )}
            </aside>
        );
      })()}

      {/* ── GROEPSINFORMATIE PANEEL ── */}
      {showGroupInfo && activeConv?.isGroup && (
        <aside
          className="group-info-panel"
          aria-labelledby="group-info-title"
          aria-describedby="group-info-description"
        >
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setShowGroupInfo(false); setAddingMember(false); }}><span aria-hidden="true">✕</span></button>
            {addingMember ? (() => {
              const availableContacts = contacts.filter(c => !activeConv.members.includes(c.uid));
              const query = groupMemberSearch.trim().toLowerCase();
              const filteredContacts = query
                ? availableContacts.filter(c => {
                    const displayName = (getContactDisplayName(c) || c.displayName || '').toLowerCase();
                    const email = (c.email || '').toLowerCase();
                    const username = (c.username || '').toLowerCase();
                    return displayName.includes(query) || email.includes(query) || username.includes(query);
                  })
                : availableContacts;
              return (
                <div className="group-info-add-view">
                  <div className="group-info-subview-header">
                    <button
                      type="button"
                      className="group-info-back-btn"
                      aria-label="Terug naar groepsinfo"
                      onClick={() => setAddingMember(false)}
                    >
                      <span aria-hidden="true">←</span>
                    </button>
                    <div>
                      <h2 id="group-info-title" className="group-info-subview-title">Groepsleden toevoegen</h2>
                      <p id="group-info-description" className="group-info-subview-subtitle">{getConvName(activeConv)}</p>
                    </div>
                  </div>

                  <label className="sr-only" htmlFor="group-member-search">Zoek contact om toe te voegen</label>
                  <input
                    id="group-member-search"
                    className="group-info-search"
                    type="search"
                    value={groupMemberSearch}
                    onChange={(e) => setGroupMemberSearch(e.target.value)}
                    placeholder="Zoek contact"
                    autoComplete="off"
                  />

                  <div id="group-add-member-list" role="list" className="group-info-member-list group-info-add-list">
                    {availableContacts.length === 0 ? (
                      <div className="group-info-empty" role="status">Alle contacten zijn al lid van deze groep.</div>
                    ) : filteredContacts.length === 0 ? (
                      <div className="group-info-empty" role="status">Geen contacten gevonden.</div>
                    ) : filteredContacts.map(c => (
                      <button
                        key={c.uid}
                        type="button"
                        role="listitem"
                        className="search-result group-info-member-row"
                        aria-label={`Voeg ${getContactDisplayName(c) || c.displayName} toe aan de groep`}
                        onClick={() => addMemberToGroup(c)}
                      >
                        <UserAvatar photoURL={c.photoURL} displayName={getContactDisplayName(c) || c.displayName} className="sm" decorative />
                        <div>
                          <div className="conv-name">{getContactDisplayName(c) || c.displayName}</div>
                          <div className="conv-preview">{c.email || c.username || 'Contactpersoon'}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })() : (
              <>
            {(() => {
              const isAdmin = activeConv.creatorId === user.uid;
              return (
                <div className="group-info-hero">
                  <label
                    htmlFor={isAdmin ? 'group-photo-upload' : undefined}
                    aria-label={isAdmin ? `${activeConv.photoURL ? 'Wijzig' : 'Voeg'} groepsfoto toe voor ${getConvName(activeConv)}` : undefined}
                    aria-describedby={isAdmin ? 'group-photo-upload-status' : undefined}
                    aria-busy={isAdmin && groupPhotoLoading ? 'true' : undefined}
                    aria-disabled={isAdmin && groupPhotoLoading ? 'true' : undefined}
                    aria-haspopup={isAdmin ? 'dialog' : undefined}
                    role={isAdmin ? 'button' : undefined}
                    tabIndex={isAdmin && !groupPhotoLoading ? 0 : undefined}
                    onKeyDown={isAdmin ? (e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !groupPhotoLoading) {
                        e.preventDefault();
                        e.currentTarget.querySelector('input[type="file"]')?.click();
                      }
                    } : undefined}
                    className="group-info-photo-control"
                    style={{ cursor: isAdmin && !groupPhotoLoading ? 'pointer' : 'default' }}
                  >
                    {activeConv.photoURL
                      ? <img src={activeConv.photoURL} alt={`Groepsfoto van ${getConvName(activeConv)}`} className="group-info-photo" />
                      : <div className="group-info-photo group-info-photo-fallback">
                          {getConvName(activeConv)?.[0]?.toUpperCase() || '?'}
                        </div>}
                    {isAdmin && (
                      <>
                        <div aria-hidden="true" className="group-info-photo-edit">
                          {groupPhotoLoading ? <div className="splash-spinner" style={{ width: 12, height: 12 }} /> : <Camera size={12} color="#fff" aria-hidden="true" />}
                        </div>
                        <input
                          id="group-photo-upload"
                          type="file"
                          accept="image/*"
                          aria-label="Kies een nieuwe groepsfoto"
                          aria-describedby="group-photo-upload-status"
                          disabled={groupPhotoLoading}
                          style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadGroupPhoto(f); e.target.value = ''; }}
                        />
                      </>
                    )}
                  </label>
                  {isAdmin && (
                    <p id="group-photo-upload-status" className="sr-only" aria-live="polite">
                      {groupPhotoLoading
                        ? `Groepsfoto voor ${getConvName(activeConv)} wordt geupload.`
                        : activeConv.photoURL
                          ? `Kies een afbeelding om de groepsfoto voor ${getConvName(activeConv)} te wijzigen. Toegestane bestandssoorten zijn afbeeldingsbestanden.`
                          : `Kies een afbeelding om een groepsfoto toe te voegen voor ${getConvName(activeConv)}. Toegestane bestandssoorten zijn afbeeldingsbestanden.`}
                    </p>
                  )}
                  <h2 id="group-info-title" className="group-info-title">{getConvName(activeConv)}</h2>
                  <p id="group-info-description" className="group-info-subtitle">{activeConv.members.length} deelnemers</p>
                </div>
              );
            })()}
            {(() => {
              const isAdmin = activeConv.creatorId === user.uid;
              return (
                <>
                  <div role="list" className="group-info-member-list">
                    {activeConv.members.map(memberId => {
                      const name      = activeConv.memberNames?.[memberId] || memberId;
                      const isMe      = memberId === user.uid;
                      const isOnline  = onlineUsers.has(memberId);
                      const isCreator = memberId === activeConv.creatorId;
                      const photo     = contacts.find(c => c.uid === memberId)?.photoURL || null;
                      return (
                        <div key={memberId} role="listitem" className="search-result group-info-member-row" style={{ cursor: 'default' }}>
                          <div className="avatar-wrap">
                            <UserAvatar photoURL={photo} displayName={name} className="sm" decorative />
                            {isOnline && <span className="online-dot sm" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="conv-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {name}{isMe ? ' (jij)' : ''}
                              {isCreator && <span className="admin-badge"><AdminIcon size={11} aria-hidden="true" /> Beheerder</span>}
                            </div>
                            <div className="conv-preview" style={isOnline ? { color: 'var(--success)' } : {}}>
                              {isOnline ? 'Online' : 'Offline'}
                            </div>
                          </div>
                          {!isMe && isAdmin && (
                            <button type="button" className="group-info-remove-btn" aria-label={`Verwijder ${name} uit de groep`} title="Verwijderen uit groep"
                              onClick={() => removeMemberFromGroup(memberId)}
                            ><Delete size={18} aria-hidden="true" /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="group-info-add-btn"
                      aria-expanded="false"
                      aria-controls="group-add-member-list"
                      onClick={() => setAddingMember(true)}
                    >
                      <span aria-hidden="true">+</span> Lid toevoegen
                    </button>
                  ) : null}
                </>
              );
            })()}
              </>
            )}
            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="btn-secondary" onClick={() => { setShowGroupInfo(false); setAddingMember(false); }}>Sluiten</button>
            </div>
        </aside>
      )}

      {/* ── ACTIEF GESPREK OVERLAY ── */}
      {callsAvailable && activeCall && (
        <CallOverlay
          active={activeCall}
          user={user}
          onClose={() => setActiveCall(null)}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* ── DOORSTUREN PANEEL ── */}
      {forwardMsg && (
          <aside
            className="chat-side-panel forward-message-panel"
            aria-labelledby="forward-message-title"
            aria-describedby="forward-message-description"
          >
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setForwardMsg(null)}><span aria-hidden="true">✕</span></button>
            <h2 id="forward-message-title" className="modal-title"><span aria-hidden="true">↪️</span> Doorsturen naar…</h2>
            <div id="forward-message-description" className="forward-message-preview">
              {getMessageDisplayText(forwardMsg)}
            </div>
            <div className="forward-message-list">
              {conversations.filter(c => c.id !== activeConv?.id).map(conv => (
                <button key={conv.id} type="button" className="forward-message-row" onClick={() => forwardToConv(conv)}>
                  <UserAvatar photoURL={getConvPhoto(conv)} displayName={getConvName(conv)} className="sm" decorative />
                  <span>{getConvName(conv)}</span>
                </button>
              ))}
              {conversations.filter(c => c.id !== activeConv?.id).length === 0 && (
                <div className="group-info-empty" role="status">Geen andere gesprekken om naar door te sturen.</div>
              )}
            </div>
          </aside>
      )}

      {/* ── ERROR / INFO TOAST ── */}
      {errToast && (
        <div
          className="mention-toast"
          role="status"
          aria-live="polite"
          style={{ background: typeof errToast === 'object' ? errToast.bg : errToast.startsWith('📋') ? 'rgba(34,197,94,0.92)' : 'rgba(255,71,87,0.92)', display: 'flex', alignItems: 'center', gap: 7 }}
        >
          {typeof errToast === 'object' ? <>{errToast.icon}<span>{errToast.text}</span></> : <span>{errToast}</span>}
        </div>
      )}

      {/* ── MENTION TOAST ── */}
      {mentionToast && (
        <button
          type="button"
          className="mention-toast"
          role="status"
          aria-live="polite"
          onClick={() => {
            const conv = conversations?.find?.((item) => item.id === mentionToast.convId);
            if (conv) onOpenMentionConversation?.(conv);
          }}
          style={{ border: 0, cursor: mentionToast.convId ? 'pointer' : 'default' }}
        >
          <span className="mention-toast-icon" aria-hidden="true">@</span>
          <span><strong>{mentionToast.senderName}</strong> heeft je vermeld in <strong>{mentionToast.groupName}</strong></span>
        </button>
      )}

      {/* ── OUDER ACTIVITEIT TOAST ── */}
      {parentToast && (
        <div className="parent-toast" role="status" aria-live="polite">
          <span style={{ fontSize: 18 }} aria-hidden="true">❤️</span>
          <span>{parentToast.description}</span>
        </div>
      )}

      {/* ── AVATAR BUILDER ── */}
      {showAvatarBuilder && (
        <AvatarBuilder
          uid={user.uid}
          currentOptions={avatarOptions}
          currentPhotoURL={photoPreview}
          darkMode={true}
          onClose={() => setShowAvatarBuilder(false)}
          onSave={(photoURL, opts) => {
            setAvatarOptions(opts);
            setPhotoPreview(photoURL);
            localStorage.setItem(`pulse_photo_${user.uid}`, photoURL);
            setShowAvatarBuilder(false);
            setProfileMsg('Avatar opgeslagen!');
          }}
        />
      )}
    </>
  );
}
