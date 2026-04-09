// src/components/ChatModals.js
import React, { useEffect, useState } from 'react';
import { Phone, Video, Camera, Delete, Search, Users, Check, Cancel, MagicEdit, PhoneCall, PhoneOutgoing, Share, User, Palette, ImageIcon, ColorCircle, LayoutTemplate, EyeOn, EyeOff, Heart, AdminIcon, StarFilled, Clock, Refresh } from '../components/Icons';
import { getInitials, formatTime } from '../utils';
import CallOverlay from '../components/CallOverlay';
import AvatarBuilder from '../components/AvatarBuilder';
import UserAvatar from '../components/UserAvatar';
import { getMessageDisplayText } from '../lib/e2ee/messageModel';

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
  contactErr, contactLoading,
  addContact,
  pendingFriendRequest,
  remindPendingFriendRequest,
  cancelPendingFriendRequest,
  clearPendingFriendRequestState,

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
  historyRetentionDays, setHistoryRetentionDays,
  childHistoryRetentionDaysByUid, setChildHistoryRetentionDaysByUid,
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
  callContact, getCallLog,

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
}) {
  const [starredSearch,   setStarredSearch]   = useState('');
  const [profileClosing,  setProfileClosing]  = useState(false);
  const [pendingColor,    setPendingColor]    = useState(null);
  const [pendingPhoto,    setPendingPhoto]    = useState(null);   // { file, url }
  const isChildAccount = !!user?.email?.endsWith('@pulse.internal');


  function openStarredFromProfile() {
    setProfileClosing(true);
    setTimeout(() => { setProfileClosing(false); setShowContactProfile(false); setShowStarredMsgs(true); }, 180);
  }

  const anyModalOpen = !!(renamingContact || sharingContact || viewingSharedContact || viewingContact ||
    confirmDialog || showAddContact || showNewChat || showNewGroup || showProfile ||
    showCallModal || showGroupInfo || forwardMsg || showContactProfile || showAvatarBuilder || showStarredMsgs);

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
        <div className="modal-overlay" onClick={() => setRenamingContact(null)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="rename-contact-title" aria-describedby="rename-contact-description" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setRenamingContact(null)}><span aria-hidden="true">✕</span></button>
            <h3 id="rename-contact-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><MagicEdit size={18} /></span> Naam wijzigen</h3>
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
              <button type="button" className="btn-secondary" onClick={() => setRenamingContact(null)}>Annuleren</button>
              <button type="button" className="btn-primary" onClick={() => { saveContactNickname(renamingContact.uid, renameValue); setRenamingContact(null); setContacts(prev => [...prev]); }}>Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACTPERSOON DELEN ── */}
      {sharingContact && (
        <div className="modal-overlay" onClick={() => { setSharingContact(null); setShareRecipients([]); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setSharingContact(null); setShareRecipients([]); }}><span aria-hidden="true">✕</span></button>
            <h3 className="modal-title" style={{ whiteSpace: 'nowrap', fontSize: '16px' }}><span className="modal-title-icon" aria-hidden="true"><Share size={18} /></span> Contactpersoon delen</h3>
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
              <button type="button" className="btn-secondary" onClick={() => { setSharingContact(null); setShareRecipients([]); }}>Annuleren</button>
              <button type="button" className="btn-primary" disabled={shareRecipients.length === 0}
                onClick={() => { shareRecipients.forEach(uid => { const c = contacts.find(x => x.uid === uid); if (c) sendContactCard(c, sharingContact); }); setSharingContact(null); setShareRecipients([]); }}>
                Versturen{shareRecipients.length > 1 ? ` (${shareRecipients.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GEDEELD CONTACT PROFIEL ── */}
      {viewingSharedContact && (
        <div className="modal-overlay" onClick={() => setViewingSharedContact(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setViewingSharedContact(null)}><span aria-hidden="true">✕</span></button>
            <h3 className="modal-title" style={{ fontSize: '18px' }}><span className="modal-title-icon" aria-hidden="true"><User size={18} /></span> Contactpersoon</h3>
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
                      ? <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /><span style={{ color: '#f59e0b' }}>Inactief</span></>
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
          </div>
        </div>
      )}

      {/* ── CONTACT PROFIEL ── */}
      {viewingContact && (
        <div className="modal-overlay" onClick={() => setViewingContact(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="modal-title" style={{ margin: 0 }}><span className="modal-title-icon" aria-hidden="true"><User size={18} /></span> Profiel</h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className="icon-btn" aria-label={`Deel contactpersoon ${getContactDisplayName(viewingContact)}`} onClick={() => { setSharingContact(viewingContact); setViewingContact(null); }} title="Contactpersoon delen"><Share size={18} aria-hidden="true" /></button>
              </div>
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
                {onlineUsers.has(viewingContact.uid) && !inactiveUsers.has(viewingContact.uid) ? 'Online' : onlineUsers.has(viewingContact.uid) ? 'Inactief' : 'Offline'}
              </div>
            </div>
            {(() => {
              const dmConv = findConvWithUid(viewingContact.uid);
              if (!dmConv) return null;
              return (
                <div className="form-group">
                  <label className="form-label">Relatie</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['familie', 'vrienden'].map(lbl => (
                      <button key={lbl} type="button" onClick={() => setConvLabel(dmConv.id, convLabels[dmConv.id] === lbl ? null : lbl)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${convLabels[dmConv.id] === lbl ? '#6c63ff' : 'var(--border)'}`, background: convLabels[dmConv.id] === lbl ? '#6c63ff' : 'transparent', color: convLabels[dmConv.id] === lbl ? '#fff' : 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                        {lbl === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setViewingContact(null)}>Sluiten</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => { saveContactNickname(viewingContact.uid, renameValue); setContacts(prev => [...prev]); setViewingContact(null); }}>Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BEVESTIGINGSDIALOOG ── */}
      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setConfirmDialog(null)}><span aria-hidden="true">✕</span></button>
            <h3 id="confirm-dialog-title" className="sr-only">Bevestiging</h3>
            <p id="confirm-dialog-description" style={{ color: 'var(--text)', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>{confirmDialog.message}</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirmDialog(null)}>Annuleren</button>
              <button type="button" className="btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }} onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>Verwijderen</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACT TOEVOEGEN MODAL ── */}
      {showAddContact && (
        <div className="modal-overlay" onClick={() => setShowAddContact(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="add-contact-title" aria-describedby="add-contact-description" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setShowAddContact(false); setContactEmail(''); setContactNickname(''); setContactRelation(null); clearPendingFriendRequestState(); }}><span aria-hidden="true">✕</span></button>
            <h3 id="add-contact-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><Users size={18} /></span> Vriend uitnodigen</h3>
            <p id="add-contact-description" className="modal-sub">Zoek op e-mailadres, <code>@pulse.internal</code>-adres of gebruikersnaam</p>
            <div className="form-group">
              <label className="form-label">E-mailadres of gebruikersnaam</label>
              <input className="form-input" placeholder="naam@voorbeeld.nl, kind@pulse.internal of gebruikersnaam" value={contactEmail} onChange={e => { setContactEmail(e.target.value); clearPendingFriendRequestState(); }} onKeyDown={e => e.key === 'Enter' && addContact()} />
            </div>
            <div className="form-group">
              <label className="form-label">Relatie</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['familie', 'vrienden'].map(lbl => (
                  <button key={lbl} type="button" onClick={() => setContactRelation(contactRelation === lbl ? null : lbl)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${contactRelation === lbl ? '#6c63ff' : 'var(--border)'}`, background: contactRelation === lbl ? '#6c63ff' : 'transparent', color: contactRelation === lbl ? '#fff' : 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    {lbl === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
                  </button>
                ))}
              </div>
            </div>
            {contactErr && <div className="auth-error">⚠️ {contactErr}</div>}
            {pendingFriendRequest && (
              <div style={{ marginTop: '-6px', marginBottom: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(124,111,255,0.08)', border: '1px solid rgba(124,111,255,0.2)', color: 'var(--text2)', fontSize: '13px' }}>
                <div style={{ marginBottom: '10px' }}>
                  {pendingFriendRequest.remindersRemaining > 0
                    ? `Je kunt nog ${pendingFriendRequest.remindersRemaining} ${pendingFriendRequest.remindersRemaining === 1 ? 'herinnering' : 'herinneringen'} sturen.`
                    : 'Je hebt alle 3 herinneringen al gebruikt.'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={cancelPendingFriendRequest}
                    disabled={contactLoading || !pendingFriendRequest.canCancel}
                  >
                    Verzoek annuleren
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={remindPendingFriendRequest}
                    disabled={contactLoading || !pendingFriendRequest.canSendReminder}
                  >
                    {contactLoading ? 'Verzenden…' : 'Herinnering sturen'}
                  </button>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { setShowAddContact(false); setContactEmail(''); setContactNickname(''); setContactRelation(null); clearPendingFriendRequestState(); }}>Annuleren</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={addContact} disabled={contactLoading}>{contactLoading ? 'Verzenden…' : 'Verzoek sturen →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NIEUW GESPREK MODAL ── */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="new-chat-title" aria-describedby="new-chat-description" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setShowNewChat(false)}><span aria-hidden="true">✕</span></button>
            <h3 id="new-chat-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><MagicEdit size={18} /></span> Nieuwe chat</h3>
            <p id="new-chat-description" className="modal-sub">Zoek op e-mailadres, <code>@pulse.internal</code>-adres of gebruikersnaam</p>
            <div className="search-row" style={{ marginBottom: searchErr || searchResult ? 10 : 18 }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', overflowY: 'auto', maxHeight: '32vh', paddingRight: 4 }}>
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
          </div>
        </div>
      )}

      {/* ── GROEP AANMAKEN MODAL ── */}
      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="new-group-title" aria-describedby="new-group-description" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setShowNewGroup(false); setGroupName(''); }}><span aria-hidden="true">✕</span></button>
            <h3 id="new-group-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><Users size={18} /></span> Nieuwe groep</h3>
            <div className="form-group">
              <label className="form-label">Groepsnaam</label>
              <input className="form-input" placeholder="Bijv. Familie, Werk…" value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={50} />
            </div>
            <p id="new-group-description" className="modal-sub">Selecteer deelnemers</p>
            {contacts.length === 0 && <div className="auth-error">⚠️ Voeg eerst contacten toe.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
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
              <button type="button" className="btn-secondary" onClick={() => { setShowNewGroup(false); setGroupName(''); }}>Annuleren</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={createGroup} disabled={!groupName.trim() || groupMembers.length === 0}>Groep aanmaken →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFIEL MODAL ── */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div
            className="profile-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-settings-title"
            aria-describedby="profile-settings-description"
            onClick={e => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <span id="profile-settings-title" className="profile-modal-header-title">Instellingen</span>
              <button type="button" className="profile-modal-close" aria-label="Instellingen sluiten" onClick={() => setShowProfile(false)}><span aria-hidden="true">✕</span></button>
            </div>
            <p id="profile-settings-description" className="sr-only">
              Pas je account, styling en verwijderopties aan in dit instellingenvenster.
            </p>
            <div className="profile-modal-body">
              <div className="profile-sidebar">
                {[
                  ['account', <User size={16} />, 'Mijn account'],
                  ...(isParent ? [['geschiedenis', <Clock size={16} />, 'Geschiedenis']] : []),
                  ['styling', <Palette size={16} />, 'Styling'],
                  ['geblokkeerd', <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>, 'Geblokkeerd'],
                  ['verwijderen', <Delete size={16} />, 'Verwijderen'],
                ].map(([id, icon, label]) => (
                  <button key={id} type="button" className={`profile-sidebar-tab${profileTab === id ? ' active' : ''}${id === 'verwijderen' ? ' danger' : ''}`}
                    onClick={() => {
                      setProfileTab(id);
                      if (id === 'geschiedenis') loadHistorySettings();
                    }}>
                    {icon}<span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="profile-content">
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
                  </div>
                )}
                {profileTab === 'geschiedenis' && isParent && (
                  <div>
                    <div style={{ marginBottom: '18px' }}>
                      <h4 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>Geschiedenis</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
                        Beheer hoe lang chatberichten, belgeschiedenis en videogeschiedenis worden bewaard. Stel een eigen timer in voor je ouderaccount en desgewenst een andere timer per kindaccount.
                      </p>
                    </div>

                    <div style={{ display: 'grid', gap: '14px' }}>
                      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>Ouderaccount</div>
                        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
                          Kies een bewaartermijn voor jouw eigen geschiedenis. Zonder keuze blijft de standaard op 30 dagen.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                          {[1, 7, 14, 30].map((days) => {
                            const isActive = historyRetentionDays === days;
                            return (
                              <button
                                key={`parent-${days}`}
                                type="button"
                                className={isActive ? 'btn-primary' : 'btn-secondary'}
                                onClick={() => setHistoryRetentionDays(days)}
                                disabled={historySettingsLoading || historySettingsSavingTarget === 'parent'}
                                style={{ width: '100%' }}
                              >
                                {days === 1 ? '24 uur' : `${days} dagen`}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                          <button type="button" className="btn-primary" onClick={saveHistorySettings} disabled={historySettingsLoading || historySettingsSavingTarget === 'parent'}>
                            {historySettingsSavingTarget === 'parent' ? 'Opslaan…' : 'Opslaan ouderaccount'}
                          </button>
                          <button type="button" className="btn-secondary" onClick={loadHistorySettings} disabled={historySettingsLoading || Boolean(historySettingsSavingTarget)}>
                            <Refresh size={14} aria-hidden="true" /> Opnieuw laden
                          </button>
                        </div>
                      </div>

                      {historyChildren.map((child) => {
                        const selectedDays = Number(childHistoryRetentionDaysByUid?.[child.uid] || 30);
                        const isSaving = historySettingsSavingTarget === child.uid;
                        return (
                          <div key={child.uid} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>{child.displayName}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
                              Kies de bewaartermijn voor dit kindaccount.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                              {[1, 7, 14, 30].map((days) => {
                                const isActive = selectedDays === days;
                                return (
                                  <button
                                    key={`${child.uid}-${days}`}
                                    type="button"
                                    className={isActive ? 'btn-primary' : 'btn-secondary'}
                                    onClick={() => setChildHistoryRetentionDaysByUid((prev) => ({ ...prev, [child.uid]: days }))}
                                    disabled={historySettingsLoading || isSaving}
                                    style={{ width: '100%' }}
                                  >
                                    {days === 1 ? '24 uur' : `${days} dagen`}
                                  </button>
                                );
                              })}
                            </div>
                            <div style={{ marginTop: '12px' }}>
                              <button type="button" className="btn-primary" onClick={() => saveChildHistorySettings(child.uid)} disabled={historySettingsLoading || isSaving}>
                                {isSaving ? 'Opslaan…' : `Opslaan voor ${child.displayName}`}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {historySettingsMsg && (
                        <div style={{ fontSize: '12px', color: historySettingsMsg.startsWith('Fout:') ? 'var(--danger)' : 'var(--success)' }}>
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
                {profileTab === 'verwijderen' && (
                  <div>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 800, color: 'var(--danger)', marginBottom: '10px' }}>Account verwijderen</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
                        Als je je account verwijdert worden <strong>al je chats, berichten en gegevens permanent verwijderd</strong>. Dit kan niet ongedaan worden gemaakt.
                      </p>
                    </div>
                    <div style={{ background: 'rgba(255,71,87,.06)', border: '1px solid rgba(255,71,87,.2)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div>🗑️ Alle berichten worden verwijderd</div>
                        <div>👥 Je wordt uit alle gesprekken verwijderd</div>
                        <div>🔐 Je account wordt permanent afgesloten</div>
                      </div>
                    </div>
                    <button type="button" className="btn-danger" style={{ width: '100%' }}
                      onClick={() => { setShowProfile(false); handleDeleteAccount(); }}>
                      <Delete size={16} style={{ marginRight: 6 }} aria-hidden="true" /> Account definitief verwijderen
                    </button>
                  </div>
                )}
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
                            : (chatBg?.type === 'photo' ? `url(${chatBg.url}) center/cover` : chatBg?.type === 'color' ? chatBg.value : 'var(--bg)'),
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
          </div>
        </div>
      )}

      {/* ── CONTACTPROFIEL MODAL ── */}
      {showContactProfile && activeConv && !activeConv.isGroup && (() => {
        const uid       = getOtherUid(activeConv);
        const name      = getConvName(activeConv);
        const email     = activeConv.memberEmails?.[uid] || contacts.find(c => c.uid === uid)?.email || '';
        const photo     = getConvPhoto(activeConv);
        const isOnline  = uid && onlineUsers.has(uid);
        const isInactive = uid && inactiveUsers.has(uid);
        return (
          <div className={`modal-overlay${profileClosing ? ' closing' : ''}`} onClick={() => setShowContactProfile(false)}>
            <div
              className="modal-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby="contact-profile-title"
              aria-describedby="contact-profile-description"
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 id="contact-profile-title" className="modal-title" style={{ margin: 0 }}><span className="modal-title-icon" aria-hidden="true"><User size={18} /></span> Profiel</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="icon-btn" aria-label={`Open berichten met ster van ${name}`} title="Berichten met ster" onClick={openStarredFromProfile}>
                    <StarFilled size={18} style={{ color: '#f59e0b' }} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Deel contactpersoon ${name}`} onClick={() => { const c = contacts.find(c => c.uid === uid); if (c) { setSharingContact(c); setShowContactProfile(false); } }} title="Contactpersoon delen"><Share size={18} aria-hidden="true" /></button>
                </div>
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
                  {isOnline && !isInactive ? 'Online' : isOnline && isInactive ? 'Inactief' : 'Offline'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Relatie</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['familie', 'vrienden'].map(lbl => (
                    <button key={lbl} type="button" onClick={() => setConvLabel(activeConv.id, convLabels[activeConv.id] === lbl ? null : lbl)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${convLabels[activeConv.id] === lbl ? '#6c63ff' : 'var(--border)'}`, background: convLabels[activeConv.id] === lbl ? '#6c63ff' : 'transparent', color: convLabels[activeConv.id] === lbl ? '#fff' : 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                      {lbl === 'familie' ? <><Heart size={15} /> Familie</> : <><Users size={15} /> Vrienden</>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowContactProfile(false)}>Sluiten</button>
                <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => { saveContactNickname(uid, renameValue); setContacts(prev => [...prev]); setShowContactProfile(false); }}>Opslaan</button>
              </div>
            </div>
          </div>
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
          <div className="modal-overlay" onClick={() => { setShowStarredMsgs(false); setStarredSearch(''); }}>
            <div
              className="modal-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby="starred-messages-title"
              aria-describedby="starred-messages-description"
              onClick={e => e.stopPropagation()}
              style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 id="starred-messages-title" className="modal-title" style={{ margin: 0 }}>
                  <span className="modal-title-icon" aria-hidden="true"><StarFilled size={18} style={{ color: '#f59e0b' }} /></span>
                  Berichten met ster
                </h3>
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
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)' }}>
                  <StarFilled size={36} style={{ opacity: .3, color: '#f59e0b', marginBottom: 8 }} aria-hidden="true" />
                  <div style={{ fontSize: 14 }}>{q ? 'Geen resultaten' : 'Nog geen berichten met ster'}</div>
                </div>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
        );
      })()}

      {/* ── OPROEPEN MODAL ── */}
      {showCallModal && (() => {
        const callLog = getCallLog();
        return (
          <div className="modal-overlay" onClick={() => setShowCallModal(false)}>
            <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="call-log-title" aria-describedby="call-log-description" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setShowCallModal(false)}><span aria-hidden="true">✕</span></button>
              <h3 id="call-log-title" className="modal-title"><span className="modal-title-icon" aria-hidden="true"><Phone size={18} /></span> Recent</h3>
              <p id="call-log-description" className="sr-only">Bekijk recente oproepen en start een nieuwe bel- of video-oproep.</p>
              {callLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true"><Cancel size={40} /></div>
                  <div>Nog geen oproepen</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', maxHeight: 360, overflowY: 'auto' }}>
                  {callLog.map((entry, i) => {
                    const contact = contacts.find(c => c.uid === entry.uid);
                    const dirIcon = entry.direction === 'outgoing' ? <PhoneOutgoing size={13} /> : entry.direction === 'missed' ? <Cancel size={13} /> : <PhoneCall size={13} />;
                    const dirColor = entry.direction === 'missed' ? 'var(--danger)' : entry.direction === 'outgoing' ? 'var(--accent)' : 'var(--success)';
                    const ago = (() => {
                      const diff = (Date.now() - entry.ts) / 1000;
                      if (diff < 60) return 'Zojuist';
                      if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
                      if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
                      return new Date(entry.ts).toLocaleDateString('nl-NL');
                    })();
                    return (
                      <div key={i} className="call-log-row">
                        <div className="avatar-wrap">
                          <UserAvatar photoURL={entry.photoURL} displayName={entry.name} className="sm" decorative />
                          {contact && onlineUsers.has(entry.uid) && <span className="online-dot sm" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: dirColor, fontWeight: 700, fontSize: 13 }} aria-hidden="true">{dirIcon}</span>
                            <span className="conv-name">{entry.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{ago}</span>
                          </div>
                          <div className="conv-preview" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{entry.isVideo ? <><Video size={12} aria-hidden="true" /> Videogesprek</> : <><Phone size={12} aria-hidden="true" /> Gesprek</>}</div>
                        </div>
                        {contact && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="call-btn voice" aria-label={`Bel ${entry.name}`} onClick={() => callContact(contact, false)} title="Bellen"><Phone size={16} aria-hidden="true" /></button>
                            <button type="button" className="call-btn video" aria-label={`Videobel ${entry.name}`} onClick={() => callContact(contact, true)} title="Videobellen"><Video size={16} aria-hidden="true" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCallModal(false)}>Sluiten</button>
                {callLog.length > 0 && <button type="button" className="btn-secondary" style={{ flex: 1, color: 'var(--danger)' }} onClick={() => { localStorage.removeItem(`pulse_calls_${user.uid}`); setShowCallModal(false); }}>Wissen</button>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── GROEPSINFORMATIE MODAL ── */}
      {showGroupInfo && activeConv?.isGroup && (
        <div className="modal-overlay" onClick={() => { setShowGroupInfo(false); setAddingMember(false); }}>
          <div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-info-title"
            aria-describedby="group-info-description"
            onClick={e => e.stopPropagation()}
          >
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => { setShowGroupInfo(false); setAddingMember(false); }}><span aria-hidden="true">✕</span></button>
            {(() => {
              const isAdmin = activeConv.creatorId === user.uid;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 }}>
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
                    style={{ position: 'relative', cursor: isAdmin && !groupPhotoLoading ? 'pointer' : 'default' }}
                  >
                    {activeConv.photoURL
                      ? <img src={activeConv.photoURL} alt={`Groepsfoto van ${getConvName(activeConv)}`} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent,#7c3aed)' }} />
                      : <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', border: '3px solid var(--accent,#7c3aed)' }}>
                          {getConvName(activeConv)?.[0]?.toUpperCase() || '?'}
                        </div>}
                    {isAdmin && (
                      <>
                        <div aria-hidden="true" style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--accent,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
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
                  <h3 id="group-info-title" className="modal-title" style={{ margin: 0 }}>{getConvName(activeConv)}</h3>
                  <p id="group-info-description" className="modal-sub" style={{ margin: 0 }}>{activeConv.members.length} deelnemers</p>
                </div>
              );
            })()}
            {(() => {
              const isAdmin = activeConv.creatorId === user.uid;
              return (
                <>
                  <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {activeConv.members.map(memberId => {
                      const name      = activeConv.memberNames?.[memberId] || memberId;
                      const isMe      = memberId === user.uid;
                      const isOnline  = onlineUsers.has(memberId);
                      const isCreator = memberId === activeConv.creatorId;
                      const photo     = contacts.find(c => c.uid === memberId)?.photoURL || null;
                      return (
                        <div key={memberId} role="listitem" className="search-result" style={{ cursor: 'default' }}>
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
                            <button type="button" className="icon-btn" aria-label={`Verwijder ${name} uit de groep`} title="Verwijderen uit groep"
                              onClick={() => removeMemberFromGroup(memberId)}
                              style={{ color: 'var(--danger)', flexShrink: 0 }}><Delete size={18} aria-hidden="true" /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {isAdmin && !addingMember ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-expanded="false"
                      aria-controls="group-add-member-list"
                      onClick={() => setAddingMember(true)}
                    >
                      <span aria-hidden="true">+</span> Lid toevoegen
                    </button>
                  ) : isAdmin && addingMember ? (
                    <>
                      <p id="group-add-member-description" className="modal-sub">Kies een contact om toe te voegen</p>
                      <div
                        id="group-add-member-list"
                        role="list"
                        aria-describedby="group-add-member-description"
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}
                      >
                        {contacts.filter(c => !activeConv.members.includes(c.uid)).length === 0 && (
                          <div className="auth-error" role="status" aria-live="polite"><span aria-hidden="true">⚠️</span> Alle contacten zijn al lid van deze groep.</div>
                        )}
                        {contacts.filter(c => !activeConv.members.includes(c.uid)).map(c => (
                          <button
                            key={c.uid}
                            type="button"
                            role="listitem"
                            className="search-result"
                            aria-label={`Voeg ${c.displayName} toe aan de groep`}
                            onClick={() => addMemberToGroup(c)}
                            style={{ textAlign: 'left', width: '100%' }}
                          >
                            <div className="avatar-circle sm">{getInitials(c.displayName)}</div>
                            <div>
                              <div className="conv-name">{c.displayName}</div>
                              <div className="conv-preview">{c.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-expanded="true"
                        aria-controls="group-add-member-list"
                        onClick={() => setAddingMember(false)}
                      >
                        Annuleren
                      </button>
                    </>
                  ) : null}
                </>
              );
            })()}
            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="btn-secondary" onClick={() => { setShowGroupInfo(false); setAddingMember(false); }}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIEF GESPREK OVERLAY ── */}
      {activeCall && (
        <CallOverlay
          active={activeCall}
          user={user}
          onClose={() => setActiveCall(null)}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* ── DOORSTUREN MODAL ── */}
      {forwardMsg && (
        <div className="modal-overlay" onClick={() => setForwardMsg(null)}>
          <div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forward-message-title"
            aria-describedby="forward-message-description"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 380 }}
          >
            <button type="button" className="modal-close-btn" aria-label="Sluiten" onClick={() => setForwardMsg(null)}><span aria-hidden="true">✕</span></button>
            <h3 id="forward-message-title" className="modal-title"><span aria-hidden="true">↪️</span> Doorsturen naar…</h3>
            <div id="forward-message-description" style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getMessageDisplayText(forwardMsg)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              {conversations.filter(c => c.id !== activeConv?.id).map(conv => (
                <button key={conv.id} type="button" onClick={() => forwardToConv(conv)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
                }}>
                  <div className="avatar-circle sm">{getInitials(getConvName(conv))}</div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{getConvName(conv)}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setForwardMsg(null)}>Annuleren</button>
            </div>
          </div>
        </div>
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
