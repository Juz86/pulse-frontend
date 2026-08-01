// src/components/ChatModals.js
import React, { useEffect, useState } from 'react';
import { Phone, Video, Camera, Delete, Trash2, Search, Users, Check, Cancel, MagicEdit, Share, Heart, AdminIcon, StarFilled, StarOutline, ArrowRight, Bell, BellOff, Block, Logout } from '../components/Icons';
import { ProfilePageHero, ProfilePageShell } from '../components/ProfilePageShell';
import { getInitials, formatTime } from '../utils';
import CallOverlay from '../components/CallOverlay';
import AvatarBuilder from '../components/AvatarBuilder';
import UserAvatar from '../components/UserAvatar';
import PulseConfirmSheet from '../components/PulseConfirmSheet';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';
import {
  PULSE_WEB_CALLS_UNAVAILABLE_HINT,
  PULSE_WEB_CALLS_UNAVAILABLE_MESSAGE,
  PULSE_WEB_CALLS_UNAVAILABLE_TITLE,
} from '../lib/platform/runtime';

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
  shareContactInSidebar = false,
  contacts, sendContactCard,
  getContactDisplayName,

  // shared contact profile
  viewingSharedContact, setViewingSharedContact,
  onlineUsers, inactiveUsers,
  friendReqLoading, friendReqSent,
  sendFriendRequestToEmail,

  // contact profile
  findConvWithUid, setConvLabel, convLabels,

  // confirm dialog
  confirmDialog, setConfirmDialog,

  // add contact
  addContactSheetInSidebar = false,
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
  friendRequestsSheetInSidebar = false,
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
  newGroupSheetInSidebar = false,
  showNewGroup, setShowNewGroup,
  groupName, setGroupName,
  groupMembers, toggleGroupMember, createGroup,

  // profile/avatar support
  photoPreview, setPhotoPreview,
  user,
  avatarOptions, setAvatarOptions,
  showAvatarBuilder, setShowAvatarBuilder,
  setProfileMsg,

  // contact profile modal (from chat header)
  showContactProfile, setShowContactProfile,
  contactProfileContact = null,
  setContactProfileContact,
  activeConv, getConvName, getOtherUid, getConvPhoto,
  setSharingContact: _sc,
  showStarredMsgs, setShowStarredMsgs,
  starredMsgs, messages, onJumpToMsg,
  onInitiateCall,
  onToggleConversationMute,
  onEnterMessageSelection,
  onLeaveGroup,
  onClearChat,
  onDeleteChat,
  onBlockContact,
  onRemoveContact,
  showChatSearch = false,
  setShowChatSearch,
  onOpenConversationSearch,
  onOpenConversationStarred,
  conversationMuted = false,
  messageSelectionMode = false,
  newChatSheetInSidebar = false,
  callSheetInSidebar = false,

  // call modal
  showCallModal, setShowCallModal,
  callContact, callContactFromRecent, getCallLog, refreshCallLog, clearCallLog, callLogRateLimitUntil = 0,

  // group info
  showGroupInfo, setShowGroupInfo,
  addingMember, setAddingMember,
  groupPhotoLoading, uploadGroupPhoto,
  removeMemberFromGroup, addMemberToGroup, renameGroup, promoteGroupAdmin, relinquishGroupAdmin,

  // call overlay
  activeCall, setActiveCall,
  unreadCounts = {},

  // forward
  forwardMsg, setForwardMsg,
  conversations, forwardToConv,

  // toasts
  errToast, dismissErrToast, mentionToast, dismissMentionToast, parentToast, dismissParentToast,
  onOpenMentionConversation,

  // blocked contacts
  blockedContacts, parentBlockedUids, unblockContact,

  // helpers
  callsAvailable = true,
}) {
  const [starredSearch,   setStarredSearch]   = useState('');
  const [requestsTab,     setRequestsTab]     = useState('ontvangen');
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [showAdminPicker, setShowAdminPicker] = useState(false);
  const [callSearch, setCallSearch] = useState('');
  const [callActionMode, setCallActionMode] = useState(null); // 'voice' | null
  const [callLogStatusNow, setCallLogStatusNow] = useState(() => Date.now());
  const [confirmCheckboxChecked, setConfirmCheckboxChecked] = useState(false);
  const isGroupAdmin = (conversation, uid) => (
    Array.isArray(conversation?.adminIds)
      ? conversation.adminIds.includes(uid)
      : conversation?.creatorId === uid
  );
  const isGroupInfoAdmin = activeConv?.isGroup && isGroupAdmin(activeConv, user?.uid);
  const hasPromotableGroupMember = activeConv?.members?.some((memberId) => memberId !== user?.uid && !isGroupAdmin(activeConv, memberId));

  function closeGroupInfo() {
    setEditingGroupName(false);
    setGroupNameDraft('');
    setShowAdminPicker(false);
    setShowGroupInfo(false);
    setAddingMember(false);
  }

  function editOrSaveGroupName() {
    if (!editingGroupName) {
      setGroupNameDraft(getConvName(activeConv));
      setEditingGroupName(true);
      return;
    }
    if (!groupNameDraft.trim()) return;
    renameGroup?.(groupNameDraft);
    setEditingGroupName(false);
  }
  useEffect(() => {
    if (!confirmDialog) {
      setConfirmCheckboxChecked(false);
      return;
    }
    setConfirmCheckboxChecked(Boolean(confirmDialog.checkboxDefault));
  }, [confirmDialog]);

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
      }, 20000);
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

  useEffect(() => {
    if (!showCallModal || !callsAvailable) return undefined;
    if (Number(callLogRateLimitUntil || 0) <= Date.now()) return undefined;
    setCallLogStatusNow(Date.now());
    const timerId = setInterval(() => {
      setCallLogStatusNow(Date.now());
    }, 1000);
    return () => clearInterval(timerId);
  }, [showCallModal, callsAvailable, callLogRateLimitUntil]);


  function openStarredFromProfile(contact) {
    setShowContactProfile(false);
    const conversation = contact?.uid ? findConvWithUid?.(contact.uid) : null;
    if (conversation) {
      onOpenConversationStarred?.(conversation);
      return;
    }
    setShowStarredMsgs(true);
  }

  function openChatSearchFromProfile(contact) {
    setShowContactProfile(false);
    const conversation = contact?.uid ? findConvWithUid?.(contact.uid) : null;
    if (conversation) {
      onOpenConversationSearch?.(conversation);
      return;
    }
    setShowChatSearch?.(true);
  }

  function openSelectionFromProfile() {
    setShowContactProfile(false);
    onEnterMessageSelection?.();
  }

  function toggleMuteFromProfile() {
    onToggleConversationMute?.();
  }

  function openGroupMessageSelection() {
    setShowGroupInfo(false);
    onEnterMessageSelection?.();
  }

  function openGroupStarredMessages() {
    setShowGroupInfo(false);
    setShowStarredMsgs(true);
  }

  function openGroupChatSearch() {
    setShowGroupInfo(false);
    onOpenConversationSearch?.(activeConv);
  }

  function leaveCurrentGroup() {
    setShowGroupInfo(false);
    onLeaveGroup?.(activeConv);
  }

  function clearChatFromProfile() {
    setShowContactProfile(false);
    onClearChat?.();
  }

  function deleteChatFromProfile() {
    setShowContactProfile(false);
    onDeleteChat?.();
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
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--rename-contact"
          onClick={() => setRenamingContact(null)}
        >
          <aside
            className="pulse-sheet pulse-sheet--rename-contact rename-contact-panel"
            aria-labelledby="rename-contact-title"
            aria-describedby="rename-contact-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--rename-contact">
              <div id="rename-contact-title" className="pulse-sheet-title pulse-sheet-title--rename-contact">Naam wijzigen</div>
              <button type="button" className="pulse-sheet-close pulse-sheet-close--rename-contact" aria-label="Sluiten" onClick={() => setRenamingContact(null)}><span aria-hidden="true">✕</span></button>
            </div>
            <p id="rename-contact-description" className="new-chat-sheet-sub">Wijzig de bijnaam van deze contactpersoon binnen dezelfde Pulse sheet-stijl.</p>
            <div className="new-chat-sheet-section">
              <div className="new-chat-sheet-kicker">Bijnaam</div>
              <div className="sheet-input-wrap">
                <input
                  className="form-input sheet-form-input"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  placeholder={renamingContact.displayName}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { saveContactNickname(renamingContact.uid, renameValue); setRenamingContact(null); setContacts(prev => [...prev]); } }}
                />
              </div>
            </div>
            <div className="modal-actions add-contact-sheet-actions">
              <button type="button" className="btn-secondary" onClick={() => setRenamingContact(null)}>Sluiten</button>
              <button type="button" className="btn-primary" onClick={() => { saveContactNickname(renamingContact.uid, renameValue); setRenamingContact(null); setContacts(prev => [...prev]); }}>Opslaan</button>
            </div>
          </aside>
        </div>
      )}

      {/* ── CONTACTPERSOON DELEN ── */}
      {sharingContact && !shareContactInSidebar && (
        <PulseConfirmSheet
          title="Contactpersoon delen"
          onClose={() => { setSharingContact(null); setShareRecipients([]); }}
          actions={[
            {
              label: `Versturen${shareRecipients.length > 1 ? ` (${shareRecipients.length})` : ''}`,
              tone: 'primary',
              disabled: shareRecipients.length === 0,
              onSelect: () => {
                if (shareRecipients.length === 0) return;
                shareRecipients.forEach(uid => {
                  const contact = contacts.find(item => item.uid === uid);
                  if (contact) sendContactCard(contact, sharingContact);
                });
                setSharingContact(null);
                setShareRecipients([]);
              },
            },
          ]}
        >
          <div className="share-contact-sheet-body">
              <div className="new-chat-sheet-section">
                <div className="new-chat-sheet-kicker">Te delen contact</div>
                <div className="share-contact-selected-card">
                  <div className="avatar sm">{getInitials(getContactDisplayName(sharingContact))}</div>
                  <div className="share-contact-selected-copy">
                    <div className="share-contact-title-responsive">{getContactDisplayName(sharingContact)}</div>
                    <div className="conv-preview">{sharingContact.email}</div>
                  </div>
                </div>
              </div>
              <div className="new-chat-sheet-section">
                <div className="new-chat-sheet-kicker">Stuur naar</div>
                <div className="pulse-sheet-list pulse-sheet-list--new-chat share-contact-list">
                  {contacts.filter(c => c.uid !== sharingContact.uid).map(c => {
                    const selected = shareRecipients.includes(c.uid);
                    return (
                      <button key={c.uid} type="button" className={`search-result new-chat-sheet-result share-contact-row${selected ? ' selected' : ''}`}
                        onClick={() => setShareRecipients(prev => prev.includes(c.uid) ? prev.filter(id => id !== c.uid) : [...prev, c.uid])}>
                        <div className="avatar sm">{getInitials(getContactDisplayName(c))}</div>
                        <div className="share-contact-selected-copy">
                          <div className="conv-name share-contact-title-responsive">{getContactDisplayName(c)}</div>
                          <div className="conv-preview">{c.email}</div>
                        </div>
                        {selected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>}
                      </button>
                    );
                  })}
                </div>
              </div>
          </div>
        </PulseConfirmSheet>
      )}

      {/* ── VRIENDSCHAPSVERZOEKEN ── */}
      {showFriendRequestsPanel && !friendRequestsSheetInSidebar && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--friend-requests"
          onClick={() => setShowFriendRequestsPanel(false)}
        >
          <aside
            className="pulse-sheet pulse-sheet--friend-requests"
            aria-labelledby="friend-requests-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--friend-requests">
              <div id="friend-requests-title" className="pulse-sheet-title pulse-sheet-title--friend-requests">Verzoeken</div>
              <button
                type="button"
                className="pulse-sheet-close pulse-sheet-close--friend-requests"
                aria-label="Sluiten"
                onClick={() => setShowFriendRequestsPanel(false)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="friend-requests-sheet-body">
              <p className="new-chat-sheet-sub">
                Beheer binnenkomende en verstuurde vriendschapsverzoeken.
              </p>

              <div className="new-chat-sheet-section">
                <div className="new-chat-sheet-kicker">Tabblad</div>
                <div className="friend-requests-tabs">
                  <button type="button" onClick={() => setRequestsTab('ontvangen')} className={requestsTab === 'ontvangen' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, minWidth: 0 }}>
                    Ontvangen
                    {friendRequests.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800 }}>{friendRequests.length}</span>}
                  </button>
                  <button type="button" onClick={() => setRequestsTab('verstuurd')} className={requestsTab === 'verstuurd' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, minWidth: 0 }}>
                    Verstuurd
                    {sentFriendRequests.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800 }}>{sentFriendRequests.length}</span>}
                  </button>
                </div>
              </div>

              <div className="new-chat-sheet-section">
                <div className="new-chat-sheet-kicker">
                  {requestsTab === 'ontvangen' ? 'Ontvangen verzoeken' : 'Verstuurde verzoeken'}
                </div>
                <div className="pulse-sheet-list pulse-sheet-list--new-chat friend-requests-list">
                {requestsTab === 'ontvangen' && (
                  <>
                    {friendRequests.map(req => (
                      <div key={req.id} className="friend-request-row">
                        <div className="avatar-circle sm" aria-hidden="true">{getInitials(req.fromName)}</div>
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
                        <div key={requestId || req.toUid || req.toEmail} className="friend-request-row friend-request-row--stacked">
                          <div className="friend-request-row-top">
                            <div className="avatar-circle sm" aria-hidden="true">{getInitials(req.toEmail || req.toUid)}</div>
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
                      <div className="empty-convs" style={{ paddingTop: 10, paddingBottom: 10 }}>
                        <p>Geen verstuurde vriendschapsverzoeken.</p>
                      </div>
                    )}
                  </>
                )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── GEDEELD CONTACT PROFIEL ── */}
      {viewingSharedContact && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--shared-contact"
          onClick={() => setViewingSharedContact(null)}
        >
          <aside
            className="pulse-sheet pulse-sheet--shared-contact shared-contact-panel contact-profile-panel"
            aria-labelledby="shared-contact-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--shared-contact">
              <div className="pulse-sheet-title pulse-sheet-title--shared-contact">Profiel</div>
              <button
                type="button"
                className="pulse-sheet-close pulse-sheet-close--shared-contact"
                aria-label="Profiel sluiten"
                onClick={() => setViewingSharedContact(null)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="contact-profile-hero shared-contact-hero">
              <div className="contact-profile-avatar-shell">
                <div className="profile-avatar-big contact-profile-avatar">{getInitials(viewingSharedContact.name || '')}</div>
              </div>
              <div id="shared-contact-title" className="contact-profile-name">{viewingSharedContact.name || 'Onbekend contact'}</div>
              {viewingSharedContact.email && <div className="contact-profile-subtitle">{viewingSharedContact.email}</div>}
              <div className={`profile-status-badge contact-profile-status ${viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid) && !inactiveUsers.has(viewingSharedContact.uid) ? 'online' : viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid) ? 'inactive' : 'offline'}`}>
                <span className="profile-status-dot" />
                {viewingSharedContact.uid && onlineUsers.has(viewingSharedContact.uid)
                  ? inactiveUsers.has(viewingSharedContact.uid) ? 'Afwezig' : 'Online'
                  : 'Offline'}
              </div>
            </div>

            <section className="contact-profile-card shared-contact-card">
              <div className="contact-profile-field">
                <span className="contact-profile-field-label">Naam</span>
                <div className="contact-profile-field-value">{viewingSharedContact.name || 'Onbekend contact'}</div>
              </div>
              {viewingSharedContact.email && (
                <div className="contact-profile-field">
                  <span className="contact-profile-field-label">E-mailadres</span>
                  <div className="contact-profile-field-value">{viewingSharedContact.email}</div>
                </div>
              )}
            </section>

            <section className="contact-profile-card shared-contact-card">
              <div className="shared-contact-panel-note">
                {viewingSharedContact.isAlreadyContact
                  ? 'Dit gedeelde contact staat al in je contactenlijst.'
                  : 'Voeg deze contactpersoon toe om direct te kunnen chatten, bellen of videobellen in Pulse.'}
              </div>
              <div className="shared-contact-panel-actions">
                <button type="button" className="btn-secondary shared-contact-panel-close" onClick={() => setViewingSharedContact(null)}>
                  Sluiten
                </button>
                {viewingSharedContact.isAlreadyContact ? (
                  <div className="shared-contact-panel-badge" role="status" aria-live="polite">
                    <Check size={16} aria-hidden="true" />
                    <span>Al in contacten</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-primary shared-contact-panel-primary"
                    disabled={friendReqLoading || friendReqSent || !viewingSharedContact.email}
                    onClick={() => sendFriendRequestToEmail(viewingSharedContact.email)}
                  >
                    {friendReqSent ? 'Vriendschapsverzoek verzonden' : friendReqLoading ? 'Verzenden…' : 'Vriendschapsverzoek sturen'}
                  </button>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* ── BEVESTIGINGSDIALOOG ── */}
      {confirmDialog && (
        <PulseConfirmSheet
          title={confirmDialog.title || 'Bevestiging'}
          description={confirmDialog.message}
          dismissible={!confirmDialog.hideClose}
          onClose={() => setConfirmDialog(null)}
          actions={[
            !confirmDialog.hideCancel && {
              label: confirmDialog.cancelLabel || 'Annuleren',
              tone: 'neutral',
              icon: confirmDialog.cancelIcon === 'cancel' ? Cancel : undefined,
              onSelect: () => {
                confirmDialog.onCancel?.();
                setConfirmDialog(null);
              },
            },
            {
              label: confirmDialog.confirmLabel || 'Verwijderen',
              tone: confirmDialog.type === 'admin-promotion' ? 'primary' : 'danger',
              icon: confirmDialog.confirmIcon === 'trash' ? Delete : confirmDialog.confirmIcon === 'logout' ? Logout : confirmDialog.confirmIcon === 'check' ? Check : undefined,
              onSelect: () => {
                confirmDialog.onConfirm?.({ keepStarred: confirmCheckboxChecked });
                setConfirmDialog(null);
              },
            },
          ]}
        >
          {confirmDialog.type === 'clear-chat' && confirmDialog.checkboxLabel && (
              <label className="confirm-dialog-checkbox-row">
                <input
                  type="checkbox"
                  checked={confirmCheckboxChecked}
                  onChange={(event) => setConfirmCheckboxChecked(event.target.checked)}
                />
                <span>{confirmDialog.checkboxLabel}</span>
              </label>
          )}
        </PulseConfirmSheet>
      )}

      {/* ── CONTACT TOEVOEGEN MODAL ── */}
      {showAddContact && !addContactSheetInSidebar && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--add-contact"
          onClick={() => { setShowAddContact(false); setContactEmail(''); setContactNickname(''); setContactRelation(null); clearPendingFriendRequestState(); }}
        >
          <aside
            className="pulse-sheet pulse-sheet--add-contact"
            aria-labelledby="add-contact-title"
            aria-describedby="add-contact-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--add-contact">
              <div className="pulse-sheet-title pulse-sheet-title--add-contact">Nieuw contact</div>
              <button
                type="button"
                className="pulse-sheet-close pulse-sheet-close--add-contact"
                aria-label="Sluiten"
                onClick={() => { setShowAddContact(false); setContactEmail(''); setContactNickname(''); setContactRelation(null); clearPendingFriendRequestState(); }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="add-contact-sheet-body">
              <p id="add-contact-description" className="new-chat-sheet-sub">
                Voeg familie en vrienden toe via e-mailadres of naam<code>@pulse.internal</code>.
              </p>
              <div className="new-chat-sheet-section">
                <div className="new-chat-sheet-kicker">E-mailadres of naam@pulse.internal</div>
                <div className="sheet-input-wrap">
                  <input className="form-input sheet-form-input" placeholder="naam@voorbeeld.nl, kind@pulse.internal of gebruikersnaam" value={contactEmail} onChange={e => { setContactEmail(e.target.value); clearPendingFriendRequestState(); }} onKeyDown={e => e.key === 'Enter' && addContact()} />
                </div>
              </div>
              <div className="new-chat-sheet-section">
                <div className="new-chat-sheet-kicker">Relatie</div>
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
              <div className="modal-actions add-contact-sheet-actions">
                <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={addContact} disabled={contactLoading}>{contactLoading ? 'Verzenden…' : 'Verzoek sturen'}</button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── NIEUW GESPREK PANEEL ── */}
      {showNewChat && !newChatSheetInSidebar && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--new-chat"
          onClick={() => { setShowNewChat(false); setSearchEmail(''); }}
        >
          <aside
            className="pulse-sheet pulse-sheet--new-chat"
            aria-labelledby="new-chat-title"
            aria-describedby="new-chat-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--new-chat">
              <div className="pulse-sheet-title pulse-sheet-title--new-chat">Nieuwe chat</div>
              <button
                type="button"
                className="pulse-sheet-close pulse-sheet-close--new-chat"
                aria-label="Sluiten"
                onClick={() => { setShowNewChat(false); setSearchEmail(''); }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

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
                    onChange={e => setSearchEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchUser()}
                  />
                </div>
              </div>

              {searchErr && <div className="auth-error" style={{ marginBottom: 14 }}>⚠️ {searchErr}</div>}

              {searchResult && (
                <div className="new-chat-sheet-section">
                  <div className="new-chat-sheet-kicker">Zoekresultaat</div>
                  <div className="pulse-sheet-list pulse-sheet-list--new-chat">
                    <button type="button" className="search-result new-chat-sheet-result" onClick={() => startConversationWith(searchResult)}>
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
                    {filteredNewChatContacts.map(c => (
                      <button key={c.uid} type="button" className="search-result new-chat-sheet-result" onClick={() => startConversationWith(c)}>
                        <UserAvatar photoURL={c.photoURL} displayName={c.displayName} className="sm" decorative />
                        <div>
                          <div className="conv-name">{getContactDisplayName(c)}</div>
                          <div className="conv-preview">{c.email}</div>
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
          </aside>
        </div>
      )}

      {/* ── GROEP AANMAKEN PANEEL ── */}
      {showNewGroup && !newGroupSheetInSidebar && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--new-group"
          onClick={() => { setShowNewGroup(false); setGroupName(''); }}
        >
          <aside
            className="pulse-sheet pulse-sheet--new-group"
            aria-labelledby="new-group-title"
            aria-describedby="new-group-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--new-group">
              <div className="pulse-sheet-title pulse-sheet-title--new-group">Nieuwe groep</div>
              <button
                type="button"
                className="pulse-sheet-close pulse-sheet-close--new-group"
                aria-label="Sluiten"
                onClick={() => { setShowNewGroup(false); setGroupName(''); }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="new-group-sheet-body">
              <p id="new-group-description" className="new-chat-sheet-sub">
                Start een groepsgesprek met familie en vrienden.
              </p>
              <div className="new-chat-sheet-section">
                <div className="new-chat-sheet-kicker">Groepsnaam</div>
                <div className="sheet-input-wrap">
                  <input className="form-input sheet-form-input" placeholder="Bijv. Familie, Werk…" value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={50} />
                </div>
              </div>
              <div className="new-chat-sheet-section">
                <div className="new-chat-sheet-kicker">Kies deelnemers</div>
                {contacts.length === 0 && <div className="auth-error">⚠️ Voeg eerst contacten toe.</div>}
                <div className="pulse-sheet-list pulse-sheet-list--new-chat new-group-contact-list">
                  {contacts.map(c => {
                    const selected = groupMembers.find(m => m.uid === c.uid);
                    const contactTitle = getContactDisplayName(c)
                      || c.displayName
                      || c.username
                      || (c.email ? c.email.split('@')[0] : '')
                      || 'Contactpersoon';
                    return (
                      <button key={c.uid} type="button" className={`search-result new-chat-sheet-result new-group-sheet-result${selected ? ' selected' : ''}`} onClick={() => toggleGroupMember(c)}>
                        <UserAvatar photoURL={c.photoURL} displayName={contactTitle} className="sm" decorative />
                        <div className="new-group-sheet-result-copy"><div className="conv-name">{contactTitle}</div><div className="conv-preview">{c.email}</div></div>
                        {selected
                          ? <span className="new-group-sheet-check new-group-sheet-check--selected"><Check size={14} color="#fff" /></span>
                          : <span className="new-group-sheet-check" />
                        }
                      </button>
                    );
                  })}
                </div>
              </div>
              {groupMembers.length > 0 && <p className="new-chat-sheet-sub">{groupMembers.length} deelnemer(s) geselecteerd</p>}
              <div className="modal-actions add-contact-sheet-actions">
                <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={createGroup} disabled={!groupName.trim() || groupMembers.length === 0}>Groep aanmaken</button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── CONTACTPROFIEL PANEEL ── */}
      {showContactProfile && !sharingContact && (() => {
        const targetContact = contactProfileContact || (activeConv && !activeConv.isGroup ? {
          uid: getOtherUid(activeConv),
          displayName: getConvName(activeConv),
          email: activeConv.memberEmails?.[getOtherUid(activeConv)] || contacts.find(c => c.uid === getOtherUid(activeConv))?.email || '',
          photoURL: getConvPhoto(activeConv),
        } : null);
        if (!targetContact) return null;
        const targetConv = targetContact?.uid ? findConvWithUid?.(targetContact.uid) : null;
        const uid       = targetContact.uid;
        const isBlocked = (blockedContacts || []).some((blockedContact) => blockedContact.uid === uid);
        const name      = targetContact.displayName || targetContact.name || targetContact.email || 'Contact';
        const email     = targetContact.email || '';
        const photo     = targetContact.photoURL || null;
        const isOnline  = uid && onlineUsers.has(uid);
        const isInactive = uid && inactiveUsers.has(uid);
        const relationLabel = targetConv?.id ? convLabels[targetConv.id] : targetContact.relation;
        const statusLabel = isOnline && !isInactive ? 'Online' : isOnline && isInactive ? 'Afwezig' : 'Offline';
        return (
            <ProfilePageShell
              titleId="contact-profile-title"
              title="Profiel"
              description={`Bekijk en bewerk de profielgegevens van ${name}.`}
              onBack={() => { setShowContactProfile(false); setContactProfileContact?.(null); }}
              backLabel="Profiel sluiten"
              headerAction={(
                <button
                  type="button"
                  className="contact-profile-edit-btn"
                  aria-label={`Bewerk ${name}`}
                  onClick={() => document.querySelector('.contact-profile-name-input')?.focus()}
                >
                  Bewerk
                </button>
              )}
              hero={(
                <ProfilePageHero
                  className="contact-profile-hero contact-profile-hero--main"
                  avatar={photo
                    ? <img src={photo} alt={name || 'Profielfoto'} className="profile-avatar-big contact-profile-avatar" style={{ objectFit: 'cover' }} loading="lazy" />
                    : <div className="profile-avatar-big contact-profile-avatar">{getInitials(name)}</div>
                  }
                  name={name}
                  subtitle={email || null}
                  status={(
                    <div className="contact-profile-status-row">
                      <div className={`profile-status-badge contact-profile-status ${isOnline && !isInactive ? 'online' : isOnline && isInactive ? 'inactive' : 'offline'}`}>
                        <span className="profile-status-dot" />
                        {statusLabel}
                      </div>
                      <div className="contact-profile-status-actions">
                        <button type="button" className="icon-btn contact-profile-status-action" aria-label={`Open berichten met ster van ${name}`} title="Berichten met ster" onClick={() => openStarredFromProfile(targetContact)}>
                          <StarFilled size={18} style={{ color: '#f59e0b' }} aria-hidden="true" />
                        </button>
                        <button type="button" className="icon-btn contact-profile-status-action" aria-label={`Deel contactpersoon ${name}`} onClick={() => { const c = contacts.find(c => c.uid === uid); if (c) setSharingContact(c); }} title="Contactpersoon delen">
                          <Share size={18} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                />
              )}
            >

              <div className="contact-profile-quick-actions">
                <button type="button" className="contact-profile-quick-card" onClick={() => (contactProfileContact ? callContact?.(targetContact, false) : onInitiateCall?.(false))}>
                  <span className="contact-profile-quick-icon"><Phone size={24} aria-hidden="true" /></span>
                  <span>Audio</span>
                </button>
                <button type="button" className="contact-profile-quick-card" onClick={() => (contactProfileContact ? callContact?.(targetContact, true) : onInitiateCall?.(true))}>
                  <span className="contact-profile-quick-icon"><Video size={24} aria-hidden="true" /></span>
                  <span>Video</span>
                </button>
                <button type="button" className="contact-profile-quick-card" onClick={() => openChatSearchFromProfile(targetContact)}>
                  <span className="contact-profile-quick-icon"><Search size={24} aria-hidden="true" /></span>
                  <span>Zoek</span>
                </button>
              </div>

              <section className="contact-profile-card contact-profile-card--profile-meta">
                <div className="contact-profile-field">
                  <span className="contact-profile-field-label">Naam</span>
                  <div className="contact-profile-name-edit">
                    <input className="form-input contact-profile-name-input" value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder={name} />
                    <span className="contact-profile-field-icon" aria-hidden="true"><MagicEdit size={18} /></span>
                  </div>
                </div>
                {email && (
                  <div className="contact-profile-field">
                    <span className="contact-profile-field-label">E-mailadres</span>
                    <div className="contact-profile-field-value">{email}</div>
                  </div>
                )}
                <div className="contact-profile-field">
                    <span className="contact-profile-field-label">Relatie</span>
                  <div className="label-chip-row contact-profile-chip-row contact-profile-chip-row--profile">
                      {['familie', 'vrienden'].map(lbl => (
                      <button key={lbl} type="button" disabled={!targetConv?.id} onClick={() => targetConv?.id && setConvLabel(targetConv.id, relationLabel === lbl ? null : lbl)}
                        className={`label-chip${relationLabel === lbl ? ' active' : ''}`}>
                        {lbl === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" className="btn-primary contact-profile-save-btn" onClick={() => { saveContactNickname(uid, renameValue); setContacts(prev => [...prev]); setShowContactProfile(false); }}>Opslaan</button>
              </section>

              <section className="contact-profile-card contact-profile-card--profile-actions">
                <button type="button" className={`contact-profile-row-button${conversationMuted ? ' danger' : ''}`} onClick={toggleMuteFromProfile}>
                  <span className="contact-profile-row-icon">{conversationMuted ? <BellOff size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}</span>
                  <span className="contact-profile-row-copy">
                    <span className="contact-profile-row-title">Meldingen {conversationMuted ? 'uit' : 'aan'}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="contact-profile-row-arrow" />
                </button>
                <button type="button" className="contact-profile-row-button" onClick={openSelectionFromProfile}>
                  <span className="contact-profile-row-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h10v2H4v-2z" />
                    </svg>
                  </span>
                  <span className="contact-profile-row-copy">
                    <span className="contact-profile-row-title">{messageSelectionMode ? 'Berichten selecteren stoppen' : 'Berichten selecteren'}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="contact-profile-row-arrow" />
                </button>
                <button type="button" className="contact-profile-row-button" onClick={openStarredFromProfile}>
                  <span className="contact-profile-row-icon"><StarOutline size={20} aria-hidden="true" /></span>
                  <span className="contact-profile-row-copy">
                    <span className="contact-profile-row-title">Berichten met ster</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="contact-profile-row-arrow" />
                </button>
                <button type="button" className="contact-profile-row-button" onClick={() => openChatSearchFromProfile(targetContact)}>
                  <span className="contact-profile-row-icon"><Search size={20} aria-hidden="true" /></span>
                  <span className="contact-profile-row-copy">
                    <span className="contact-profile-row-title">{showChatSearch ? 'Zoeken openen' : 'Zoeken'}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="contact-profile-row-arrow" />
                </button>
              </section>

              <section className="contact-profile-card contact-profile-card-danger contact-profile-card--profile-danger">
                <button type="button" className="contact-profile-row-button danger" onClick={clearChatFromProfile}>
                  <span className="contact-profile-row-icon"><Delete size={20} aria-hidden="true" /></span>
                  <span className="contact-profile-row-copy">
                    <span className="contact-profile-row-title">Chat wissen</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="contact-profile-row-arrow" />
                </button>
                <button type="button" className="contact-profile-row-button danger" onClick={deleteChatFromProfile}>
                  <span className="contact-profile-row-icon"><Trash2 size={20} aria-hidden="true" /></span>
                  <span className="contact-profile-row-copy">
                    <span className="contact-profile-row-title">Chat verwijderen</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="contact-profile-row-arrow" />
                </button>
              </section>

              <section className="contact-profile-card contact-profile-card-danger contact-profile-card--profile-danger">
                <button type="button" className={`contact-profile-row-button${isBlocked ? '' : ' danger'}`} onClick={() => (isBlocked ? unblockContact?.(uid) : onBlockContact?.(targetContact))}>
                  <span className="contact-profile-row-icon"><Block size={20} aria-hidden="true" /></span>
                  <span className="contact-profile-row-copy">
                    <span className="contact-profile-row-title">{isBlocked ? 'Deblokkeren' : 'Blokkeren'}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="contact-profile-row-arrow" />
                </button>
                <button type="button" className="contact-profile-row-button danger" onClick={() => onRemoveContact?.(uid)}>
                  <span className="contact-profile-row-icon"><Trash2 size={20} aria-hidden="true" /></span>
                  <span className="contact-profile-row-copy">
                    <span className="contact-profile-row-title">Verwijderen</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="contact-profile-row-arrow" />
                </button>
              </section>

            </ProfilePageShell>
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
          <div
            className="pulse-sheet-backdrop pulse-sheet-backdrop--starred"
            onClick={() => { setShowStarredMsgs(false); setStarredSearch(''); }}
          >
            <aside
              className="pulse-sheet pulse-sheet--starred"
              aria-labelledby="starred-messages-title"
              aria-describedby="starred-messages-description"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pulse-sheet-handle" aria-hidden="true" />
              <div className="pulse-sheet-header pulse-sheet-header--starred">
                <div id="starred-messages-title" className="pulse-sheet-title pulse-sheet-title--starred">
                  Berichten met ster
                </div>
                <button type="button" className="pulse-sheet-close pulse-sheet-close--starred" aria-label="Berichten met ster sluiten" onClick={() => { setShowStarredMsgs(false); setStarredSearch(''); }}><span aria-hidden="true">✕</span></button>
              </div>
              <p id="starred-messages-description" className="sr-only">
                Bekijk en doorzoek berichten met ster uit het actieve gesprek.
              </p>
              <div className="starred-sheet-body">
                <p className="new-chat-sheet-sub">
                  Doorzoek belangrijke opgeslagen berichten in dezelfde rustige Pulse sheet-stijl.
                </p>
                <div className="new-chat-sheet-section">
                  <div className="new-chat-sheet-kicker">Zoeken</div>
                  <div className="starred-search-wrap call-log-search-wrap call-log-search-wrap--full">
                    <Search size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
                    <input
                      className="starred-search-input"
                      placeholder="Zoek in berichten met ster…"
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
                </div>
                <div className="new-chat-sheet-section">
                  <div className="new-chat-sheet-kicker">Opgeslagen berichten</div>
                  {starred.length === 0 ? (
                    <div className="starred-empty-state">
                      <StarFilled size={36} style={{ opacity: .3, color: '#f59e0b', marginBottom: 8 }} aria-hidden="true" />
                      <div style={{ fontSize: 14 }}>{q ? 'Geen resultaten' : 'Nog geen berichten met ster'}</div>
                    </div>
                  ) : (
                    <div className="pulse-sheet-list pulse-sheet-list--new-chat starred-list">
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
                </div>
              </div>
            </aside>
          </div>
        );
      })()}

      {/* ── OPROEPEN PANEEL ── */}
      {showCallModal && !callSheetInSidebar && (() => {
        const callLog = getCallLog();
        const remainingRateLimitMs = Math.max(0, Number(callLogRateLimitUntil || 0) - callLogStatusNow);
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
          ? contacts.filter((c) => {
              const displayName = (getContactDisplayName(c) || c.displayName || '').toLowerCase();
              const email = (c.email || '').toLowerCase();
              return displayName.includes(normalizedCallSearch) || email.includes(normalizedCallSearch);
            })
          : contacts;
        const closeCallSheet = () => {
          setShowCallModal(false);
          setCallActionMode(null);
          setCallSearch('');
        };
        return (
          <div
            className="pulse-sheet-backdrop pulse-sheet-backdrop--call-log"
            onClick={closeCallSheet}
          >
            <aside
              className="pulse-sheet pulse-sheet--call-log"
              aria-labelledby="call-log-title"
              aria-describedby="call-log-description"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pulse-sheet-handle" aria-hidden="true" />
              <div className="pulse-sheet-header pulse-sheet-header--call-log">
                <div className="pulse-sheet-title pulse-sheet-title--call-log">{callsAvailable ? 'Recent' : 'Alleen in de app'}</div>
                <button
                  type="button"
                  className="pulse-sheet-close pulse-sheet-close--call-log"
                  aria-label="Sluiten"
                  onClick={closeCallSheet}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <p id="call-log-description" className="sr-only">
                {callsAvailable
                  ? 'Bekijk recente oproepen en start een nieuwe bel- of video-oproep.'
                  : 'Bellen en videobellen zijn in Pulse Web niet beschikbaar.'}
              </p>
              <div className="call-log-sheet-body">
              {!callsAvailable ? (
                <div className="call-panel-note">
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{PULSE_WEB_CALLS_UNAVAILABLE_TITLE}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{PULSE_WEB_CALLS_UNAVAILABLE_MESSAGE}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>{PULSE_WEB_CALLS_UNAVAILABLE_HINT}</div>
                </div>
              ) : (
                <>
                  <div className="call-log-toolbar">
                    <div
                      className="starred-search-wrap call-log-search-wrap call-log-search-wrap--full"
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
                            <div
                              key={contact.uid}
                              className="call-log-picker-row"
                            >
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
                                  onClick={() => (callContactFromRecent || callContact)(contact, false)}
                                >
                                  <Phone size={14} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="call-btn video"
                                  aria-label={`Videobel ${contactTitle}`}
                                  title="Videobellen"
                                  onClick={() => (callContactFromRecent || callContact)(contact, true)}
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
                        {filteredCallLog.map((entry, i) => {
                          const contact = contacts.find(c => c.uid === entry.uid);
                          const CallTypeIcon = entry.isVideo ? Video : Phone;
                          const displayTime = formatTime(entry.ts);
                          return (
                            <div key={i} className="call-log-row">
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
            </div>
          </aside>
        </div>
        );
      })()}

      {/* ── GROEPSINFORMATIE PANEEL ── */}
      {showGroupInfo && activeConv?.isGroup && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--group-info"
          onClick={closeGroupInfo}
        >
        <aside
          className="pulse-sheet pulse-sheet--group-info group-info-panel"
          aria-labelledby="group-info-title"
          aria-describedby="group-info-description"
          onClick={(e) => e.stopPropagation()}
        >
            <div className="contact-profile-topbar group-info-topbar">
              <button type="button" className="contact-profile-nav-btn" aria-label="Terug" title="Terug" onClick={closeGroupInfo}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <h2 id="group-info-title" className="contact-profile-heading">Groepsinfo</h2>
              {isGroupInfoAdmin ? (
                <button type="button" className="contact-profile-edit-btn" onClick={editOrSaveGroupName} disabled={editingGroupName && !groupNameDraft.trim()}>
                  {editingGroupName ? 'Opslaan' : 'Bewerk'}
                </button>
              ) : <span className="contact-profile-topbar-spacer" aria-hidden="true" />}
            </div>
            <div className="group-info-content">
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
                  <div className="starred-search-wrap call-log-search-wrap call-log-search-wrap--full group-info-search-wrap">
                    <Search size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
                    <input
                      id="group-member-search"
                      className="starred-search-input group-info-search"
                      type="search"
                      value={groupMemberSearch}
                      onChange={(e) => setGroupMemberSearch(e.target.value)}
                      placeholder="Zoek contact"
                      autoComplete="off"
                    />
                  </div>

                  <div id="group-add-member-list" role="list" className="pulse-sheet-list pulse-sheet-list--new-chat group-info-member-list group-info-add-list">
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
              const isAdmin = isGroupAdmin(activeConv, user.uid);
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
                  {editingGroupName ? (
                    <label className="group-info-name-edit" htmlFor="group-name-edit">
                      <span className="sr-only">Groepsnaam</span>
                      <input id="group-name-edit" className="form-input" value={groupNameDraft} onChange={(event) => setGroupNameDraft(event.target.value)} maxLength={50} autoFocus />
                    </label>
                  ) : <h2 id="group-info-title" className="group-info-title">{getConvName(activeConv)}</h2>}
                  <p id="group-info-description" className="group-info-subtitle">{activeConv.members.length} deelnemers</p>
                  <div className="group-info-hero-actions" aria-label="Snelle groepsacties">
                    <button
                      type="button"
                      className="group-info-hero-action"
                      onClick={() => setAddingMember(true)}
                      disabled={!isAdmin}
                      title={isAdmin ? 'Lid toevoegen' : 'Alleen beheerders kunnen leden toevoegen'}
                    >
                      <Users size={18} aria-hidden="true" />
                      <span>Lid toevoegen</span>
                    </button>
                    <button type="button" className="group-info-hero-action" onClick={openGroupStarredMessages} title="Berichten met ster">
                      <StarOutline size={18} aria-hidden="true" />
                      <span>Berichten met ster</span>
                    </button>
                    <button type="button" className="group-info-hero-action" onClick={openGroupChatSearch} title="Zoeken in groep">
                      <Search size={18} aria-hidden="true" />
                      <span>Zoeken</span>
                    </button>
                  </div>
                </div>
              );
            })()}
            {(() => {
              const isAdmin = isGroupAdmin(activeConv, user.uid);
              return (
                <>
                  <div role="list" className="pulse-sheet-list pulse-sheet-list--new-chat group-info-member-list">
                    {activeConv.members.map(memberId => {
                      const isMe      = memberId === user.uid;
                      const memberContact = contacts.find(c => c.uid === memberId);
                      const name      = isMe
                        ? (user.displayName || user.email || memberId)
                        : ((memberContact ? getContactDisplayName(memberContact) : null) || memberContact?.displayName || activeConv.memberNames?.[memberId] || memberId);
                      const isOnline  = onlineUsers.has(memberId);
                      const isMemberAdmin = isGroupAdmin(activeConv, memberId);
                      const photo     = memberContact?.photoURL || null;
                      return (
                        <div key={memberId} role="listitem" className="search-result group-info-member-row" style={{ cursor: 'default' }}>
                          <div className="avatar-wrap">
                            <UserAvatar photoURL={photo} displayName={name} className="sm" decorative />
                            {isOnline && <span className="online-dot sm" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="conv-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {name}{isMe ? ' (jij)' : ''}
                              {isMemberAdmin && (isMe ? (
                                <button
                                  type="button"
                                  className="admin-badge admin-badge--action"
                                  aria-label="Beheerderrol opgeven"
                                  title="Beheerderrol opgeven"
                                  onClick={relinquishGroupAdmin}
                                >
                                  <AdminIcon size={11} aria-hidden="true" /> Beheerder
                                </button>
                              ) : <span className="admin-badge"><AdminIcon size={11} aria-hidden="true" /> Beheerder</span>)}
                            </div>
                            <div className="conv-preview" style={isOnline ? { color: 'var(--success)' } : {}}>
                              {isOnline ? 'Online' : 'Offline'}
                            </div>
                          </div>
                          {isAdmin && !isMe && !isMemberAdmin && (
                            <button
                              type="button"
                              className="group-info-remove-btn"
                              aria-label={`${name} uit de groep verwijderen`}
                              title={`${name} verwijderen`}
                              onClick={() => removeMemberFromGroup?.(memberId)}
                            >
                              <Delete size={19} aria-hidden="true" />
                            </button>
                          )}
                          {isMe && isAdmin && hasPromotableGroupMember && (
                            <div className="group-info-member-actions">
                              <button type="button" className="group-info-promote-btn" aria-label="Beheerder toevoegen" title="Beheerder toevoegen" aria-expanded={showAdminPicker} onClick={() => setShowAdminPicker((visible) => !visible)}><AdminIcon size={17} aria-hidden="true" /></button>
                              {showAdminPicker && (
                                <div className="group-info-admin-picker" role="list" aria-label="Kies een nieuwe beheerder">
                                  {activeConv.members.filter((candidateId) => candidateId !== user.uid && !isGroupAdmin(activeConv, candidateId)).map((candidateId) => {
                                    const candidateContact = contacts.find((contact) => contact.uid === candidateId);
                                    const candidateName = (candidateContact ? getContactDisplayName(candidateContact) : null) || candidateContact?.displayName || activeConv.memberNames?.[candidateId] || candidateId;
                                    return <button key={candidateId} type="button" role="listitem" onClick={() => { promoteGroupAdmin?.(candidateId, candidateName); setShowAdminPicker(false); }}>{candidateName}</button>;
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
            <div className="group-info-quick-actions" aria-label="Groepsacties">
              <div className="group-info-quick-card-list">
                <button
                  type="button"
                  className={`group-info-quick-card${conversationMuted ? ' is-muted' : ''}`}
                  onClick={toggleMuteFromProfile}
                  aria-pressed={conversationMuted}
                >
                  <span className="group-info-quick-icon">
                    {conversationMuted ? <BellOff size={22} aria-hidden="true" /> : <Bell size={22} aria-hidden="true" />}
                  </span>
                  <span>Meldingen {conversationMuted ? 'uit' : 'aan'}</span>
                  <ArrowRight className="group-info-quick-arrow" size={20} aria-hidden="true" />
                </button>
                <button type="button" className="group-info-quick-card" onClick={openGroupMessageSelection}>
                  <span className="group-info-quick-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 6h14M5 12h14M5 18h9" /></svg>
                  </span>
                  <span>Berichten selecteren</span>
                  <ArrowRight className="group-info-quick-arrow" size={20} aria-hidden="true" />
                </button>
                <button type="button" className="group-info-quick-card" onClick={openGroupStarredMessages}>
                  <span className="group-info-quick-icon"><StarOutline size={22} aria-hidden="true" /></span>
                  <span>Berichten met ster</span>
                  <ArrowRight className="group-info-quick-arrow" size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="group-info-quick-card-list group-info-quick-card-list--danger">
                <button type="button" className="group-info-quick-card group-info-quick-card--danger" onClick={leaveCurrentGroup}>
                  <span className="group-info-quick-icon"><Logout size={22} aria-hidden="true" /></span>
                  <span>Groep verlaten</span>
                  <ArrowRight className="group-info-quick-arrow" size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
              </>
            )}
            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="btn-secondary" onClick={closeGroupInfo}>Sluiten</button>
            </div>
            </div>
        </aside>
        </div>
      )}

      {/* ── ACTIEF GESPREK OVERLAY ── */}
      {callsAvailable && activeCall && (
        <CallOverlay
          active={activeCall}
          contacts={contacts}
          user={user}
          chatUnreadCount={Object.values(unreadCounts || {}).reduce((sum, count) => sum + (Number(count) || 0), 0)}
          onRetryCall={(toUid, isVideo) => {
            const contact = contacts.find((item) => item?.uid === toUid);
            if (contact) {
              callContact(contact, isVideo);
              return;
            }
            setActiveCall(null);
          }}
          onClose={() => setActiveCall(null)}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* ── DOORSTUREN PANEEL ── */}
      {forwardMsg && (
        <div
          className="pulse-sheet-backdrop pulse-sheet-backdrop--forward-message"
          onClick={() => setForwardMsg(null)}
        >
          <aside
            className="pulse-sheet pulse-sheet--forward-message forward-message-panel"
            aria-labelledby="forward-message-title"
            aria-describedby="forward-message-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pulse-sheet-handle" aria-hidden="true" />
            <div className="pulse-sheet-header pulse-sheet-header--forward-message">
              <div id="forward-message-title" className="pulse-sheet-title pulse-sheet-title--forward-message">Doorsturen naar…</div>
              <button type="button" className="pulse-sheet-close pulse-sheet-close--forward-message" aria-label="Sluiten" onClick={() => setForwardMsg(null)}><span aria-hidden="true">✕</span></button>
            </div>
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
        </div>
      )}

      {/* ── ERROR / INFO TOAST ── */}
      {errToast && (
        <PulseConfirmSheet
          title={typeof errToast === 'object' ? (errToast.title || (errToast.tone === 'success' ? 'Gelukt' : 'Meldingen')) : errToast.startsWith('📋') ? 'Gelukt' : 'Let op'}
          description={typeof errToast === 'object' ? errToast.text : errToast}
          tone={typeof errToast === 'object' ? (errToast.tone || 'success') : errToast.startsWith('📋') ? 'success' : 'error'}
          onClose={dismissErrToast}
          actions={[]}
        />
      )}

      {/* ── MENTION TOAST ── */}
      {mentionToast && (
        <PulseConfirmSheet
          title="Nieuwe vermelding"
          description={`${mentionToast.senderName} heeft je vermeld in ${mentionToast.groupName}.`}
          tone="info"
          onClose={dismissMentionToast}
          actions={mentionToast.convId ? [{
            label: 'Open gesprek',
            tone: 'primary',
            onSelect: () => {
              const conv = conversations?.find?.((item) => item.id === mentionToast.convId);
              if (conv) onOpenMentionConversation?.(conv);
            },
          }] : []}
        />
      )}

      {/* ── OUDER ACTIVITEIT TOAST ── */}
      {parentToast && (
        <PulseConfirmSheet
          title="Ouderactiviteit"
          description={parentToast.description}
          tone="info"
          onClose={dismissParentToast}
          actions={[]}
        />
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
